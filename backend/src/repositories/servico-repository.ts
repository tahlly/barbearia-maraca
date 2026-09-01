import db from '../database/connection';
import type { ServicoResponse } from '../dtos/servico-dto';

export async function listarServicosAtivos(): Promise<ServicoResponse[]> {
  const rows = await db('servico')
    .where('ativo', true)
    .select('id', 'nome', 'descricao', 'duracao_minutos', 'preco', 'ativo');
  return rows as ServicoResponse[];
}