import { describe, expect, it } from "vitest";
import {
  devePerguntarPagamentoPresencial,
  opcoesDialogoPagamentoPresencial,
} from "../ui/concluirPagamento.js";

/* ------------------------------------------------------------------ */
/*  devePerguntarPagamentoPresencial — decisão pura da Recepção        */
/*  Regra: papel recepcionista E pagamento ≠ "aprovado" (inclui         */
/*  null/undefined/pendente/recusado/cancelado/expirado) → pergunta    */
/*  "O cliente pagou?"; recepcionista + aprovado → não pergunta;       */
/*  admin/profissional/cliente → não pergunta (só a Recepção opera      */
/*  pagamento presencial no balcão).                                    */
/* ------------------------------------------------------------------ */
describe("devePerguntarPagamentoPresencial", () => {
  it("recepcionista + sem pagamento (null) → pergunta", () => {
    expect(devePerguntarPagamentoPresencial("recepcionista", null)).toBe(true);
  });

  it("recepcionista + pagamento ausente (undefined) → pergunta", () => {
    expect(devePerguntarPagamentoPresencial("recepcionista", undefined)).toBe(true);
  });

  it("recepcionista + pendente → pergunta", () => {
    expect(devePerguntarPagamentoPresencial("recepcionista", "pendente")).toBe(true);
  });

  it("recepcionista + recusado → pergunta", () => {
    expect(devePerguntarPagamentoPresencial("recepcionista", "recusado")).toBe(true);
  });

  it("recepcionista + cancelado → pergunta", () => {
    expect(devePerguntarPagamentoPresencial("recepcionista", "cancelado")).toBe(true);
  });

  it("recepcionista + expirado → pergunta", () => {
    expect(devePerguntarPagamentoPresencial("recepcionista", "expirado")).toBe(true);
  });

  it("recepcionista + aprovado → NÃO pergunta (já pago; evita dupla cobrança)", () => {
    expect(devePerguntarPagamentoPresencial("recepcionista", "aprovado")).toBe(false);
  });

  it("admin → NÃO pergunta (com ou sem pagamento)", () => {
    expect(devePerguntarPagamentoPresencial("admin", null)).toBe(false);
    expect(devePerguntarPagamentoPresencial("admin", undefined)).toBe(false);
    expect(devePerguntarPagamentoPresencial("admin", "pendente")).toBe(false);
    expect(devePerguntarPagamentoPresencial("admin", "aprovado")).toBe(false);
  });

  it("profissional → NÃO pergunta", () => {
    expect(devePerguntarPagamentoPresencial("profissional", null)).toBe(false);
    expect(devePerguntarPagamentoPresencial("profissional", "pendente")).toBe(false);
    expect(devePerguntarPagamentoPresencial("profissional", "aprovado")).toBe(false);
  });

  it("cliente → NÃO pergunta", () => {
    expect(devePerguntarPagamentoPresencial("cliente", null)).toBe(false);
    expect(devePerguntarPagamentoPresencial("cliente", "recusado")).toBe(false);
    expect(devePerguntarPagamentoPresencial("cliente", "aprovado")).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/*  opcoesDialogoPagamentoPresencial — amarração do diálogo bloqueante  */
/*  O diálogo "O cliente pagou?" não pode ser fechado por X/ESC/backdrop: */
/*  a única saída é Sim ou Não. `blocking: true` faz o confirmDialog      */
/*  remover o X, ignorar o backdrop e bloquear o ESC (dataset.blocking).  */
/* ------------------------------------------------------------------ */
describe("opcoesDialogoPagamentoPresencial", () => {
  it("retorna um diálogo BLOQUEANTE (blocking: true) — sem terceiro estado", () => {
    expect(opcoesDialogoPagamentoPresencial()).toMatchObject({ blocking: true });
  });

  it("expõe exatamente as duas saídas: Sim (confirmar) e Não (cancelar)", () => {
    const opcoes = opcoesDialogoPagamentoPresencial();
    expect(opcoes.confirmLabel).toBe("Sim");
    expect(opcoes.cancelLabel).toBe("Não");
  });

  it("usa o título e a mensagem da pergunta de pagamento no balcão", () => {
    const opcoes = opcoesDialogoPagamentoPresencial();
    expect(opcoes.title).toBe("O cliente pagou?");
    expect(opcoes.message).toContain("pagou no balcão");
  });
});