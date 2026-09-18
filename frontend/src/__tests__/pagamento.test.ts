import { afterEach, describe, expect, it, vi } from "vitest";
import { mapAppointment } from "../services/booking";
import {
  cancelarPagamento,
  confirmarRetorno,
  createCardPayment,
  createPayment,
  getPayment,
} from "../services/pagamento";
import { pagamentoAcoesHtml } from "../features/pagamentoAcoes";
import { pagamentoBadgeHtml } from "../ui/pagamentoBadge";

const dtoBase = {
  id: "a1",
  clienteId: "c1",
  clienteNome: "Cliente Teste",
  funcionarioId: "f1",
  funcionarioNome: "Barbeiro",
  servicoId: "s1",
  servicoNome: "Corte",
  data: "2026-09-13",
  hora: "10:00",
  status: "pendente",
  observacao: null,
};

const pagamento = {
  id: "p1",
  agendamentoId: "a1",
  status: "pendente",
  valorCentavos: 4500,
  mercadopagoOrderId: "order-1",
  mercadopagoPaymentId: null,
  checkoutUrl: "https://mercadopago.test/checkout/1",
  criadoEm: "2026-09-13T10:00:00Z",
  atualizadoEm: "2026-09-13T10:00:00Z",
};

function mockFetchJson(body: unknown): ReturnType<typeof vi.fn> {
  return vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => body,
  }));
}

/* ------------------------------------------------------------------ */
/*  mapAppointment — aditivo pagamentoStatus                           */
/* ------------------------------------------------------------------ */
describe("mapAppointment — pagamentoStatus (aditivo do contrato)", () => {
  it("repassa pagamentoStatus preenchido", () => {
    const dto = { ...dtoBase, pagamentoStatus: "pendente" } as Parameters<
      typeof mapAppointment
    >[0];
    expect(mapAppointment(dto).pagamentoStatus).toBe("pendente");
  });

  it("repassa pagamentoStatus aprovado", () => {
    const dto = { ...dtoBase, pagamentoStatus: "aprovado" } as Parameters<
      typeof mapAppointment
    >[0];
    expect(mapAppointment(dto).pagamentoStatus).toBe("aprovado");
  });

  it("converte pagamentoStatus ausente para null (não altera fluxos antigos)", () => {
    const dto = { ...dtoBase } as Parameters<typeof mapAppointment>[0];
    const mapped = mapAppointment(dto);
    expect(mapped.pagamentoStatus).toBeNull();
  });

  it("converte pagamentoStatus null para null", () => {
    const dto = { ...dtoBase, pagamentoStatus: null } as Parameters<
      typeof mapAppointment
    >[0];
    expect(mapAppointment(dto).pagamentoStatus).toBeNull();
  });
});

/* ------------------------------------------------------------------ */
/*  createPayment                                                      */
/* ------------------------------------------------------------------ */
describe("createPayment", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("faz POST /api/agendamentos/:id/pagamento e devolve checkoutUrl + pagamento", async () => {
    const fetchMock = mockFetchJson({ checkoutUrl: pagamento.checkoutUrl, pagamento });
    vi.stubGlobal("fetch", fetchMock);

    const result = await createPayment("a1");

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/agendamentos/a1/pagamento",
      expect.objectContaining({ method: "POST" }),
    );
    expect(result.checkoutUrl).toBe("https://mercadopago.test/checkout/1");
    expect(result.pagamento.status).toBe("pendente");
  });

  it("codifica o id na URL (encodeURIComponent)", async () => {
    const fetchMock = mockFetchJson({ checkoutUrl: null, pagamento });
    vi.stubGlobal("fetch", fetchMock);

    await createPayment("a/b");

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/agendamentos/a%2Fb/pagamento",
      expect.objectContaining({ method: "POST" }),
    );
  });
});

/* ------------------------------------------------------------------ */
/*  getPayment                                                         */
/* ------------------------------------------------------------------ */
describe("getPayment", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("faz GET /api/agendamentos/:id/pagamento e devolve o pagamento", async () => {
    const fetchMock = mockFetchJson({ pagamento });
    vi.stubGlobal("fetch", fetchMock);

    await expect(getPayment("a1")).resolves.toEqual(pagamento);

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/agendamentos/a1/pagamento",
      expect.not.objectContaining({ method: "POST" }),
    );
  });

  it("devolve null quando o agendamento não possui pagamento", async () => {
    vi.stubGlobal("fetch", mockFetchJson({ pagamento: null }));

    await expect(getPayment("a1")).resolves.toBeNull();
  });
});

