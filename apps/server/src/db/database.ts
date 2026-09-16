import { DatabaseSync, backup as sqliteBackup } from "node:sqlite";

export type SqlValue = string | number | bigint | null | Uint8Array;
export type Row = Record<string, SqlValue>;

export interface Database {
  get<T extends Row = Row>(sql: string, ...params: SqlValue[]): T | undefined;
  all<T extends Row = Row>(sql: string, ...params: SqlValue[]): T[];
  run(sql: string, ...params: SqlValue[]): { changes: number; lastInsertRowid: number | bigint };
  exec(sql: string): void;
  transaction<T>(fn: () => T): T;
  loadExtension(path: string): void;
  backup(destination: string): Promise<void>;
  close(): void;
}

export interface OpenOptions {
  readonly?: boolean;
  allowExtension?: boolean;
  cacheSizeKb?: number;
}

export class NodeSqliteDatabase implements Database {
  readonly #db: DatabaseSync;
  #depth = 0;

  constructor(path: string, options: OpenOptions = {}) {
    this.#db = new DatabaseSync(path, {
      readOnly: options.readonly ?? false,
      allowExtension: options.allowExtension ?? false,
    });
    this.#db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = NORMAL;
      PRAGMA foreign_keys = ON;
      PRAGMA busy_timeout = 5000;
      PRAGMA temp_store = MEMORY;
      PRAGMA cache_size = -${options.cacheSizeKb ?? 16000};
    `);
  }

  get<T extends Row = Row>(sql: string, ...params: SqlValue[]): T | undefined {
    return this.#db.prepare(sql).get(...params) as T | undefined;
  }

  all<T extends Row = Row>(sql: string, ...params: SqlValue[]): T[] {
    return this.#db.prepare(sql).all(...params) as T[];
  }

  run(sql: string, ...params: SqlValue[]) {
    return this.#db.prepare(sql).run(...params);
  }

  exec(sql: string): void {
    this.#db.exec(sql);
  }

  transaction<T>(fn: () => T): T {
    if (this.#depth > 0) return fn();
    this.#db.exec("BEGIN IMMEDIATE");
    this.#depth++;
    try {
      const result = fn();
      this.#db.exec("COMMIT");
      return result;
    } catch (error) {
      this.#db.exec("ROLLBACK");
      throw error;
    } finally {
      this.#depth--;
    }
  }

  loadExtension(path: string): void {
    this.#db.loadExtension(path);
  }

  async backup(destination: string): Promise<void> {
    await sqliteBackup(this.#db, destination);
  }

  close(): void {
    this.#db.close();
  }
}

export const now = (): number => Date.now();
