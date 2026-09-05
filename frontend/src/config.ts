export const CONFIG = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? "/api",
  googleClientId: import.meta.env.VITE_GOOGLE_CLIENT_ID ?? "",
  sessionKey: "maraca.session",
  scheduleKey: "maraca.v2.schedule",
  sessionTtlMs: 30 * 60 * 1000,
  maxLoginAttempts: 5,
  lockoutMs: 30 * 1000,
  bookingHorizonDays: 45,
  defaultPassword: import.meta.env.VITE_DEFAULT_PASSWORD ?? "",
} as const;