/* ------------------------------------------------------------------ */
/*  confirmarRetorno                                                   */
/* ------------------------------------------------------------------ */
describe("confirmarRetorno", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("faz POST /api/agendamentos/:id/pagamento/confirmar-retorno com payment_id e devolve o pagamento", async () => {
    const fetchMock = mockFetchJson({ pagamento });
    vi.stubGlobal("fetch", fetchMock);

    const result = await confirmarRetorno("a1", "pay-123");

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/agendamentos/a1/pagamento/confirmar-retorno",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ paymentId: "pay-123" }),
      }),
    );
    expect(result).toEqual(pagamento);
  });

  it("sem payment_id envia corpo vazio (backend resolve pela referência local)", async () => {
    const fetchMock = mockFetchJson({ pagamento });
    vi.stubGlobal("fetch", fetchMock);

    const result = await confirmarRetorno("a1");

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/agendamentos/a1/pagamento/confirmar-retorno",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({}),
      }),
    );
    expect(result).toEqual(pagamento);
  });

  it("rejeita quando o backend responde 404 (pagamento não confirmável)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 404,
        json: async () => ({ mensagem: "Pagamento não encontrado" }),
      })),
    );

    await expect(confirmarRetorno("a1", "pay-456")).rejects.toMatchObject({
      name: "ApiError",
      status: 404,
    });
  });

  it("codifica o id na URL (encodeURIComponent)", async () => {
    const fetchMock = mockFetchJson({ pagamento });
    vi.stubGlobal("fetch", fetchMock);

    await confirmarRetorno("a/b", "pay-789");

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/agendamentos/a%2Fb/pagamento/confirmar-retorno",
      expect.objectContaining({ method: "POST" }),
    );
  });
});

/* ------------------------------------------------------------------ */
/*  cancelarPagamento                                                  */
/* ------------------------------------------------------------------ */
describe("cancelarPagamento", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("faz POST sem body em /api/agendamentos/:id/pagamento/cancelar e devolve o pagamento cancelado", async () => {
    const pagamentoCancelado = { ...pagamento, status: "cancelado" };
    const fetchMock = mockFetchJson({ pagamento: pagamentoCancelado });
    vi.stubGlobal("fetch", fetchMock);

    const result = await cancelarPagamento("a1");

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/agendamentos/a1/pagamento/cancelar",
      expect.objectContaining({ method: "POST" }),
    );
    // Contrato sem body: nenhuma chave `body` é enviada na requisição.
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/agendamentos/a1/pagamento/cancelar",
      expect.not.objectContaining({ body: expect.anything() }),
    );
    expect(result).toEqual({ ...pagamentoCancelado });
  });

  it("devolve null quando não existe pagamento pendente para cancelar", async () => {
    vi.stubGlobal("fetch", mockFetchJson({ pagamento: null }));

    await expect(cancelarPagamento("a1")).resolves.toBeNull();
  });

  it("codifica o id na URL (encodeURIComponent)", async () => {
    const fetchMock = mockFetchJson({ pagamento });
    vi.stubGlobal("fetch", fetchMock);

    await cancelarPagamento("a/b");

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/agendamentos/a%2Fb/pagamento/cancelar",
      expect.objectContaining({ method: "POST" }),
    );
  });
});

/* ------------------------------------------------------------------ */
/*  createCardPayment (Checkout Bricks)                                */
/* ------------------------------------------------------------------ */
describe("createCardPayment", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("faz POST /api/agendamentos/:id/pagamento/cartao com token + payer e devolve status/pagamento", async () => {
    const pagamentoAprovado = { ...pagamento, status: "aprovado" };
    const fetchMock = mockFetchJson({ status: "aprovado", pagamento: pagamentoAprovado });
    vi.stubGlobal("fetch", fetchMock);

    const input = {
      token: "card-token-123",
      paymentMethodId: "visa",
      payer: {
        email: "cliente@email.com",
        identification: { type: "CPF", number: "12345678909" },
      },
    };

    const result = await createCardPayment("a1", input);

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/agendamentos/a1/pagamento/cartao",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify(input),
      }),
    );
    expect(result.status).toBe("aprovado");
    expect(result.pagamento.status).toBe("aprovado");
  });

  it("codifica o id na URL (encodeURIComponent)", async () => {
    const fetchMock = mockFetchJson({ status: "pendente", pagamento });
    vi.stubGlobal("fetch", fetchMock);

    await createCardPayment("a/b", {
      token: "t",
      paymentMethodId: "master",
      payer: { email: "x@y.com" },
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/agendamentos/a%2Fb/pagamento/cartao",
      expect.objectContaining({ method: "POST" }),
    );
  });
});

