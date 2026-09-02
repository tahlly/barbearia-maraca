import db from '../database/connection';
import type { ServicoDTO } from '../dtos/servico-dto';

export async function listarServicosAtivos(): Promise<ServicoDTO[]> {
  const rows = await db('servico')
    .where('ativo', true)
    .select('id', 'nome', 'preco', 'duracao_minutos as duracao');
  return rows as ServicoDTO[];
}