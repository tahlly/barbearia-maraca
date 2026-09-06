import db from '../database/connection';
import type { ClienteDTO } from '../dtos/cliente-dto';

export interface ClienteRow {
  id: string;
  usuario_id: string;
  nome: string;
  email: string;
  telefone: string | null;
}

interface InsertResult {
  id: string;
}

function toDTO(row: ClienteRow): ClienteDTO {
  return {
    id: row.id,
    nome: row.nome,
    email: row.email,
    telefone: row.telefone,
  };
}

export async function listarClientes(busca?: string): Promise<ClienteDTO[]> {
  const termo = busca?.trim() || '';

  const rows = await db<ClienteRow>('cliente as c')
    .join('usuario as u', 'u.id', 'c.usuario_id')
    .select('c.id', 'c.usuario_id', 'c.nome', 'c.telefone', 'u.email as email')
    .modify((queryBuilder) => {
      if (termo) {
        queryBuilder.where((qb) => {
          qb.where('c.nome', 'ilike', `%${termo}%`)
            .orWhere('u.email', 'ilike', `%${termo}%`)
            .orWhere('c.telefone', 'ilike', `%${termo}%`);
        });
      }
    })
    .orderBy('c.nome');

  return (rows as ClienteRow[]).map(toDTO);
}

export async function buscarClientePorId(id: string): Promise<ClienteRow | null> {
  const row = await db<ClienteRow>('cliente as c')
    .join('usuario as u', 'u.id', 'c.usuario_id')
    .select('c.id', 'c.usuario_id', 'c.nome', 'c.telefone', 'u.email as email')
    .where('c.id', id)
    .first();
  return (row as ClienteRow | undefined) ?? null;
}

export async function buscarClientePorUsuarioId(
  usuarioId: string
): Promise<ClienteRow | null> {
  const row = await db<ClienteRow>('cliente as c')
    .join('usuario as u', 'u.id', 'c.usuario_id')
    .select('c.id', 'c.usuario_id', 'c.nome', 'c.telefone', 'u.email as email')
    .where('c.usuario_id', usuarioId)
    .first();
  return (row as ClienteRow | undefined) ?? null;
}

export async function buscarClientePorEmail(email: string): Promise<ClienteRow | null> {
  const row = await db<ClienteRow>('cliente as c')
    .join('usuario as u', 'u.id', 'c.usuario_id')
    .select('c.id', 'c.usuario_id', 'c.nome', 'c.telefone', 'u.email as email')
    .where('u.email', email)
    .first();
  return (row as ClienteRow | undefined) ?? null;
}

/**
 * Cria o usuário (tipo 'cliente') e o cliente em uma única transação,
 * garantindo atomicidade entre as duas tabelas.
 */
export async function criarClienteCompleto(data: {
  email: string;
  senhaHash: string;
  nome: string;
  telefone?: string;
}): Promise<ClienteDTO> {
  const clienteId = await db.transaction(async (trx) => {
    const usuarioRows = await trx('usuario')
      .insert({
        email: data.email,
        senha_hash: data.senhaHash,
        tipo: 'cliente',
      })
      .returning('id');
    const usuario = usuarioRows[0] as InsertResult;

    const clienteRows = await trx('cliente')
      .insert({
        usuario_id: usuario.id,
        nome: data.nome,
        telefone: data.telefone?.trim() || null,
      })
      .returning('id');
    const cliente = clienteRows[0] as InsertResult;
    return cliente.id;
  });

  const criado = await buscarClientePorId(clienteId);
  if (!criado) {
    throw new Error('Falha ao recuperar cliente criado');
  }
  return toDTO(criado);
}

export async function atualizarCliente(
  clienteId: string,
  dados: { nome?: string; email?: string; telefone?: string }
): Promise<ClienteRow | null> {
  const clienteAtual = await db<{ id: string; usuario_id: string }>('cliente')
    .where('id', clienteId)
    .first();
  if (!clienteAtual) {
    return null;
  }

  const patchCliente: { nome?: string; telefone?: string | null; updated_at: Date } = {
    updated_at: new Date(),
  };
  if (dados.nome !== undefined) {
    patchCliente.nome = dados.nome.trim();
  }
  if (dados.telefone !== undefined) {
    patchCliente.telefone = dados.telefone.trim() || null;
  }
  await db('cliente').where('id', clienteId).update(patchCliente);

  if (dados.email !== undefined) {
    await db('usuario')
      .where('id', clienteAtual.usuario_id)
      .update({ email: dados.email.trim(), updated_at: new Date() });
  }

  const atualizado = await buscarClientePorId(clienteId);
  return atualizado;
}