/* ------------------------------------------------------------------ */
/*  pagamentoBadgeHtml                                                 */
/* ------------------------------------------------------------------ */
describe("pagamentoBadgeHtml", () => {
  it("aprovado → badge success com rótulo PAGAMENTO REALIZADO", () => {
    expect(pagamentoBadgeHtml("aprovado")).toBe(
      '<span class="badge badge--success">PAGAMENTO REALIZADO</span>',
    );
  });

  it("cancelado → badge danger com rótulo PAGAMENTO CANCELADO", () => {
    expect(pagamentoBadgeHtml("cancelado")).toBe(
      '<span class="badge badge--danger">PAGAMENTO CANCELADO</span>',
    );
  });

  it("pendente → badge warning com rótulo PAGAMENTO PENDENTE", () => {
    expect(pagamentoBadgeHtml("pendente")).toBe(
      '<span class="badge badge--warning">PAGAMENTO PENDENTE</span>',
    );
  });

  it("recusado/cancelado/expirado → badge danger", () => {
    expect(pagamentoBadgeHtml("recusado")).toContain("badge--danger");
    expect(pagamentoBadgeHtml("cancelado")).toContain("badge--danger");
    expect(pagamentoBadgeHtml("expirado")).toContain("badge--danger");
  });

  it("null/undefined → string vazia (não polui a UI)", () => {
    expect(pagamentoBadgeHtml(null)).toBe("");
    expect(pagamentoBadgeHtml(undefined)).toBe("");
  });
});

/* ------------------------------------------------------------------ */
/*  pagamentoAcoesHtml — coluna Ações de Minha Conta                   */
/* ------------------------------------------------------------------ */
describe("pagamentoAcoesHtml — coluna Ações de Minha Conta", () => {
  const base = {
    id: "a1",
    status: "pendente" as const,
    pagamentoStatus: null as const,
  };

  it("pagamento aprovado → badge PAGAMENTO REALIZADO e NENHUM botão PAGAR", () => {
    const html = pagamentoAcoesHtml({ ...base, pagamentoStatus: "aprovado" });
    expect(html).toContain("PAGAMENTO REALIZADO");
    expect(html).not.toContain("data-pay");
  });

  it("pagamento cancelado + agendamento pendente → botão PAGAR sem badge (desistência no checkout)", () => {
    const html = pagamentoAcoesHtml({ ...base, pagamentoStatus: "cancelado" });
    expect(html).toContain("data-pay");
    expect(html).not.toContain("PAGAMENTO CANCELADO");
  });

  it("pagamento cancelado + agendamento confirmado → badge PAGAMENTO CANCELADO e NENHUM botão PAGAR", () => {
    const html = pagamentoAcoesHtml({
      ...base,
      status: "confirmado",
      pagamentoStatus: "cancelado",
    });
    expect(html).toContain("PAGAMENTO CANCELADO");
    expect(html).not.toContain("data-pay");
  });

  it("agendamento pendente sem pagamento → botão PAGAR", () => {
    const html = pagamentoAcoesHtml(base);
    expect(html).toContain("data-pay");
  });

  it("agendamento pendente com pagamento pendente → botão PAGAR", () => {
    const html = pagamentoAcoesHtml({ ...base, pagamentoStatus: "pendente" });
    expect(html).toContain("data-pay");
  });

  it("agendamento pendente com pagamento recusado/expirado → botão PAGAR (comportamento não alterado)", () => {
    expect(pagamentoAcoesHtml({ ...base, pagamentoStatus: "recusado" })).toContain("data-pay");
    expect(pagamentoAcoesHtml({ ...base, pagamentoStatus: "expirado" })).toContain("data-pay");
  });

  it("agendamento confirmado sem pagamento/NENHUM botão PAGAR, mantém REAGENDAR e Cancelar", () => {
    const html = pagamentoAcoesHtml({ ...base, status: "confirmado" });
    expect(html).not.toContain("data-pay");
    expect(html).toContain("data-reschedule");
    expect(html).toContain("data-cancel");
  });

  it("REAGENDAR e Cancelar permanecem em todos os ramos de pagamento", () => {
    for (const pagamentoStatus of ["aprovado", "cancelado", "pendente", null]) {
      const html = pagamentoAcoesHtml({
        ...base,
        pagamentoStatus: pagamentoStatus as "aprovado" | "cancelado" | "pendente" | null,
      });
      expect(html).toContain("data-reschedule");
      expect(html).toContain("data-cancel");
    }
  });

  it("nunca renderiza badge pendente na coluna Ações (pendente é comportamento via botão)", () => {
    const html = pagamentoAcoesHtml({ ...base, pagamentoStatus: "pendente" });
    expect(html).not.toContain("PAGAMENTO PENDENTE");
  });
});
