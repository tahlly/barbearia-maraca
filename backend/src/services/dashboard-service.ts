import type {
  DashboardGraficosDTO,
  DistribuicaoStatusDTO,
  HorarioPicoDTO,
  ServicoMaisVendidoDTO,
} from '../dtos/dashboard-dto';
import {
  contarAgendamentosPorDia,
  contarAgendamentosPorHora,
  contarAgendamentosPorStatus,
} from '../repositories/dashboard-repository';
import { resumirFaturamento } from '../repositories/agendamento-repository';
import { exigirPermissao } from './permissao-service';
import { formatarData, formatarHora } from '../utils/formatadores';
import { validarIntervaloData } from '../utils/validadores';
import { ValidationError } from '../errors/ValidationError';

const STATUS_AGENDAMENTO = ['pendente', 'confirmado', 'cancelado', 'concluido'] as const;
type StatusKey = (typeof STATUS_AGENDAMENTO)[number];

/** Valida o parâmetro `dias` (7 ou 30) e devolve o valor numérico. */
function validarDias(dias: number | undefined): number {
  if (dias === undefined) {
    return 7; // default: últimos 7 dias (mesmo default das telas atuais)
  }
  if (dias !== 7 && dias !== 30) {
    throw new ValidationError('dias deve ser 7 ou 30');
  }
  return dias;
}

/**
 * Janela de calendário dos últimos `dias` dias, terminando HOJE
 * (ambos os extremos inclusivos). Usa somente a parte de data local do
 * servidor, mesmo padrão de `formatarData`.
 */
function janelaUltimosDias(dias: number): { inicio: string; fim: string } {
  const hoje = new Date();
  const inicio = new Date(hoje);
  inicio.setDate(inicio.getDate() - (dias - 1));
  return { inicio: formatarData(inicio), fim: formatarData(hoje) };
}

/** Lista todas as datas YYYY-MM-DD entre `inicio` e `fim` (inclusivas). */
function listarDatasEntre(inicio: string, fim: string): string[] {
  const datas: string[] = [];
  const atual = new Date(`${inicio}T00:00:00Z`);
  const ultimo = new Date(`${fim}T00:00:00Z`);
  while (atual <= ultimo) {
    datas.push(atual.toISOString().slice(0, 10));
    atual.setUTCDate(atual.getUTCDate() + 1);
  }
  return datas;
}

/**
 * Gráficos do Dashboard (seção 3.1) — agrupamentos BRUTOS:
 *
 * - `distribuicaoStatus`: contagem por status do enum `status_agendamento`.
 *   O mapa SEMPRE contém as 4 chaves. NÃO agrupa status visualmente
 *   (ex.: confirmado + pendente) — a decisão de renderização é do Frontend.
 * - `agendamentosPorDia`: contagem por dia na janela `dias` (7 ou 30),
 *   terminando em HOJE, com zero para dias sem agendamento.
 * - `horariosPico`: contagem por slot de 30 minutos da coluna `hora` (time),
 *   extraindo HH:MM real — sem arredondar para hora cheia.
 * - `servicosMaisVendidos`: reusa `resumirFaturamento` (agendamentos
 *   CONCLUÍDOS), contando por serviço e ordenando do mais vendido.
 *
 * Acesso: permissão efetiva `ver_financeiro` (negação por padrão).
 * O período base (`inicio`/`fim`, default ano corrente) rege todos os
 * gráficos, exceto `agendamentosPorDia`, que usa a janela própria `dias`.
 */
export async function obterGraficosDashboard(
  usuarioId: string,
  role: string,
  filtros: { inicio?: string; fim?: string; dias?: number },
): Promise<DashboardGraficosDTO> {
  // Defesa em profundidade: mesmo com o middleware `requerPermissao` na rota,
  // a service revalida a permissão efetiva antes de tocar os dados.
  await exigirPermissao({ id: usuarioId, role }, 'ver_financeiro');

  const dias = validarDias(filtros.dias);

  const anoAtual = new Date().getFullYear();
  const inicio = filtros.inicio ?? `${anoAtual}-01-01`;
  const fim = filtros.fim ?? `${anoAtual}-12-31`;
  validarIntervaloData(inicio, fim);

  const janela = janelaUltimosDias(dias);

  const [statusRows, diaRows, horaRows, faturamento] = await Promise.all([
    contarAgendamentosPorStatus({ inicio, fim }),
    contarAgendamentosPorDia({ inicio: janela.inicio, fim: janela.fim }),
    contarAgendamentosPorHora({ inicio, fim }),
    resumirFaturamento({ inicio, fim }),
  ]);

  // Distribuição por status: sempre as 4 chaves, com 0 preenchido.
  const distribuicaoStatus = {} as DistribuicaoStatusDTO;
  for (const status of STATUS_AGENDAMENTO) {
    distribuicaoStatus[status] = 0;
  }
  for (const row of statusRows) {
    const key = row.status as StatusKey;
    if (key in distribuicaoStatus) {
      distribuicaoStatus[key] = Number(row.quantidade);
    }
  }

  // Agendamentos por dia: preenche zero para dias sem agendamento na janela.
  const contagemPorDia = new Map<string, number>(
    diaRows.map((row) => [formatarData(row.data), Number(row.quantidade)]),
  );
  const agendamentosPorDia = {
    inicio: janela.inicio,
    fim: janela.fim,
    dias: listarDatasEntre(janela.inicio, janela.fim).map((data) => ({
      data,
      quantidade: contagemPorDia.get(data) ?? 0,
    })),
  };

  // Horários de pico, por slot de 30 minutos (HH:MM real).
  const horariosPico: HorarioPicoDTO[] = horaRows.map((row) => ({
    hora: formatarHora(row.hora),
    quantidade: Number(row.quantidade),
  }));

  // Serviços mais vendidos: reusa o porServico de resumirFaturamento
  // (já conta apenas agendamentos concluídos no período) e ordena por
  // quantidade decrescente para o gráfico de barras horizontais.
  const servicosMaisVendidos: ServicoMaisVendidoDTO[] = faturamento.porServico
    .map((item) => ({
      servicoId: item.servicoId,
      servicoNome: item.servicoNome,
      quantidade: Number(item.quantidade),
    }))
    .sort((a, b) => b.quantidade - a.quantidade);

  return { inicio, fim, distribuicaoStatus, agendamentosPorDia, horariosPico, servicosMaisVendidos };
}