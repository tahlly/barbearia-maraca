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
  categoria: string | null;
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
    categoria: row.categoria,
    duracao_minutos: row.duracao_minutos,
    preco: String(row.preco),
    ativo: Boolean(row.ativo),
    created_at: row.created_at,
    updated_at: row.updated_at,
    categorias: [],
  };
}

function toPublicoDTO(row: ServicoRow): ServicoPublicoDTO {
  return {
    id: row.id,
    nome: row.nome,
    descricao: row.descricao,
    categoria: row.categoria,
    duracao_minutos: row.duracao_minutos,
    preco: String(row.preco),
    categorias: [],
  };
}

/** Carrega o mapa servico_id → nomes das categorias ativas. */
async function categoriasPorServico(): Promise<Map<string, string[]>> {
  const rows = (await db('servico_categoria')
    .join('categoria', 'categoria.id', 'servico_categoria.categoria_id')
    .where('categoria.ativo', true)
    .select('servico_categoria.servico_id', 'categoria.nome')) as Array<{ servico_id: string; nome: string }>;
  const mapa = new Map<string, string[]>();
  for (const r of rows) {
    const nomes = mapa.get(r.servico_id) ?? [];
    nomes.push(r.nome);
    mapa.set(r.servico_id, nomes);
  }
  return mapa;
}

function comCategorias(row: ServicoRow, categorias: string[]): ServicoDTO {
  return { ...toDTO(row), categorias };
}

function comCategoriasPublico(row: ServicoRow, categorias: string[]): ServicoPublicoDTO {
  return { ...toPublicoDTO(row), categorias };
}

export async function listarServicosAtivos(): Promise<ServicoPublicoDTO[]> {
  const rows = await db<ServicoRow>('servico')
    .where('ativo', true)
    .select('id', 'nome', 'descricao', 'duracao_minutos', 'preco', 'ativo', 'created_at', 'updated_at');
  const mapa = await categoriasPorServico();
  return rows.map((row) => comCategoriasPublico(row, mapa.get(row.id) ?? []));
}

export async function buscarServicoPorId(id: string): Promise<ServicoDTO | null> {
  const row = await db<ServicoRow>('servico')
    .where('id', id)
    .first();
  if (!row) {
    return null;
  }
  const mapa = await categoriasPorServico();
  return comCategorias(row, mapa.get(row.id) ?? []);
}

export async function criarServico(input: CreateServicoInput): Promise<ServicoDTO> {
  const [row] = await db<ServicoRow>('servico')
    .insert({
      nome: input.nome,
      descricao: input.descricao ?? null,
      categoria: input.categoria ?? null,
      duracao_minutos: input.duracao_minutos,
      preco: input.preco,
      ativo: true,
    })
    .returning('*');
  return { ...toDTO(row), categorias: [] };
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
  if (input.categoria !== undefined) {
    patch.categoria = input.categoria;
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
  return { ...toDTO(row), categorias: [] };
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
  return { ...toDTO(row), categorias: [] };
}
