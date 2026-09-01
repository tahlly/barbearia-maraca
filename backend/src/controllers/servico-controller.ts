import type { Request, Response } from 'express';
import { obterServicosAtivos } from '../services/servico-service';

export async function listarServicos(req: Request, res: Response): Promise<void> {
  const servicos = await obterServicosAtivos();
  res.json(servicos);
}