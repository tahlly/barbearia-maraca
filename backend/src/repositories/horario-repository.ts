import { InternalError } from '../errors/InternalError';
import db from '../database/connection';
import type {
  HorarioTrabalho,
  CreateHorarioInput,
  UpdateHorarioInput,
  FuncionarioMin,
} from '../dtos/horario-dto';

export interface ListarHorariosParams {
  funcionarioId?: string;
  diaSemana?: number;
}

const horarioColunas = [
  'ht.id',
  'ht.funcionario_id',
  'f.nome as funcionario_nome',
  'ht.dia_semana',
  'ht.hora_inicio',
  'ht.hora_fim',
  'ht.ativo',
  'ht.created_at',
  'ht.updated_at',
];

export async function listarHorarios(
  params: ListarHorariosParams = {}
): Promise<HorarioTrabalho[]> {
  const query = db('horario_trabalho as ht')
    .join('funcionario as f', 'f.id', 'ht.funcionario_id')
    .select(horarioColunas)
    .orderBy(['ht.dia_semana', 'ht.hora_inicio']);

  if (params.funcionarioId) {
    query.where('ht.funcionario_id', params.funcionarioId);
  }
  if (params.diaSemana !== undefined) {
    query.where('ht.dia_semana', params.diaSemana);
  }

  const rows = await query;
  return rows as HorarioTrabalho[];
}

export async function buscarHorarioPorId(id: string): Promise<HorarioTrabalho | null> {
  const row = await db('horario_trabalho as ht')
    .join('funcionario as f', 'f.id', 'ht.funcionario_id')
    .select(horarioColunas)
    .where('ht.id', id)
    .first();

  return (row as HorarioTrabalho) ?? null;
}

export async function buscarFuncionarioPorUsuarioId(
  usuarioId: string
): Promise<FuncionarioMin | null> {
  const row = await db('funcionario')
    .select('id', 'nome', 'ativo')
    .where('usuario_id', usuarioId)
    .first();

  return (row as FuncionarioMin) ?? null;
}

export async function buscarFuncionarioPorId(
  id: string
): Promise<FuncionarioMin | null> {
  const row = await db('funcionario')
    .select('id', 'nome', 'ativo')
    .where('id', id)
    .first();

  return (row as FuncionarioMin) ?? null;
}

export async function criarHorario(data: CreateHorarioInput): Promise<HorarioTrabalho> {
  const [id] = await db('horario_trabalho')
    .insert({
      funcionario_id: data.funcionario_id,
      dia_semana: data.dia_semana,
      hora_inicio: data.hora_inicio,
      hora_fim: data.hora_fim,
    })
    .returning('id');

  const created = await buscarHorarioPorId(id);
  if (!created) {
    throw new InternalError('Falha ao criar horário de trabalho');
  }
  return created;
}

export async function atualizarHorario(
  id: string,
  data: UpdateHorarioInput
): Promise<HorarioTrabalho> {
  const patch: Record<string, unknown> = {};
  if (data.dia_semana !== undefined) patch.dia_semana = data.dia_semana;
  if (data.hora_inicio !== undefined) patch.hora_inicio = data.hora_inicio;
  if (data.hora_fim !== undefined) patch.hora_fim = data.hora_fim;

  await db('horario_trabalho').where('id', id).update(patch);

  const updated = await buscarHorarioPorId(id);
  if (!updated) {
    throw new InternalError('Falha ao atualizar horário de trabalho');
  }
  return updated;
}

export async function excluirHorario(id: string): Promise<void> {
  await db('horario_trabalho').where('id', id).del();
}
