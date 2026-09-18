import { CONFIG } from "../config.js";

/* ------------------------------------------------------------------ */
/*  Checkout Bricks — Card Payment Brick (Mercado Pago)                */
/*  Renderiza o formulário de cartão do MP dentro de um contêiner.     */
/*  O backend processa a cobrança (POST /v1/payments) e nunca recebe   */
/*  os dados brutos do cartão: o Brick retorna um `token` seguro.      */
/* ------------------------------------------------------------------ */

export interface MercadoPagoIdentification {
  type: string;
  number: string;
}

/** Pagador coletado pelo Brick (campos do SDK em snake_case). */
export interface CardPaymentPayer {
  email: string;
  first_name?: string;
  last_name?: string;
  identification?: MercadoPagoIdentification;
}

/** FormData entregue ao callback onSubmit do Card Payment Brick. */
export interface CardPaymentFormData {
  token: string;
  payment_method_id: string;
  payer?: CardPaymentPayer;
}

export interface CardPaymentBrickCallbacks {
  /**
   * Recebe o token de cartão e devolve `true` (aprovado/aguardando) ou
   * `false` (recusado) — o Brick decide o estado visual de sucesso/erro.
   */
  onSubmit(formData: CardPaymentFormData): Promise<boolean>;
  onReady?(): void;
  onError?(error: unknown): void;
}

export interface CardPaymentBrickOptions {
  container: HTMLElement;
  amount: number;
  callbacks: CardPaymentBrickCallbacks;
}

/* ── Tipos do SDK Web v2 (mínimos, sem `any`) ─────────────────────── */

interface MercadoPagoBrickController {
  /** `create()` já monta o brick no contêiner; o controller oficial não
   *  expõe `mount` (apenas `unmount`, `getFormData`, `getAdditionalData`,
   *  `update`). Mantemos aqui só o que este módulo utiliza. */
  unmount(): void;
}

interface CardPaymentBrickSettings {
  initialization: { amount: number };
  callbacks: {
    onReady?(): void;
    onSubmit(formData: CardPaymentFormData): Promise<boolean>;
    onError?(error: unknown): void;
  };
}

interface MercadoPagoBricksBuilder {
  create(
    type: "cardPayment",
    container: HTMLElement | string,
    settings: CardPaymentBrickSettings,
  ): Promise<MercadoPagoBrickController>;
}

interface MercadoPagoInstance {
  bricks(): MercadoPagoBricksBuilder;
}

interface MercadoPagoConstructor {
  /** SDK v2 é uma classe construtora: `new MercadoPago(publicKey, options)`.
   *  Invocar sem `new` lança TypeError ("cannot be invoked without 'new'"). */
  new (publicKey: string, options?: { locale: string }): MercadoPagoInstance;
}

declare global {
  interface Window {
    MercadoPago?: MercadoPagoConstructor;
  }
}

const SDK_URL = "https://sdk.mercadopago.com/js/v2";
const SDK_TIMEOUT_MS = 15_000;

function injetarScriptSdk(): void {
  if (document.querySelector(`script[src="${SDK_URL}"]`)) return;
  const script = document.createElement("script");
  script.src = SDK_URL;
  script.async = true;
  document.head.appendChild(script);
}

/**
 * Garante que o SDK Web v2 esteja carregado (injeta o script de forma
 * idempotente) e devolve uma instância do MercadoPago inicializada com a
 * Public Key. Falha com mensagem amigável após o timeout.
 */
export function carregarSdkMercadoPago(
  timeoutMs: number = SDK_TIMEOUT_MS,
): Promise<MercadoPagoInstance> {
  return new Promise((resolve, reject) => {
    const iniciado = Date.now();
    const verificar = (): void => {
      if (window.MercadoPago) {
        resolve(
          new window.MercadoPago(CONFIG.mercadopagoPublicKey, { locale: "pt-BR" }),
        );
        return;
      }
      if (Date.now() - iniciado > timeoutMs) {
        reject(
          new Error(
            "Não foi possível carregar o pagamento do Mercado Pago. Verifique sua conexão e tente novamente.",
          ),
        );
        return;
      }
      window.setTimeout(verificar, 200);
    };
    injetarScriptSdk();
    verificar();
  });
}

/**
 * Monta o Card Payment Brick dentro de `container`. Devolve uma função de
 * cleanup idempotente (desmonta o Brick uma única vez).
 */
export async function montarCardPaymentBrick(
  opcoes: CardPaymentBrickOptions,
): Promise<() => void> {
  const mp = await carregarSdkMercadoPago();
  const controller = await mp.bricks().create("cardPayment", opcoes.container, {
    initialization: { amount: opcoes.amount },
    callbacks: {
      onReady: () => opcoes.callbacks.onReady?.(),
      onSubmit: (formData) => opcoes.callbacks.onSubmit(formData),
      onError: (error) => opcoes.callbacks.onError?.(error),
    },
  });

  let desmontado = false;
  return async () => {
    if (desmontado) return;
    desmontado = true;
    try {
      // `create()` já monta o brick; o cleanup só desmonta.
      controller.unmount();
    } catch {
      // Best-effort: o contêiner também é removido do DOM pelo modal.
    }
  };
}