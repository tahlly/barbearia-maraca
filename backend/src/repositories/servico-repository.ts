import db from '../database/connection';
import type {
  ServicoDTO,
  ServicoPublicoDTO,
  CreateServicoInput,
  UpdateServicoInput,
  UpdateServicoStatusInput,
} from '../dtos/servico-dto';

interface ServicoRow {
  id: string;
  nome: string;
  descricao: string | null;
  duracao_minutos: number;
  preco: string;
  ativo: boolean;
  created_at: Date;
  updated_at: Date;
}

function toDTO(row: ServicoRow): ServicoDTO {
  return {
    id: row.id,
    nome: row.nome,
    descricao: row.descricao,
    duracao_minutos: row.duracao_minutos,
    preco: String(row.preco),
    ativo: Boolean(row.ativo),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function toPublicoDTO(row: ServicoRow): ServicoPublicoDTO {
  return {
    id: row.id,
    nome: row.nome,
    descricao: row.descricao,
    duracao_minutos: row.duracao_minutos,
    preco: String(row.preco),
  };
}

export async function listarServicosAtivos(): Promise<ServicoPublicoDTO[]> {
  const rows = await db<ServicoRow>('servico')
    .where('ativo', true)
    .select('id', 'nome', 'descricao', 'duracao_minutos', 'preco', 'ativo', 'created_at', 'updated_at');
  return rows.map(toPublicoDTO);
}

export async function buscarServicoPorId(id: string): Promise<ServicoDTO | null> {
  const row = await db<ServicoRow>('servico')
    .where('id', id)
    .first();
  return row ? toDTO(row) : null;
}

export async function criarServico(input: CreateServicoInput): Promise<ServicoDTO> {
  const [row] = await db<ServicoRow>('servico')
    .insert({
      nome: input.nome,
      descricao: input.descricao ?? null,
      duracao_minutos: input.duracao_minutos,
      preco: input.preco,
      ativo: true,
    })
    .returning('*');
  return toDTO(row);
}

export async function atualizarServico(
  id: string,
  input: UpdateServicoInput
): Promise<ServicoDTO | null> {
  const patch: Partial<ServicoRow> = {};
  if (input.nome !== undefined) {
    patch.nome = input.nome;
  }
  if (input.descricao !== undefined) {
    patch.descricao = input.descricao;
  }
  if (input.duracao_minutos !== undefined) {
    patch.duracao_minutos = input.duracao_minutos;
  }
  if (input.preco !== undefined) {
    patch.preco = input.preco;
  }
  patch.updated_at = new Date();

  const [row] = await db<ServicoRow>('servico')
    .where('id', id)
    .update(patch)
    .returning('*');
  if (!row) {
    return null;
  }
  return toDTO(row);
}

export async function atualizarStatusServico(
  id: string,
  input: UpdateServicoStatusInput
): Promise<ServicoDTO | null> {
  const [row] = await db<ServicoRow>('servico')
    .where('id', id)
    .update({
      ativo: input.ativo,
      updated_at: new Date(),
    })
    .returning('*');
  if (!row) {
    return null;
  }
  return toDTO(row);
}
