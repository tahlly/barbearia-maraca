import db from '../database/connection';
import type { AgendamentoStatus } from '../dtos/agendamento-dto';

// Repositório do Dashboard (gráficos da seção 3.1).
// Cada função devolve apenas as linhas agregadas do banco; o preenchimento de
// dias/status com zero e a montagem final dos DTOs acontecem na service.

export interface StatusContagemRow {
  status: AgendamentoStatus;
  quantidade: string | number;
}

export interface DiaContagemRow {
  data: Date | string;
  quantidade: string | number;
}

export interface HorarioContagemRow {
  hora: string;
  quantidade: string | number;
}

/**
 * Conta agendamentos por status em um período (`data` em `[inicio, fim]`).
 *
 * Retorna apenas os status que possuem agendamentos no período; a service
 * completa os status faltantes com 0 para o contrato devolver SEMPRE as
 * 4 chaves do enum. A decisão de agrupar status na visualização (ex.:
 * confirmado + pendente) é exclusiva do Frontend.
 */
export async function contarAgendamentosPorStatus(opcoes: {
  inicio: string;
  fim: string;
}): Promise<StatusContagemRow[]> {
  const rows = await db('agendamento')
    .select('status')
    .count({ quantidade: '*' })
    .whereBetween('data', [opcoes.inicio, opcoes.fim])
    .groupBy('status')
    .orderBy('status', 'asc');

  return rows as unknown as StatusContagemRow[];
}

/**
 * Conta agendamentos por data em um período (`data` em `[inicio, fim]`).
 *
 * Retorna apenas os dias com agendamento; a service preenche os demais dias
 * da janela com 0 (o gráfico de barras/linha espera o eixo completo).
 */
export async function contarAgendamentosPorDia(opcoes: {
  inicio: string;
  fim: string;
}): Promise<DiaContagemRow[]> {
  const rows = await db('agendamento')
    .select('data')
    .count({ quantidade: '*' })
    .whereBetween('data', [opcoes.inicio, opcoes.fim])
    .groupBy('data')
    .orderBy('data', 'asc');

  return rows as unknown as DiaContagemRow[];
}

/**
 * Conta agendamentos por slot de 30 minutos em um período.
 *
 * Agrupa pela hora de início REAL do agendamento — coluna `hora` (tipo
 * `time`, ex.: "09:30:00") — extraindo `HH:MM` com `LEFT(hora::text, 5)`.
 * Isso preserva o minuto real (ex.: "09:30" permanece "09:30") sem arredondar
 * para hora cheia; cada valor distinto de HH:MM vira um slot de 30 minutos.
 */
export async function contarAgendamentosPorHora(opcoes: {
  inicio: string;
  fim: string;
}): Promise<HorarioContagemRow[]> {
  const exprHora = db.raw("LEFT(hora::text, 5) as hora");
  const rows = await db('agendamento')
    .select(exprHora)
    .count({ quantidade: '*' })
    .whereBetween('data', [opcoes.inicio, opcoes.fim])
    .groupBy(db.raw("LEFT(hora::text, 5)"))
    .orderBy(db.raw("LEFT(hora::text, 5)"), 'asc');

  return rows as unknown as HorarioContagemRow[];
}