/**
 * Camada de integração de Despesas do módulo financeiro.
 *
 * Agora consome a API real do Backend (PR #76 / feat/modulo-financeiro-comissao):
 * - `GET /api/despesas`      → listagem (filtros opcionais inicio+fim, tipo)
 * - `POST /api/despesas`     → criação manual (tipo_despesa NUNCA comissao)
 * - `DELETE /api/despesas/:id` → exclusão manual (automatica/comissao é bloqueada)
 * - `GET /api/despesas/resumo` → soma de despesas de um período
 *
 * Valores monetários vêm do Backend como strings decimais normalizadas
 * ("45.90"); convertidos para `number` na origem do dado, já que o resto do
 * Frontend (formatCurrency) trabalha com number.
 */

import { apiFetch, httpJson } from "./api.js";

export type TipoDespesa = "fixa" | "variavel" | "comissao" | "outro";

/** Tipos que o usuário pode escolher manualmente (Comissão é 100% automática). */
export const TIPO_DESPESA_MANUAL: readonly Exclude<TipoDespesa, "comissao">[] = [
  "fixa",
  "variavel",
  "outro",
] as const;

export const TIPO_DESPESA_LABEL: Record<TipoDespesa, string> = {
  fixa: "FIXA",
  variavel: "VARIÁVEL",
  comissao: "COMISSÃO",
  outro: "OUTRO",
};

/** Despesa exibida na tela (modelo de leitura, já com valor numérico). */
export interface Despesa {
  id: string;
  descricao: string;
  tipo_despesa: TipoDespesa;
  /** Valor em reais (convertido da string decimal do Backend). */
  valor: number;
  /** Data do lançamento (YYYY-MM-DD). */
  data: string;
  recorrente: boolean;
  /** `true` quando gerada automaticamente (comissão) — não pode ser excluída. */
  automatica: boolean;
}

interface DespesaDTO {
  id: string;
  descricao: string;
  tipo_despesa: TipoDespesa;
  valor: string;
  data: string;
  recorrente: boolean;
  funcionario_id: string | null;
  automatica: boolean;
}

interface DespesaResumoDTO {
  inicio: string;
  fim: string;
  despesaTotal: string;
}

function toDespesa(dto: DespesaDTO): Despesa {
  return {
    id: dto.id,
    descricao: dto.descricao,
    tipo_despesa: dto.tipo_despesa,
    valor: Number(dto.valor),
    data: dto.data,
    recorrente: dto.recorrente,
    automatica: dto.automatica,
  };
}

/** Corpo recebido no POST (valores já validados na tela). */
export interface NovaDespesa {
  descricao: string;
  tipo_despesa: Exclude<TipoDespesa, "comissao">;
  /** Valor em reais. */
  valor: number;
  data: string;
  recorrente: boolean;
}

/** Lista todas as despesas (o Backend ordena por data, mais recentes primeiro). */
export async function listarDespesas(): Promise<Despesa[]> {
  const dtos = await httpJson<DespesaDTO[]>("/despesas");
  return dtos.map(toDespesa);
}

/** Cria uma despesa manual no Backend e devolve a despesa persistida. */
export async function criarDespesa(dados: NovaDespesa): Promise<Despesa> {
  const dto = await httpJson<DespesaDTO>("/despesas", {
    method: "POST",
    body: JSON.stringify({
      descricao: dados.descricao,
      tipo_despesa: dados.tipo_despesa,
      valor: Number(dados.valor.toFixed(2)),
      data: dados.data,
      recorrente: dados.recorrente,
    }),
  });
  return toDespesa(dto);
}

/** Exclui uma despesa manual. Retorna `false` se o Backend recusar (ex.: automática). */
export async function removerDespesa(id: string): Promise<boolean> {
  const res = await apiFetch(`/despesas/${encodeURIComponent(id)}`, { method: "DELETE" });
  if (!res.ok) {
    return false;
  }
  return true;
}

/** Soma das despesas de um período via `GET /api/despesas/resumo`. */
async function somarDespesasPeriodo(inicio?: string, fim?: string): Promise<number> {
  const params = new URLSearchParams();
  if (inicio) params.set("inicio", inicio);
  if (fim) params.set("fim", fim);
  const qs = params.toString();
  const dto = await httpJson<DespesaResumoDTO>(`/despesas/resumo${qs ? `?${qs}` : ""}`);
  return Number(dto.despesaTotal);
}

/** Último dia do mês no formato ISO. */
function ultimoDiaDoMes(ano: number, mes: number): string {
  const ultimo = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  return `${String(ano).padStart(4, "0")}-${String(mes).padStart(2, "0")}-${String(ultimo).padStart(2, "0")}`;
}

/**
 * Total de despesas conforme o filtro temporal ativo do dashboard.
 * Ignora filtro de profissional (despesas não têm vínculo com profissional).
 * "todos" soma a listagem completa; os demais usam o resumo por período.
 */
export async function totalDespesasFiltro(opts: {
  mode: "todos" | "ano" | "mes" | "periodo";
  ano: number;
  mes: number;
  inicio: string;
  fim: string;
}): Promise<number> {
  switch (opts.mode) {
    case "ano": {
      const ano = opts.ano;
      return somarDespesasPeriodo(`${ano}-01-01`, `${ano}-12-31`);
    }
    case "mes": {
      return somarDespesasPeriodo(
        `${opts.ano}-${String(opts.mes).padStart(2, "0")}-01`,
        ultimoDiaDoMes(opts.ano, opts.mes),
      );
    }
    case "periodo": {
      const temInicio = opts.inicio.trim() !== "";
      const temFim = opts.fim.trim() !== "";
      if (!temInicio && !temFim) return somarDespesasPeriodo();
      return somarDespesasPeriodo(temInicio ? opts.inicio : undefined, temFim ? opts.fim : undefined);
    }
    default: {
      const lista = await listarDespesas();
      return lista.reduce((acc, d) => acc + d.valor, 0);
    }
  }
}