import { afterEach, describe, expect, it, vi } from "vitest";
import { reschedule } from "../services/booking";

const dtoReagendado = {
  id: "a1",
  clienteId: "c1",
  clienteNome: "Cliente Teste",
  funcionarioId: "f1",
  funcionarioNome: "Barbeiro",
  servicoId: "s1",
  servicoNome: "Corte",
  data: "2026-09-20",
  hora: "15:00",
  status: "pendente",
  observacao: null,
  // Regra de negócio: reagendar NÃO altera o pagamento existente.
  pagamentoStatus: "aprovado",
};

function mockFetchJson(body: unknown): ReturnType<typeof vi.fn> {
  return vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => body,
  }));
}

/* ------------------------------------------------------------------ */
/*  reschedule — PATCH /api/agendamentos/:id/reagendar                 */
/* ------------------------------------------------------------------ */
describe("reschedule — PATCH /api/agendamentos/:id/reagendar", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("chama PATCH /api/agendamentos/:id/reagendar com body data/hora/timezone e devolve { appointment } mapeado", async () => {
    const fetchMock = mockFetchJson(dtoReagendado);
    vi.stubGlobal("fetch", fetchMock);

    const result = await reschedule("a1", {
      data: "2026-09-20",
      hora: "15:00",
      timezoneOffsetMinutes: -180,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/agendamentos/a1/reagendar",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({
          data: "2026-09-20",
          hora: "15:00",
          timezone_offset_minutes: -180,
        }),
      }),
    );
    expect(result.appointment.id).toBe("a1");
    expect(result.appointment.data).toBe("2026-09-20");
    expect(result.appointment.hora).toBe("15:00");
    expect(result.appointment.status).toBe("pendente");
    expect(result.appointment.servicoId).toBe("s1");
    expect(result.appointment.funcionarioId).toBe("f1");
    // Reagendar preserva o status de pagamento: não zera nem recria o pagamento.
    expect(result.appointment.pagamentoStatus).toBe("aprovado");
  });

  it("envia timezone_offset_minutes null quando timezoneOffsetMinutes é undefined", async () => {
    const fetchMock = mockFetchJson(dtoReagendado);
    vi.stubGlobal("fetch", fetchMock);

    await reschedule("a1", { data: "2026-09-20", hora: "15:00" });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/agendamentos/a1/reagendar",
      expect.objectContaining({
        body: JSON.stringify({
          data: "2026-09-20",
          hora: "15:00",
          timezone_offset_minutes: null,
        }),
      }),
    );
  });

  it("codifica o id na URL (encodeURIComponent)", async () => {
    const fetchMock = mockFetchJson(dtoReagendado);
    vi.stubGlobal("fetch", fetchMock);

    await reschedule("a/b", {
      data: "2026-09-20",
      hora: "15:00",
      timezoneOffsetMinutes: -180,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/agendamentos/a%2Fb/reagendar",
      expect.objectContaining({ method: "PATCH" }),
    );
  });

  it("NÃO cancela o agendamento original (nenhum PATCH .../cancelar é chamado)", async () => {
    const fetchMock = mockFetchJson(dtoReagendado);
    vi.stubGlobal("fetch", fetchMock);

    await reschedule("a1", {
      data: "2026-09-20",
      hora: "15:00",
      timezoneOffsetMinutes: -180,
    });

    const calls = fetchMock.mock.calls.map(([url, init]) => ({
      url: String(url),
      method: (init as RequestInit | undefined)?.method ?? "GET",
    }));
    // Exatamente UMA requisição: PATCH no /reagendar (sem POST de criação).
    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual({ url: "/api/agendamentos/a1/reagendar", method: "PATCH" });
    // O agendamento original NÃO é cancelado neste fluxo.
    expect(calls.some((c) => c.url.includes("/cancelar"))).toBe(false);
  });
});