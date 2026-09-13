import type {
  PainelBarbeiroDTO,
  PainelBarbeiroComissaoDTO,
  PainelBarbeiroServicoDTO,
  PainelBarbeiroHorarioDTO,
} from '../dtos/painel-barbeiro-dto';
import {
  contarAgendamentosPorDia,
  contarAgendamentosPorHora,
} from '../repositories/dashboard-repository';
import { resumirFaturamento } from '../repositories/agendamento-repository';
import { buscarConfiguracaoComissao } from '../repositories/comissao-repository';
import { somarComissaoFuncionarioPeriodo } from '../repositories/despesa-repository';
import { buscarFuncionarioPorUsuarioId } from '../repositories/horario-repository';
import { formatarData, formatarHora } from '../utils/formatadores';
import { paraCentavos, normalizarDecimal } from '../utils/dinheiro';
import { ForbiddenError } from '../errors/ForbiddenError';

/**
 * Janela de calendário dos últimos `dias` dias, terminando HOJE
 * (ambos os extremos inclusivos). Usa somente a parte de data local do
 * servidor, mesmo padrão de `formatarData` (igual ao dashboard-service).
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

/** Primeiro e último dia do mês civil corrente (YYYY-MM-DD). */
function intervaloMesCorrente(): { inicio: string; fim: string } {
  const agora = new Date();
  const ano = agora.getFullYear();
  const mes = agora.getMonth() + 1; // 1–12
  const ultimoDia = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  return {
    inicio: `${ano}-${String(mes).padStart(2, '0')}-01`,
    fim: `${ano}-${String(mes).padStart(2, '0')}-${String(ultimoDia).padStart(2, '0')}`,
  };
}

/** Mês civil anterior completo (YYYY-MM-DD). */
function intervaloMesAnterior(): { inicio: string; fim: string } {
  const agora = new Date();
  const ano = agora.getFullYear();
  const mes = agora.getMonth(); // 0–11; mês civil anterior
  const anoAnterior = mes === 0 ? ano - 1 : ano;
  const mesAnterior = mes === 0 ? 12 : mes;
  const ultimoDia = new Date(Date.UTC(anoAnterior, mesAnterior, 0)).getUTCDate();
  return {
    inicio: `${anoAnterior}-${String(mesAnterior).padStart(2, '0')}-01`,
    fim: `${anoAnterior}-${String(mesAnterior).padStart(2, '0')}-${String(ultimoDia).padStart(2, '0')}`,
  };
}

/**
 * Variação relativa em % com 2 casas e sinal: ((atual − anterior) / anterior × 100).
 * Usa centavos (BigInt) para não perder precisão. `null` quando anterior = 0
 * (não há base de comparação — mesmo padrão do resumo-financeiro-service).
 */
function variacaoPercentual(atual: string, anterior: string): string | null {
  const ant = paraCentavos(anterior);
  if (ant === 0n) {
    return null;
  }
  const diff = paraCentavos(atual) - ant;
  const milhar = (diff * 10000n) / ant; // percentual × 100 (inteiro)
  const sinal = milhar < 0n ? '-' : '';
  const abs = milhar < 0n ? -milhar : milhar;
  const inteiro = (abs / 100n).toString();
  const frac = (abs % 100n).toString().padStart(2, '0');
  return `${sinal}${inteiro}.${frac}`;
}

/**
 * Painel do Barbeiro (spec: especificacao-painel-barbeiro.md).
 * Endpoint único `GET /api/painel-barbeiro` — os 5 elementos do "Meu Painel"
 * em uma única resposta (mesmo padrão de 1 round-trip do Dashboard/Resumo).
 *
 * REGRA DE DADOS (seção 2 da spec): TODOS os valores são filtrados
 * EXCLUSIVAMENTE pelo próprio profissional logado (`funcionario.id` resolvido
 * a partir do usuário autenticado) — nunca dado nominal de colega e nunca
 * faturamento/lucro da barbearia inteira.
 *
 * PERMISSÃO: acesso somente com papel `profissional`; NUNCA exige
 * `ver_financeiro` (a comissão própria é dado pessoal do profissional, não
 * informação de gestão da empresa).
 *
 * PERÍODOS (decisões registradas no contrato compartilhado):
 * - `atendimentosMes` (concluídos), `comissaoMes`, `servicosMaisFeitos` e
 *   `horariosMaisConcorridos` usam o MÊS CIVIL CORRENTE;
 * - a comissão compara com o MÊS CIVIL ANTERIOR completo (a tela fala em
 *   "mês", não em janela de dias);
 * - `atendimentosPorDia` usa a janela dos ÚLTIMOS 7 DIAS (terminando hoje),
 *   com zeros preenchidos — padrão do Dashboard administrativo.
 *
 * COMISSÃO CONDICIONAL: quando `comissao_ativa = false` (interruptor global
 * desligado, incl. linha singleton ausente), devolve `comissaoMes: null` e
 * NÃO consulta as somas do período (card não aparece na tela).
 */
