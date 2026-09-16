export const SESSION_COOKIE = "memra_session";
export const API_PREFIX = "/api/v1";
export const RPC_PREFIX = "/api/rpc";
export const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
export const BODY_LIMIT_BYTES = 2 * 1024 * 1024;
export const RATE_LIMIT_DEFAULT = { max: 300, timeWindow: "1 minute" } as const;
export const RATE_LIMIT_LOGIN = { max: 10, timeWindow: "1 minute" } as const;
export const SESSION_PURGE_INTERVAL_MS = 3600_000;
