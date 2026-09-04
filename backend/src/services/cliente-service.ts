import bcrypt from 'bcrypt';
import { findUsuarioByEmail } from '../repositories/auth-repository';
import {
  listarClientes,
  buscarClientePorId,
  criarClienteCompleto,
  atualizarCliente,
} from '../repositories/cliente-repository';
import type { ClienteRow } from '../repositories/cliente-repository';
import { NotFoundError } from '../errors/NotFoundError';
import { ForbiddenError } from '../errors/ForbiddenError';
import { ValidationError } from '../errors/ValidationError';
import type {
  ClienteDTO,
  CreateClienteInput,
  UpdateClienteInput,
} from '../dtos/cliente-dto';

const SALT_ROUNDS = 10;

export interface UsuarioAutenticado {
  id: string;
  role: string;
}

function toDTO(row: ClienteRow): ClienteDTO {
  return {
    id: row.id,
    nome: row.nome,
    email: row.email,
    telefone: row.telefone,
  };
}

function podeAcessarQualquer(role: string): boolean {
  return role === 'recepcionista' || role === 'admin';
}

/**
 * Resolve o cliente pelo id do caminho aplicando a regra de ownership:
 * - recepcionista/admin acessam qualquer cliente;
 * - um cliente autenticado só acessa o próprio id.
 *
 * ATENÇÃO: o `req.user.id` (do middleware `authenticate`) é o id do `usuario`,
 * não o id da tabela `cliente`. A comparação de ownership é feita por
 * `usuario_id` (id do cliente na tabela `cliente` é `:id` do caminho).
 */
async function resolverAcesso(id: string, usuario: UsuarioAutenticado): Promise<ClienteRow> {
  const cliente = await buscarClientePorId(id);
  if (!cliente) {
    throw new NotFoundError('Cliente não encontrado');
  }
  if (!podeAcessarQualquer(usuario.role) && usuario.id !== cliente.usuario_id) {
    throw new ForbiddenError('Acesso negado');
  }
  return cliente;
}

function validarNome(nome: string): void {
  if (!nome || nome.trim().length === 0) {
    throw new ValidationError('Nome é obrigatório');
  }
}

function validarEmail(email: string): string {
  const normalizado = email.trim().toLowerCase();
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!regex.test(normalizado)) {
    throw new ValidationError('Email inválido');
  }
  return normalizado;
}

function validarTelefone(telefone: string): void {
  const valor = telefone.trim();
  if (valor.length === 0) {
    throw new ValidationError('Telefone não pode ser vazio');
  }
  if (!/^[0-9+\-(). ]+$/.test(valor)) {
    throw new ValidationError('Telefone inválido');
  }
}

export async function listarClientesService(busca?: string): Promise<ClienteDTO[]> {
  return listarClientes(busca);
}

export async function obterClienteParaUsuario(
  id: string,
  usuario: UsuarioAutenticado
): Promise<ClienteDTO> {
  const cliente = await resolverAcesso(id, usuario);
  return toDTO(cliente);
}

export async function criarClienteNovo(input: CreateClienteInput): Promise<ClienteDTO> {
  const nome = input.nome.trim();
  validarNome(nome);
  const email = validarEmail(input.email);

  // DECISÃO (documentada): a senha é OBRIGATÓRIA no POST /api/clientes.
  // Não foi definida política de senha padrão/credenciais (condição de bloqueio
  // segundo o AGENTS.md), então exigir explícitamente é a escolha conservadora
  // e rastreável para o fluxo demo.
  if (!input.senha || input.senha.trim().length === 0) {
    throw new ValidationError('Senha é obrigatória');
  }
  if (input.senha.length < 6) {
    throw new ValidationError('Senha deve ter no mínimo 6 caracteres');
  }

  if (input.telefone !== undefined) {
    validarTelefone(input.telefone);
  }

  const existente = await findUsuarioByEmail(email);
  if (existente) {
    throw new ValidationError('Email já cadastrado');
  }

  const senhaHash = await bcrypt.hash(input.senha, SALT_ROUNDS);

  return criarClienteCompleto({
    email,
    senhaHash,
    nome,
    telefone: input.telefone,
  });
}

export async function atualizarClienteParaUsuario(
  id: string,
  input: UpdateClienteInput,
  usuario: UsuarioAutenticado
): Promise<ClienteDTO> {
  const cliente = await resolverAcesso(id, usuario);

  let emailNovo: string | undefined;
  if (input.email !== undefined) {
    emailNovo = validarEmail(input.email);
    const outro = await findUsuarioByEmail(emailNovo);
    if (outro && outro.id !== cliente.usuario_id) {
      throw new ValidationError('Email já cadastrado');
    }
  }
  if (input.nome !== undefined) {
    validarNome(input.nome);
  }
  if (input.telefone !== undefined) {
    validarTelefone(input.telefone);
  }

  const atualizado = await atualizarCliente(id, {
    nome: input.nome,
    email: emailNovo,
    telefone: input.telefone,
  });
  if (!atualizado) {
    throw new NotFoundError('Cliente não encontrado');
  }
  return toDTO(atualizado);
}
