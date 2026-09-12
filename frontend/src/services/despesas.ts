/**
 * Estado em memória de despesas do salão.
 *
 * Mock local: as despesas são persistidas apenas durante a sessão da SPA.
 * Persistência real depende de endpoint de despesas do Backend (pendência
 * registrada). Aqui os dados servem apenas à experiência do Frontend.
 *
 * Fonte de verdade compartilhada entre a tela Financeiro (CRUD) e o
 * Dashboard do Administrador (cálculos de lucro / margem).
 */

export interface Despesa {
  id: string;
  descricao: string;
  categoria: string;
  valor: number;
  /** Data no formato ISO (YYYY-MM-DD). */
  data: string;
  recorrente: boolean;
}

export const DESPESA_CATEGORIAS = [
  "INSUMOS",
  "EQUIPAMENTOS",
  "ALUGUEL",
  "FUNCIONÁRIOS",
  "MARKETING",
  "UTILIDADES",
  "MANUTENÇÃO",
  "OUTROS",
] as const;

export type DespesaCategoria = (typeof DESPESA_CATEGORIAS)[number];

/* ------------------------------------------------------------------------ */
/*  Estado em memória                                                       */
/* ------------------------------------------------------------------------ */

let despesas: Despesa[] = [
  { id: "d1", descricao: "ALUGUEL DO SALAO (SETEMBRO)", categoria: "ALUGUEL", valor: 1800, data: "2026-09-01", recorrente: true },
  { id: "d2", descricao: "FOLHA DE PAGAMENTO — EQUIPE", categoria: "FUNCIONÁRIOS", valor: 6800, data: "2026-09-05", recorrente: true },
  { id: "d3", descricao: "COMPRA DE POMADAS E FINALIZADORES", categoria: "INSUMOS", valor: 320.5, data: "2026-09-08", recorrente: false },
  { id: "d4", descricao: "AGUA E LUZ DO SALAO", categoria: "UTILIDADES", valor: 410, data: "2026-09-10", recorrente: true },
  { id: "d5", descricao: "MANUTENCAO DA CADEIRA DE CORTE", categoria: "MANUTENÇÃO", valor: 150, data: "2026-09-12", recorrente: false },
];

let seq = despesas.length + 1;

/* ------------------------------------------------------------------------ */
/*  API pública do módulo                                                    */
/* ------------------------------------------------------------------------ */

/** Retorna uma cópia da lista completa (evita mutação externa). */
export function listarDespesas(): Despesa[] {
  return [...despesas];
}

/** Retorna despesas cuja `data` está no intervalo [inicio, fim] (ambos ISO). */
export function despesasNoPeriodo(inicio: string, fim: string): Despesa[] {
  return despesas.filter((d) => {
    if (inicio && d.data < inicio) return false;
    if (fim && d.data > fim) return false;
    return true;
  });
}

/** Retorna despesas cuja data começa com `ano` (ex.: "2026"). */
export function despesasNoAno(ano: number): Despesa[] {
  const prefix = String(ano);
  return despesas.filter((d) => d.data.startsWith(prefix));
}

/** Retorna despesas cuja data começa com `ano-mes` (ex.: "2026-09"). */
export function despesasNoMes(ano: number, mes: number): Despesa[] {
  const prefix = `${ano}-${String(mes).padStart(2, "0")}`;
  return despesas.filter((d) => d.data.startsWith(prefix));
}

/**
 * Soma dos valores das despesas no período informado.
 * Útil para cálculos de lucro / margem no Dashboard.
 */
export function somaDespesas(lista: Despesa[]): number {
  return lista.reduce((acc, d) => acc + d.valor, 0);
}

/**
 * Calcula o total de despesas de acordo com o filtro temporal ativo do
 * dashboard. Ignora filtro de profissional (despesas não têm vínculo).
 */
export function totalDespesasFiltro(opts: {
  mode: "todos" | "ano" | "mes" | "periodo";
  ano: number;
  mes: number;
  inicio: string;
  fim: string;
}): number {
  let lista: Despesa[];
  switch (opts.mode) {
    case "ano":
      lista = despesasNoAno(opts.ano);
      break;
    case "mes":
      lista = despesasNoMes(opts.ano, opts.mes);
      break;
    case "periodo":
      lista = despesasNoPeriodo(opts.inicio, opts.fim);
      break;
    default:
      lista = despesas;
      break;
  }
  return somaDespesas(lista);
}

/** Cria uma nova despesa e a adiciona ao início da lista. */
export function criarDespesa(dados: Omit<Despesa, "id">): Despesa {
  const nova: Despesa = {
    ...dados,
    id: `desp-${Date.now()}-${seq++}`,
  };
  despesas.unshift(nova);
  return nova;
}

/** Remove uma despesa pelo id. Retorna `true` se removida, `false` se não encontrada. */
export function removerDespesa(id: string): boolean {
  const idx = despesas.findIndex((d) => d.id === id);
  if (idx === -1) return false;
  despesas.splice(idx, 1);
  return true;
}
