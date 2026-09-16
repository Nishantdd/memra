export const ARGON = { memoryCost: 65_536, timeCost: 3, parallelism: 1 } as const;
export const SESSION_ABSOLUTE_MS = 30 * 24 * 3600_000;
export const SESSION_IDLE_MS = 14 * 24 * 3600_000;
export const SESSION_TOUCH_INTERVAL_MS = 5 * 60_000;
export const LOGIN_IP_WINDOW_MS = 15 * 60_000;
export const LOGIN_IP_MAX_FAILURES = 5;
export const LOGIN_GLOBAL_WINDOW_MS = 3600_000;
export const LOGIN_GLOBAL_MAX_FAILURES = 30;
export const LOGIN_FAILURE_DELAY_MS = 500;
export const LOGIN_ATTEMPT_RETENTION_MS = 24 * 3600_000;
export const COMMON_PASSWORDS = new Set([
  "password1234",
  "123456789012",
  "qwertyuiop12",
  "letmeinplease",
  "administrator",
  "passw0rd1234",
]);
