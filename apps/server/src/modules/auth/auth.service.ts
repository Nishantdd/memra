import { createHash, randomBytes } from "node:crypto";
import { hash, verify } from "@node-rs/argon2";
import { LIMITS } from "shared";
import { type Database, now } from "../../db/database.ts";
import { getMeta, setMeta } from "../../db/meta.ts";
import {
  ARGON,
  COMMON_PASSWORDS,
  LOGIN_ATTEMPT_RETENTION_MS,
  LOGIN_FAILURE_DELAY_MS,
  LOGIN_GLOBAL_MAX_FAILURES,
  LOGIN_GLOBAL_WINDOW_MS,
  LOGIN_IP_MAX_FAILURES,
  LOGIN_IP_WINDOW_MS,
  SESSION_ABSOLUTE_MS,
  SESSION_IDLE_MS,
  SESSION_TOUCH_INTERVAL_MS,
} from "../../constants/index.ts";

export interface Session {
  id: string;
  createdAt: number;
  expiresAt: number;
  lastSeenAt: number;
  userAgent: string;
}

export class WeakPassword extends Error {
  readonly reason: string;

  constructor(reason: string) {
    super(reason);
    this.reason = reason;
  }
}
export class LockedOut extends Error {
  readonly retryAfterSec: number;

  constructor(retryAfterSec: number) {
    super();
    this.retryAfterSec = retryAfterSec;
  }
}

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function validatePasswordStrength(password: string): void {
  if (password.length < LIMITS.passwordMin)
    throw new WeakPassword(`Password must be at least ${LIMITS.passwordMin} characters.`);
  if (COMMON_PASSWORDS.has(password.toLowerCase()))
    throw new WeakPassword("Password is too common.");
  if (new Set(password).size < 4) throw new WeakPassword("Password has too little variety.");
}

export class AuthService {
  readonly #db: Database;

  constructor(db: Database) {
    this.#db = db;
  }

  hasPassword(): boolean {
    return getMeta(this.#db, "password_hash") !== null;
  }

  async setPassword(password: string): Promise<void> {
    validatePasswordStrength(password);
    const digest = await hash(password, ARGON);
    this.#db.transaction(() => {
      setMeta(this.#db, "password_hash", digest);
      setMeta(this.#db, "password_updated_at", String(now()));
    });
  }

  async verifyPassword(password: string): Promise<boolean> {
    const digest = getMeta(this.#db, "password_hash");
    if (!digest) return false;
    return verify(digest, password);
  }

  lockoutRemainingSec(ip: string): number {
    const t = now();
    const ipFailures = this.#db.get<{ c: number; last: number | null }>(
      "SELECT count(*) AS c, max(at) AS last FROM login_attempts WHERE ip = ? AND success = 0 AND at > ?",
      ip,
      t - LOGIN_IP_WINDOW_MS,
    )!;
    if (ipFailures.c >= LOGIN_IP_MAX_FAILURES)
      return Math.ceil((ipFailures.last! + LOGIN_IP_WINDOW_MS - t) / 1000);
    const global = this.#db.get<{ c: number; last: number | null }>(
      "SELECT count(*) AS c, max(at) AS last FROM login_attempts WHERE success = 0 AND at > ?",
      t - LOGIN_GLOBAL_WINDOW_MS,
    )!;
    if (global.c >= LOGIN_GLOBAL_MAX_FAILURES)
      return Math.ceil((global.last! + LOGIN_GLOBAL_WINDOW_MS - t) / 1000);
    return 0;
  }

  async login(
    password: string,
    ip: string,
    userAgent: string,
  ): Promise<{ token: string; session: Session }> {
    const remaining = this.lockoutRemainingSec(ip);
    if (remaining > 0) throw new LockedOut(remaining);
    const ok = await this.verifyPassword(password);
    this.#db.run(
      "INSERT INTO login_attempts(ip, at, success) VALUES (?, ?, ?)",
      ip,
      now(),
      ok ? 1 : 0,
    );
    if (!ok) {
      await sleep(LOGIN_FAILURE_DELAY_MS);
      throw new Error("invalid_credentials");
    }
    return this.createSession(ip, userAgent);
  }

  createSession(ip: string, userAgent: string): { token: string; session: Session } {
    const token = randomBytes(32).toString("base64url");
    const t = now();
    const session: Session = {
      id: hashToken(token),
      createdAt: t,
      expiresAt: t + SESSION_ABSOLUTE_MS,
      lastSeenAt: t,
      userAgent: userAgent.slice(0, 300),
    };
    this.#db.run(
      "INSERT INTO sessions(id, created_at, expires_at, last_seen_at, user_agent, ip) VALUES (?, ?, ?, ?, ?, ?)",
      session.id,
      session.createdAt,
      session.expiresAt,
      session.lastSeenAt,
      session.userAgent,
      ip,
    );
    return { token, session };
  }

  resolve(token: string | undefined): Session | null {
    if (!token) return null;
    const id = hashToken(token);
    const row = this.#db.get<{
      id: string;
      created_at: number;
      expires_at: number;
      last_seen_at: number;
      user_agent: string;
    }>(
      "SELECT id, created_at, expires_at, last_seen_at, user_agent FROM sessions WHERE id = ?",
      id,
    );
    if (!row) return null;
    const t = now();
    if (row.expires_at <= t || row.last_seen_at + SESSION_IDLE_MS <= t) {
      this.#db.run("DELETE FROM sessions WHERE id = ?", id);
      return null;
    }
    if (t - row.last_seen_at > SESSION_TOUCH_INTERVAL_MS) {
      this.#db.run("UPDATE sessions SET last_seen_at = ? WHERE id = ?", t, id);
      row.last_seen_at = t;
    }
    return {
      id: row.id,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
      lastSeenAt: row.last_seen_at,
      userAgent: row.user_agent,
    };
  }

  revoke(sessionId: string): void {
    this.#db.run("DELETE FROM sessions WHERE id = ?", sessionId);
  }

  revokeOthers(sessionId: string): void {
    this.#db.run("DELETE FROM sessions WHERE id != ?", sessionId);
  }

  listSessions(): Session[] {
    return this.#db
      .all<{
        id: string;
        created_at: number;
        expires_at: number;
        last_seen_at: number;
        user_agent: string;
      }>(
        "SELECT id, created_at, expires_at, last_seen_at, user_agent FROM sessions WHERE expires_at > ? ORDER BY last_seen_at DESC",
        now(),
      )
      .map((r) => ({
        id: r.id,
        createdAt: r.created_at,
        expiresAt: r.expires_at,
        lastSeenAt: r.last_seen_at,
        userAgent: r.user_agent,
      }));
  }

  purge(): void {
    const t = now();
    this.#db.run(
      "DELETE FROM sessions WHERE expires_at <= ? OR last_seen_at <= ?",
      t,
      t - SESSION_IDLE_MS,
    );
    this.#db.run("DELETE FROM login_attempts WHERE at <= ?", t - LOGIN_ATTEMPT_RETENTION_MS);
  }
}
