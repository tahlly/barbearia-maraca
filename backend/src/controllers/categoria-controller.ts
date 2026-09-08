import type { Request, Response } from 'express';
import { listarCategoriasAtivas } from '../services/categoria-service';

export async function listarCategorias(_req: Request, res: Response): Promise<void> {
  const categorias = await listarCategoriasAtivas();
  res.json(categorias);
}