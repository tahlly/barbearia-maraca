import { InternalError } from '../errors/InternalError';
import db from '../database/connection';
import type {
  HorarioExcecao,
  CreateHorarioExcecaoInput,
  UpdateHorarioExcecaoInput,
  TipoExcecaoHorario,
} from '../dtos/horario-excecao-dto';

// Reaproveita as buscas de funcionário do repositório de horários de trabalho
// (mesmo domínio de agenda), evitando duplicar consultas à tabela funcionario.
export { buscarFuncionarioPorId, buscarFuncionarioPorUsuarioId } from './horario-repository';

export interface ListarExcecoesParams {
  funcionarioId?: string;
  data?: string;
  tipo?: TipoExcecaoHorario;
}

const excecaoColunas = [
  'he.id',
  'he.funcionario_id',
  'f.nome as funcionario_nome',
  'he.data',
  'he.hora_inicio',
  'he.hora_fim',
  'he.tipo',
  'he.motivo',
  'he.created_at',
  'he.updated_at',
];

export async function listarExcecoes(
  params: ListarExcecoesParams = {}
): Promise<HorarioExcecao[]> {
  const query = db('horario_excecao as he')
    .join('funcionario as f', 'f.id', 'he.funcionario_id')
    .select(excecaoColunas)
    .orderBy(['he.data', 'he.hora_inicio']);

  if (params.funcionarioId) {
    query.where('he.funcionario_id', params.funcionarioId);
  }
  if (params.data) {
    query.where('he.data', params.data);
  }
  if (params.tipo) {
    query.where('he.tipo', params.tipo);
  }

  const rows = await query;
  return rows as HorarioExcecao[];
}

export async function buscarExcecaoPorId(id: string): Promise<HorarioExcecao | null> {
  const row = await db('horario_excecao as he')
    .join('funcionario as f', 'f.id', 'he.funcionario_id')
    .select(excecaoColunas)
    .where('he.id', id)
    .first();

  return (row as HorarioExcecao) ?? null;
}

export async function criarExcecao(data: CreateHorarioExcecaoInput): Promise<HorarioExcecao> {
  const [id] = await db('horario_excecao')
    .insert({
      funcionario_id: data.funcionario_id,
      data: data.data,
      hora_inicio: data.hora_inicio,
      hora_fim: data.hora_fim,
      tipo: data.tipo,
      motivo: data.motivo ?? null,
      updated_at: new Date(),
    })
    .returning('id');

  const created = await buscarExcecaoPorId(id);
  if (!created) {
    throw new InternalError('Falha ao criar exceção de horário');
  }
  return created;
}

export async function atualizarExcecao(
  id: string,
  data: UpdateHorarioExcecaoInput
): Promise<HorarioExcecao> {
  const patch: Record<string, unknown> = { updated_at: new Date() };
  if (data.data !== undefined) patch.data = data.data;
  if (data.hora_inicio !== undefined) patch.hora_inicio = data.hora_inicio;
  if (data.hora_fim !== undefined) patch.hora_fim = data.hora_fim;
  if (data.tipo !== undefined) patch.tipo = data.tipo;
  if (data.motivo !== undefined) patch.motivo = data.motivo;

  await db('horario_excecao').where('id', id).update(patch);

  const updated = await buscarExcecaoPorId(id);
  if (!updated) {
    throw new InternalError('Falha ao atualizar exceção de horário');
  }
  return updated;
}

export async function excluirExcecao(id: string): Promise<void> {
  await db('horario_excecao').where('id', id).del();
}
