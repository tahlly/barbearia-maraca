import {
  listarExcecoes as listarExcecoesRepo,
  buscarExcecaoPorId,
  buscarFuncionarioPorId,
  buscarFuncionarioPorUsuarioId,
  criarExcecao as criarExcecaoRepo,
  atualizarExcecao as atualizarExcecaoRepo,
  excluirExcecao as excluirExcecaoRepo,
  type ListarExcecoesParams,
} from '../repositories/horario-excecao-repository';
import type {
  HorarioExcecao,
  CreateHorarioExcecaoInput,
  UpdateHorarioExcecaoInput,
  TipoExcecaoHorario,
} from '../dtos/horario-excecao-dto';
import type { FuncionarioMin } from '../dtos/horario-dto';
import { NotFoundError } from '../errors/NotFoundError';
import { ValidationError } from '../errors/ValidationError';
import { ForbiddenError } from '../errors/ForbiddenError';
import { formatarData, formatarHora } from '../utils/formatadores';

export interface ReqUser {
  id: string;
  tipo: string;
  role: string;
}

// Papéis com acesso à gestão de agenda (escrita/edição de exceções de horário).
const PAPEIS_AGENDA = ['profissional', 'recepcionista', 'admin'];

export interface ListarExcecoesFiltros {
  funcionario_id?: string;
  data?: string;
  tipo?: TipoExcecaoHorario;
}

/**
 * Normaliza os campos de data/hora de um HorarioExcecao: data ("YYYY-MM-DD"
 * a partir de Date do driver PG) e horas cortando segundos ("HH:MM:SS" → "HH:MM").
 */
function normalizarExcecao(e: HorarioExcecao): HorarioExcecao {
  return {
    ...e,
    data: formatarData(e.data),
    hora_inicio: formatarHora(e.hora_inicio),
    hora_fim: formatarHora(e.hora_fim),
  };
}

function compararHoras(inicio: string, fim: string): number {
  const [ih, im, is = '00'] = inicio.split(':');
  const [fh, fm, fs = '00'] = fim.split(':');
  const a = Number(ih) * 3600 + Number(im) * 60 + Number(is);
  const b = Number(fh) * 3600 + Number(fm) * 60 + Number(fs);

  // Defesa contra comparação com NaN (ex.: string não numérica). Sem isso,
  // "NaN <= 0" é false e um intervalo inválido passaria silenciosamente.
  if (Number.isNaN(a) || Number.isNaN(b)) {
    throw new ValidationError('hora_inicio e hora_fim devem estar no formato HH:MM');
  }

  return a - b;
}

function validarIntervalo(inicio: string, fim: string): void {
  if (compararHoras(fim, inicio) <= 0) {
    throw new ValidationError('hora_fim deve ser maior que hora_inicio');
  }
}

async function resolverFuncionarioDoUsuario(
  usuarioId: string
): Promise<FuncionarioMin> {
  const funcionario = await buscarFuncionarioPorUsuarioId(usuarioId);
  if (!funcionario) {
    throw new ForbiddenError('Usuário não vinculado a um funcionário');
  }
  return funcionario;
}

// RBAC de agenda (mesmo padrão de horario-service):
// - profissional (barbeiro) SÓ pode operar na própria agenda (funcionario_id = seu);
// - recepcionista/admin podem operar em qualquer agenda;
// - cliente não possui acesso às exceções de horário.
async function garantirAcessoAgenda(
  user: ReqUser,
  funcionarioId: string
): Promise<void> {
  if (!PAPEIS_AGENDA.includes(user.role)) {
    throw new ForbiddenError('Acesso negado: papel sem permissão de gestão de exceções de horário');
  }
  if (user.role === 'profissional') {
    const proprio = await resolverFuncionarioDoUsuario(user.id);
    if (proprio.id !== funcionarioId) {
      throw new ForbiddenError('Acesso negado: não é possível operar na agenda de outro profissional');
    }
  }
}

export async function listarExcecoes(
  user: ReqUser,
  filtros: ListarExcecoesFiltros
): Promise<HorarioExcecao[]> {
  if (!PAPEIS_AGENDA.includes(user.role)) {
    throw new ForbiddenError('Acesso negado: papel sem permissão de gestão de exceções de horário');
  }

  let params: ListarExcecoesParams = {
    funcionarioId: filtros.funcionario_id,
    data: filtros.data,
    tipo: filtros.tipo,
  };

  if (user.role === 'profissional') {
    const proprio = await resolverFuncionarioDoUsuario(user.id);
    params = {
      funcionarioId: proprio.id,
      data: filtros.data,
      tipo: filtros.tipo,
    };
  }

  return listarExcecoesRepo(params).then((rows) => rows.map(normalizarExcecao));
}

export async function criarExcecao(
  user: ReqUser,
  data: CreateHorarioExcecaoInput
): Promise<HorarioExcecao> {
  await garantirAcessoAgenda(user, data.funcionario_id);

  validarIntervalo(data.hora_inicio, data.hora_fim);

  const funcionario = await buscarFuncionarioPorId(data.funcionario_id);
  if (!funcionario) {
    throw new NotFoundError('Funcionário não encontrado');
  }

  return criarExcecaoRepo(data).then(normalizarExcecao);
}

export async function atualizarExcecao(
  user: ReqUser,
  id: string,
  data: UpdateHorarioExcecaoInput
): Promise<HorarioExcecao> {
  const existente = await buscarExcecaoPorId(id);
  if (!existente) {
    throw new NotFoundError('Exceção de horário não encontrada');
  }

  await garantirAcessoAgenda(user, existente.funcionario_id);

  const horaInicio = data.hora_inicio ?? existente.hora_inicio;
  const horaFim = data.hora_fim ?? existente.hora_fim;
  validarIntervalo(horaInicio, horaFim);

  return atualizarExcecaoRepo(id, data).then(normalizarExcecao);
}

export async function excluirExcecao(user: ReqUser, id: string): Promise<void> {
  const existente = await buscarExcecaoPorId(id);
  if (!existente) {
    throw new NotFoundError('Exceção de horário não encontrada');
  }

  await garantirAcessoAgenda(user, existente.funcionario_id);

  await excluirExcecaoRepo(id);
}
