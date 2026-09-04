import db from '../database/connection';
import type {
  FuncionarioRow,
  FuncionarioPublicoDTO,
  FuncionarioCompletoDTO,
  FuncionarioCriadoDTO,
} from '../dtos/funcionario-dto';

// ── Mapeadores ────────────────────────────────────────────────

function toPublicoDTO(row: Pick<FuncionarioRow, 'id' | 'nome' | 'especialidade' | 'foto' | 'descricao'>): FuncionarioPublicoDTO {
  return {
    id: row.id,
    nome: row.nome,
    especialidade: row.especialidade,
    foto: row.foto,
    descricao: row.descricao,
  };
}

function toCompletoDTO(row: FuncionarioRow, email: string): FuncionarioCompletoDTO {
  return {
    id: row.id,
    usuarioId: row.usuario_id,
    nome: row.nome,
    telefone: row.telefone,
    cargo: row.cargo,
    especialidade: row.especialidade,
    foto: row.foto,
    descricao: row.descricao,
    ativo: row.ativo,
    email,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ── Consultas ─────────────────────────────────────────────────

export async function listarPublicos(cargo?: string): Promise<FuncionarioPublicoDTO[]> {
  let query = db('funcionario').where('ativo', true);
  if (cargo) {
    query = query.where('cargo', cargo);
  }
  const rows = await query.select('id', 'nome', 'especialidade', 'foto', 'descricao');
  return (rows as Array<Pick<FuncionarioRow, 'id' | 'nome' | 'especialidade' | 'foto' | 'descricao'>>).map(toPublicoDTO);
}

export async function listarTodos(): Promise<FuncionarioCompletoDTO[]> {
  const rows = await db('funcionario')
    .join('usuario', 'funcionario.usuario_id', 'usuario.id')
    .select(
      'funcionario.id',
      'funcionario.usuario_id',
      'funcionario.nome',
      'funcionario.telefone',
      'funcionario.cargo',
      'funcionario.especialidade',
      'funcionario.foto',
      'funcionario.descricao',
      'funcionario.ativo',
      'funcionario.created_at',
      'funcionario.updated_at',
      'usuario.email',
    );
  return (rows as Array<FuncionarioRow & { email: string }>).map((r) =>
    toCompletoDTO(r, r.email),
  );
}

export async function buscarPorId(id: string): Promise<FuncionarioCompletoDTO | null> {
  const row = (await db('funcionario')
    .join('usuario', 'funcionario.usuario_id', 'usuario.id')
    .where('funcionario.id', id)
    .select(
      'funcionario.id',
      'funcionario.usuario_id',
      'funcionario.nome',
      'funcionario.telefone',
      'funcionario.cargo',
      'funcionario.especialidade',
      'funcionario.foto',
      'funcionario.descricao',
      'funcionario.ativo',
      'funcionario.created_at',
      'funcionario.updated_at',
      'usuario.email',
    )
    .first()) as (FuncionarioRow & { email: string }) | undefined;

  return row ? toCompletoDTO(row, row.email) : null;
}

export async function buscarPorUsuarioId(usuarioId: string): Promise<FuncionarioRow | null> {
  const row = (await db('funcionario').where('usuario_id', usuarioId).first()) as FuncionarioRow | undefined;
  return row ?? null;
}

// ── Escrita ───────────────────────────────────────────────────

export async function criar(dados: {
  email: string;
  senhaHash: string;
  nome: string;
  telefone?: string;
  cargo?: string;
  especialidade?: string;
}): Promise<FuncionarioCriadoDTO> {
  return db.transaction(async (trx) => {
    const [usuarioRow] = (await trx('usuario')
      .insert({
        email: dados.email,
        senha_hash: dados.senhaHash,
        tipo: 'funcionario',
      })
      .returning('*')) as Array<{ id: string; email: string }>;

    const [funcionarioRow] = (await trx('funcionario')
      .insert({
        usuario_id: usuarioRow.id,
        nome: dados.nome,
        telefone: dados.telefone ?? null,
        cargo: dados.cargo ?? 'barbeiro',
        especialidade: dados.especialidade ?? null,
      })
      .returning('*')) as Array<FuncionarioRow>;

    return {
      id: funcionarioRow.id,
      usuarioId: usuarioRow.id,
      nome: funcionarioRow.nome,
      email: usuarioRow.email,
      telefone: funcionarioRow.telefone,
      cargo: funcionarioRow.cargo,
      especialidade: funcionarioRow.especialidade,
    };
  });
}

export async function atualizar(
  id: string,
  dados: {
    nome?: string;
    telefone?: string;
    cargo?: string;
    especialidade?: string;
    foto?: string;
    descricao?: string;
    email?: string;
    senhaHash?: string;
  },
): Promise<FuncionarioCompletoDTO | null> {
  // Verifica se há algo para atualizar
  const funcionarioUpdates: Record<string, string | null> = {};
  if (dados.nome !== undefined) funcionarioUpdates.nome = dados.nome;
  if (dados.telefone !== undefined) funcionarioUpdates.telefone = dados.telefone;
  if (dados.cargo !== undefined) funcionarioUpdates.cargo = dados.cargo;
  if (dados.especialidade !== undefined) funcionarioUpdates.especialidade = dados.especialidade;
  if (dados.foto !== undefined) funcionarioUpdates.foto = dados.foto;
  if (dados.descricao !== undefined) funcionarioUpdates.descricao = dados.descricao;

  const hasUsuarioUpdates = dados.email !== undefined || dados.senhaHash !== undefined;

  if (Object.keys(funcionarioUpdates).length === 0 && !hasUsuarioUpdates) {
    return buscarPorId(id);
  }

  // Se há atualizações de usuario, usa transaction para atomicidade
  if (hasUsuarioUpdates) {
    await db.transaction(async (trx) => {
      // Busca o usuario_id do funcionário
      const funcionarioRow = await trx('funcionario').where('id', id).first();
      if (!funcionarioRow) return;

      // Atualiza campos de usuario se fornecidos
      const usuarioUpdates: Record<string, string> = {};
      if (dados.email !== undefined) usuarioUpdates.email = dados.email;
      if (dados.senhaHash !== undefined) usuarioUpdates.senha_hash = dados.senhaHash;

      if (Object.keys(usuarioUpdates).length > 0) {
        await trx('usuario').where('id', funcionarioRow.usuario_id).update(usuarioUpdates);
      }

      // Atualiza campos de funcionário
      if (Object.keys(funcionarioUpdates).length > 0) {
        await trx('funcionario').where('id', id).update(funcionarioUpdates);
      }

      await trx('funcionario').where('id', id).update({ updated_at: trx.fn.now() });
    });
  } else if (Object.keys(funcionarioUpdates).length > 0) {
    // Sem alterações em usuario — atualiza direto
    await db('funcionario').where('id', id).update(funcionarioUpdates);
    await db('funcionario').where('id', id).update({ updated_at: db.fn.now() });
  }

  return buscarPorId(id);
}

export async function trocarStatus(id: string, ativo: boolean): Promise<boolean> {
  const count = await db('funcionario').where('id', id).update({ ativo });
  return count > 0;
}
