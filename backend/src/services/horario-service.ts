import {
  listarHorarios as listarHorariosRepo,
  buscarHorarioPorId,
  buscarFuncionarioPorUsuarioId,
  buscarFuncionarioPorId,
  criarHorario as criarHorarioRepo,
  atualizarHorario as atualizarHorarioRepo,
  excluirHorario as excluirHorarioRepo,
  type ListarHorariosParams,
} from '../repositories/horario-repository';
import { buscarHorariosOcupados } from '../repositories/agendamento-repository';
import type {
  HorarioTrabalho,
  CreateHorarioInput,
  UpdateHorarioInput,
  FuncionarioMin,
} from '../dtos/horario-dto';
import { NotFoundError } from '../errors/NotFoundError';
import { ValidationError } from '../errors/ValidationError';
import { ForbiddenError } from '../errors/ForbiddenError';
import { formatarHora } from '../utils/formatadores';

export interface ReqUser {
  id: string;
  tipo: string;
  role: string;
}

// Papéis com acesso à gestão de agenda (escrita/edição de horários).
const PAPEIS_AGENDA = ['profissional', 'recepcionista', 'admin'];

/**
 * Normaliza os campos de hora de um HorarioTrabalho, cortando segundos
 * do driver PG ("HH:MM:SS" → "HH:MM").
 */
function normalizarHorario(h: HorarioTrabalho): HorarioTrabalho {
  return {
    ...h,
    hora_inicio: formatarHora(h.hora_inicio),
    hora_fim: formatarHora(h.hora_fim),
  };
}

export interface ListarHorariosFiltros {
  funcionario_id?: string;
  dia_semana?: number;
}

/** Resposta do endpoint de disponibilidade. */
export interface DisponibilidadeFuncionario {
  horarios: HorarioTrabalho[];
  ocupados: string[];
}

function compararHoras(inicio: string, fim: string): number {
  const [ih, im, is = '00'] = inicio.split(':');
  const [fh, fm, fs = '00'] = fim.split(':');
  const a = Number(ih) * 3600 + Number(im) * 60 + Number(is);
  const b = Number(fh) * 3600 + Number(fm) * 60 + Number(fs);
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

// RBAC de agenda (S1-12.3):
// - profissional (barbeiro) SÓ pode operar na própria agenda (funcionario_id = seu);
// - recepcionista/admin podem operar em qualquer agenda;
// - cliente não possui acesso à gestão de horários.
async function garantirAcessoAgenda(
  user: ReqUser,
  funcionarioId: string
): Promise<void> {
  if (!PAPEIS_AGENDA.includes(user.role)) {
    throw new ForbiddenError('Acesso negado: papel sem permissão de gestão de horários');
  }
  if (user.role === 'profissional') {
    const proprio = await resolverFuncionarioDoUsuario(user.id);
    if (proprio.id !== funcionarioId) {
      throw new ForbiddenError('Acesso negado: não é possível operar na agenda de outro profissional');
    }
  }
}

export async function listarHorarios(
  user: ReqUser,
  filtros: ListarHorariosFiltros
): Promise<HorarioTrabalho[]> {
  if (user.role === 'profissional') {
    const proprio = await resolverFuncionarioDoUsuario(user.id);
    const params: ListarHorariosParams = {
      funcionarioId: proprio.id,
      diaSemana: filtros.dia_semana,
    };
    return listarHorariosRepo(params).then((rows) => rows.map(normalizarHorario));
  }
  return listarHorariosRepo({
    funcionarioId: filtros.funcionario_id,
    diaSemana: filtros.dia_semana,
  }).then((rows) => rows.map(normalizarHorario));
}

// Disponibilidade: lista os horários de trabalho (recorrentes por dia da semana)
// de um funcionário, cruzados com agendamentos existentes para a data informada.
// Retorna apenas os horarios_trabalho ativos E os horários já ocupados na data,
// para que o frontend possa excluir slots indisponíveis.
export async function obterHorariosDeFuncionario(
  funcionarioId: string,
  diaSemana?: number,
  data?: string,
): Promise<DisponibilidadeFuncionario> {
  const funcionario = await buscarFuncionarioPorId(funcionarioId);
  if (!funcionario) {
    throw new NotFoundError('Funcionário não encontrado');
  }

  const horarios = await listarHorariosRepo({
    funcionarioId,
    diaSemana,
  });
  const horariosAtivos = horarios.filter((h) => h.ativo).map(normalizarHorario);

  const ocupados = data
    ? await buscarHorariosOcupados(funcionarioId, data)
    : [];

  return { horarios: horariosAtivos, ocupados };
}

export async function criarHorario(
  user: ReqUser,
  data: CreateHorarioInput
): Promise<HorarioTrabalho> {
  await garantirAcessoAgenda(user, data.funcionario_id);

  validarIntervalo(data.hora_inicio, data.hora_fim);

  const funcionario = await buscarFuncionarioPorId(data.funcionario_id);
  if (!funcionario) {
    throw new NotFoundError('Funcionário não encontrado');
  }
  if (!funcionario.ativo) {
    throw new ForbiddenError('Não é possível criar horário para funcionário inativo');
  }

  return criarHorarioRepo(data).then(normalizarHorario);
}

export async function atualizarHorario(
  user: ReqUser,
  id: string,
  data: UpdateHorarioInput
): Promise<HorarioTrabalho> {
  const existente = await buscarHorarioPorId(id);
  if (!existente) {
    throw new NotFoundError('Horário de trabalho não encontrado');
  }

  await garantirAcessoAgenda(user, existente.funcionario_id);

  const horaInicio = data.hora_inicio ?? existente.hora_inicio;
  const horaFim = data.hora_fim ?? existente.hora_fim;
  validarIntervalo(horaInicio, horaFim);

  return atualizarHorarioRepo(id, data).then(normalizarHorario);
}

export async function excluirHorario(user: ReqUser, id: string): Promise<void> {
  const existente = await buscarHorarioPorId(id);
  if (!existente) {
    throw new NotFoundError('Horário de trabalho não encontrado');
  }

  await garantirAcessoAgenda(user, existente.funcionario_id);

  await excluirHorarioRepo(id);
}
