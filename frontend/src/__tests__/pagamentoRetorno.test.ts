import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderPagamentoRetorno } from "../views/pagamentoRetorno.js";
import { cancelarPagamento, confirmarRetorno } from "../services/pagamento.js";
import { getSession } from "../services/auth.js";
import { navigateTo } from "../router.js";
import { ApiError } from "../services/api.js";

/* ------------------------------------------------------------------ */
/*  Regressão: retorno do checkout Mercado Pago (#/pagamento/retorno)  */
/*  - NUNCA cai na tela de login (não há gate de sessão nesta view);   */
/*  - success + pagamento aprovado → "Pagamento realizado";            */
/*  - failure (desistência) → mensagem de cancelado + badge;        */
/*  - "Voltar para minha conta" navega para /minha-conta.              */
/* ------------------------------------------------------------------ */

vi.mock("../services/pagamento.js", () => ({
  createPayment: vi.fn(),
  getPayment: vi.fn(),
  confirmarRetorno: vi.fn(),
  cancelarPagamento: vi.fn(),
}));

vi.mock("../services/auth.js", () => ({
  getSession: vi.fn(() => ({ role: "cliente" })),
}));

vi.mock("../services/api.js", () => {
  class ApiError extends Error {
    public readonly status: number;
    constructor(message: string, status = 0) {
      super(message);
      this.name = "ApiError";
      this.status = status;
    }
  }
  return { ApiError };
});

vi.mock("../router.js", () => ({
  navigateTo: vi.fn(),
}));

const pagamentoAprovado = {
  id: "p1",
  agendamentoId: "a1",
  status: "aprovado" as const,
  valorCentavos: 4500,
  mercadopagoOrderId: "order-1",
  mercadopagoPaymentId: "pay-1",
  checkoutUrl: null,
  criadoEm: "2026-09-13T10:00:00Z",
  atualizadoEm: "2026-09-13T10:00:00Z",
};

class FakeEl {
  innerHTML = "";
  disabled = false;
  readonly classList = { add: vi.fn(), remove: vi.fn() };
  private listeners: Record<string, (event?: unknown) => void> = {};

  addEventListener(event: string, handler: (event?: unknown) => void): void {
    this.listeners[event] = handler;
  }

  removeEventListener(event: string, handler: (event?: unknown) => void): void {
    if (this.listeners[event] === handler) delete this.listeners[event];
  }

  insertAdjacentHTML(_position: string, html: string): void {
    this.innerHTML += html;
  }

  dispatch(event: string): void {
    this.listeners[event]?.();
  }

  querySelector(): null {
    return null;
  }
}

class FakeContainer extends FakeEl {
  readonly status = new FakeEl();
  readonly voltar = new FakeEl();

  querySelector<T>(selector: string): T | null {
    if (selector === "[data-pagamento-status]") return this.status as unknown as T;
    if (selector === "[data-voltar-conta]") return this.voltar as unknown as T;
    return null;
  }
}

function stubLocation(search: string, hash: string): void {
  vi.stubGlobal("window", { location: { search, hash } });
}

function montar(search: string, hash: string): { container: FakeContainer; cleanup: () => void } {
  stubLocation(search, hash);
  const container = new FakeContainer();
  const cleanup = renderPagamentoRetorno(container as unknown as HTMLElement);
  return { container, cleanup };
}

const SUCCESS_HASH = "#/pagamento/retorno?status=success&agendamento=a1&payment_id=pay-1";

