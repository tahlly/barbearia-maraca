import { afterEach, describe, expect, it, vi } from "vitest";
import { concludeAppointment } from "../services/booking";

const dtoConcluido = {
  id: "a1",
  clienteId: "c1",
  clienteNome: "Cliente Teste",
  funcionarioId: "f1",
  funcionarioNome: "Barbeiro",
  servicoId: "s1",
  servicoNome: "Corte",
  data: "2026-09-17",
  hora: "10:00",
  status: "concluido",
  observacao: null,
  pagamentoStatus: "pendente",
};

function mockFetchJson(body: unknown): ReturnType<typeof vi.fn> {
  return vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => body,
  }));
}

/* ------------------------------------------------------------------ */
/*  concludeAppointment — PATCH /api/agendamentos/:id/concluir         */
/*  Corpo OPCIONAL desde o contrato aprovado:                          */
/*  { "registrar_pagamento_presencial": true } (somente recep).        */
/* ------------------------------------------------------------------ */
describe("concludeAppointment — PATCH /api/agendamentos/:id/concluir", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sem opções → PATCH SEM body (comportamento atual inalterado)", async () => {
    const fetchMock = mockFetchJson(dtoConcluido);
    vi.stubGlobal("fetch", fetchMock);

    const result = await concludeAppointment("a1");

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/agendamentos/a1/concluir",
      expect.not.objectContaining({ body: expect.anything() }),
    );
    expect(result.status).toBe("concluido");
    expect(result.id).toBe("a1");
  });

  it("com registrarPagamentoPresencial: true → envia o corpo { registrar_pagamento_presencial: true }", async () => {
    const fetchMock = mockFetchJson({ ...dtoConcluido, pagamentoStatus: "aprovado" });
    vi.stubGlobal("fetch", fetchMock);

    const result = await concludeAppointment("a1", { registrarPagamentoPresencial: true });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/agendamentos/a1/concluir",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ registrar_pagamento_presencial: true }),
      }),
    );
    // A resposta do backend reflete o novo pagamento aprovado no agendamento.
    expect(result.pagamentoStatus).toBe("aprovado");
  });

  it("com registrarPagamentoPresencial: false → PATCH sem body (mesmo que sem opções)", async () => {
    const fetchMock = mockFetchJson(dtoConcluido);
    vi.stubGlobal("fetch", fetchMock);

    await concludeAppointment("a1", { registrarPagamentoPresencial: false });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/agendamentos/a1/concluir",
      expect.not.objectContaining({ body: expect.anything() }),
    );
  });

  it("codifica o id na URL (encodeURIComponent)", async () => {
    const fetchMock = mockFetchJson(dtoConcluido);
    vi.stubGlobal("fetch", fetchMock);

    await concludeAppointment("a/b", { registrarPagamentoPresencial: true });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/agendamentos/a%2Fb/concluir",
      expect.objectContaining({ method: "PATCH" }),
    );
  });
});