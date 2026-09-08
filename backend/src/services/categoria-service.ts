import { listarAtivas } from '../repositories/categoria-repository';
import type { CategoriaPublicaDTO } from '../dtos/categoria-dto';

export async function listarCategoriasAtivas(): Promise<CategoriaPublicaDTO[]> {
  return listarAtivas();
}