import db from '../database/connection';
import type { CategoriaPublicaDTO } from '../dtos/categoria-dto';

export async function listarAtivas(): Promise<CategoriaPublicaDTO[]> {
  const rows = await db('categoria')
    .where('ativo', true)
    .orderBy('nome')
    .select('id', 'nome');
  return rows as CategoriaPublicaDTO[];
}