describe("pagamentoRetorno — regressão do retorno do checkout", () => {
  beforeEach(() => {
    vi.mocked(confirmarRetorno).mockResolvedValue(pagamentoAprovado);
    vi.mocked(cancelarPagamento).mockResolvedValue(null);
    vi.mocked(getSession).mockReturnValue({ role: "cliente" } as never);
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("não redireciona para a tela de login ao renderizar o retorno", async () => {
    const { cleanup } = montar("", SUCCESS_HASH);

    await vi.waitFor(() => {
      expect(confirmarRetorno).toHaveBeenCalled();
    });

    expect(navigateTo).not.toHaveBeenCalledWith("/login-cliente");
    cleanup();
  });

  it("success com pagamento aprovado renderiza 'Pagamento realizado'", async () => {
    const { container, cleanup } = montar("", SUCCESS_HASH);

    await vi.waitFor(() => {
      expect(container.status.innerHTML).toContain("Pagamento realizado");
    });
    expect(container.status.innerHTML).toContain("PAGAMENTO REALIZADO");
    expect(confirmarRetorno).toHaveBeenCalledWith("a1", "pay-1");
    cleanup();
  });

  it("lê payment_id quando o MP anexa os parâmetros antes do hash", async () => {
    const { cleanup } = montar(
      "?payment_id=pay-9",
      "#/pagamento/retorno?status=success&agendamento=a1",
    );

    await vi.waitFor(() => {
      expect(confirmarRetorno).toHaveBeenCalledWith("a1", "pay-9");
    });
    cleanup();
  });

  it("failure (desistência) mostra mensagem de cancelado e aciona cancelarPagamento", async () => {
    const { container, cleanup } = montar(
      "",
      "#/pagamento/retorno?status=failure&agendamento=a1",
    );

    await vi.waitFor(() => {
      expect(cancelarPagamento).toHaveBeenCalledWith("a1");
    });
    expect(container.status.innerHTML).toContain("O pagamento não foi concluído.");
    expect(container.status.innerHTML).toContain("PAGAMENTO CANCELADO");
    expect(navigateTo).not.toHaveBeenCalledWith("/login-cliente");
    cleanup();
  });

  it("failure sem sessão NÃO chama cancelarPagamento (evita 401) mas mantém a tela", () => {
    vi.mocked(getSession).mockReturnValue(null);

    const { container, cleanup } = montar(
      "",
      "#/pagamento/retorno?status=failure&agendamento=a1",
    );

    expect(cancelarPagamento).not.toHaveBeenCalled();
    expect(container.status.innerHTML).toContain("PAGAMENTO CANCELADO");
    expect(navigateTo).not.toHaveBeenCalledWith("/login-cliente");
    cleanup();
  });

  it("success sem payment_id confirma mesmo assim (backend resolve pela referência local)", async () => {
    const { container, cleanup } = montar(
      "",
      "#/pagamento/retorno?status=success&agendamento=a1",
    );

    await vi.waitFor(() => {
      expect(confirmarRetorno).toHaveBeenCalledWith("a1", null);
    });
    await vi.waitFor(() => {
      expect(container.status.innerHTML).toContain("Pagamento realizado");
    });
    cleanup();
  });

  it("401 na confirmação mostra aviso de sessão expirada sem loop de retry", async () => {
    vi.mocked(confirmarRetorno).mockRejectedValue(new ApiError("Token ausente", 401));

    const { container, cleanup } = montar("", SUCCESS_HASH);

    await vi.waitFor(() => {
      expect(container.status.innerHTML).toContain("Sua sessão expirou");
    });
    // Uma única tentativa: não reitera sem sessão.
    expect(confirmarRetorno).toHaveBeenCalledTimes(1);
    expect(navigateTo).not.toHaveBeenCalledWith("/login-cliente");
    cleanup();
  });

  it("'Voltar para minha conta' navega para /minha-conta", () => {
    const { container, cleanup } = montar("", SUCCESS_HASH);

    container.voltar.dispatch("click");

    expect(navigateTo).toHaveBeenCalledWith("/minha-conta");
    cleanup();
  });

  it("link de retorno sem agendamento mostra erro sem cair no login", () => {
    const { container, cleanup } = montar("", "#/pagamento/retorno?status=success");

    expect(container.status.innerHTML).toContain("Link de retorno inválido");
    expect(navigateTo).not.toHaveBeenCalled();
    cleanup();
  });
});