export async function obterPainelBarbeiro(
  usuarioId: string,
  role: string,
): Promise<PainelBarbeiroDTO> {
  // Defesa em profundidade: mesmo com `authorize('profissional')` na rota, a
  // service revalida o papel antes de tocar os dados (padrão do projeto).
  if (role !== 'profissional') {
    throw new ForbiddenError('Acesso negado: painel é exclusivo do profissional');
  }

  // Resolve o funcionário a partir do USUÁRIO autenticado (nunca aceita
  // funcionario_id vindo do client — mesma regra de agendamento/horário).
  const funcionario = await buscarFuncionarioPorUsuarioId(usuarioId);
  if (!funcionario) {
    throw new ForbiddenError('Usuário não vinculado a um funcionário');
  }
  const funcionarioId = funcionario.id;

  const mesCorrente = intervaloMesCorrente();
  const mesAnterior = intervaloMesAnterior();
  const janela = janelaUltimosDias(7);

  const comissaoAtiva = (await buscarConfiguracaoComissao()) === true;

  // Consultas independentes em paralelo. As somas de comissão só são
  // consultadas quando o interruptor global está ATIVO (economia + o card
  // não existe com comissão desligada).
  const [faturamento, diaRows, horaRows, comissaoAtual, comissaoAnterior] =
    await Promise.all([
      resumirFaturamento({ funcionarioId, inicio: mesCorrente.inicio, fim: mesCorrente.fim }),
      contarAgendamentosPorDia({
        funcionarioId,
        inicio: janela.inicio,
        fim: janela.fim,
      }),
      contarAgendamentosPorHora({
        funcionarioId,
        inicio: mesCorrente.inicio,
        fim: mesCorrente.fim,
      }),
      comissaoAtiva
        ? somarComissaoFuncionarioPeriodo({
            funcionarioId,
            inicio: mesCorrente.inicio,
            fim: mesCorrente.fim,
          })
        : Promise.resolve('0'),
      comissaoAtiva
        ? somarComissaoFuncionarioPeriodo({
            funcionarioId,
            inicio: mesAnterior.inicio,
            fim: mesAnterior.fim,
          })
        : Promise.resolve('0'),
    ]);

  // Atendimentos por dia: preenche zero para dias sem atendimento na janela.
  const contagemPorDia = new Map<string, number>(
    diaRows.map((row) => [formatarData(row.data), Number(row.quantidade)]),
  );
  const atendimentosPorDia = listarDatasEntre(janela.inicio, janela.fim).map((data) => ({
    data,
    quantidade: contagemPorDia.get(data) ?? 0,
  }));

  // Serviços mais feitos: reusa o porServico de resumirFaturamento
  // (agendamentos concluídos do mês) e ordena por quantidade decrescente.
  const servicosMaisFeitos: PainelBarbeiroServicoDTO[] = faturamento.porServico
    .map((item) => ({
      servicoId: item.servicoId,
      servicoNome: item.servicoNome,
      quantidade: item.quantidade,
    }))
    .sort((a, b) => b.quantidade - a.quantidade);

  // Horários mais concorridos: mesma lógica do Dashboard (HH:MM real).
  const horariosMaisConcorridos: PainelBarbeiroHorarioDTO[] = horaRows.map((row) => ({
    hora: formatarHora(row.hora),
    quantidade: Number(row.quantidade),
  }));

  // Comissão condicional ao interruptor global.
  let comissaoMes: PainelBarbeiroComissaoDTO | null = null;
  if (comissaoAtiva) {
    comissaoMes = {
      valorAtual: normalizarDecimal(comissaoAtual),
      mesAnterior: normalizarDecimal(comissaoAnterior),
      variacaoPercentual: variacaoPercentual(comissaoAtual, comissaoAnterior),
    };
  }

  return {
    atendimentosMes: faturamento.quantidade,
    comissaoMes,
    atendimentosPorDia,
    servicosMaisFeitos,
    horariosMaisConcorridos,
  };
}