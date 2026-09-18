/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GOOGLE_CLIENT_ID?: string;
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_DEFAULT_PASSWORD?: string;
  readonly VITE_DEMO_ADMIN_EMAIL?: string;
  readonly VITE_DEMO_ADMIN_PASSWORD?: string;
  readonly VITE_DEMO_ADMIN_NAME?: string;
  /** Public Key do Mercado Pago (Checkout Bricks) — não é segredo. */
  readonly VITE_MERCADOPAGO_PUBLIC_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}