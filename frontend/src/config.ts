export const CONFIG = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? "/api",
  googleClientId: import.meta.env.VITE_GOOGLE_CLIENT_ID ?? "",
  /** Public Key do Mercado Pago (Checkout Bricks). Vazia ⇒ frontend usa o
   *  fluxo Checkout Pro (checkoutUrl) como fallback. Não é segredo. */
  mercadopagoPublicKey: import.meta.env.VITE_MERCADOPAGO_PUBLIC_KEY ?? "",
  sessionKey: "maraca.session",
  sessionTtlMs: 30 * 60 * 1000,
  maxLoginAttempts: 5,
  lockoutMs: 30 * 1000,
  bookingHorizonDays: 45,
  defaultPassword: import.meta.env.VITE_DEFAULT_PASSWORD ?? "123456",
} as const;
