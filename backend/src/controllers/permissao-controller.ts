import type { Request, Response } from 'express';
import { z } from 'zod';
import {
  atualizarPermissao,
  listarPermissoes,
  listarUsuariosComPermissoes,
} from '../services/permissao-service';

const atualizarPermissaoSchema = z.object({
  permissao: z.string().trim().min(1, 'Permissão é obrigatória'),
  concedida: z.boolean(),
});

export async function listarCatalogo(_req: Request, res: Response): Promise<void> {
  res.json(await listarPermissoes());
}

export async function listarUsuarios(_req: Request, res: Response): Promise<void> {
  res.json(await listarUsuariosComPermissoes());
}

export async function atualizarPermissaoHandler(req: Request, res: Response): Promise<void> {
  // Segurança em profundidade: middleware já exige autenticação + permissão,
  // mas o controller não deve confiar em req.user definido.
  if (!req.user) {
    res.status(403).json({ erro: true, mensagem: 'Acesso negado', status: 403 });
    return;
  }

  const { id } = req.params;
  if (typeof id !== 'string' || id.trim().length === 0) {
    res.status(400).json({
      erro: true,
      mensagem: 'ID do usuário é obrigatório',
      status: 400,
      detalhes: ['ID do usuário é obrigatório'],
    });
    return;
  }

  const body = atualizarPermissaoSchema.parse(req.body);
  await atualizarPermissao(req.user, id, body.permissao, body.concedida);
  res.json({ ok: true });
}