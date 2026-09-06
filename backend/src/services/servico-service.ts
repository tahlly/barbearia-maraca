import {
  listarServicosAtivos,
  buscarServicoPorId,
  criarServico,
  atualizarServico,
  atualizarStatusServico,
} from '../repositories/servico-repository';
import type {
  ServicoPublicoDTO,
  ServicoDTO,
  CreateServicoInput,
  UpdateServicoInput,
  UpdateServicoStatusInput,
} from '../dtos/servico-dto';
import { NotFoundError } from '../errors/NotFoundError';
import { ValidationError } from '../errors/ValidationError';

export async function obterServicosAtivos(): Promise<ServicoPublicoDTO[]> {
  return listarServicosAtivos();
}

export async function obterServicoPorId(id: string): Promise<ServicoDTO> {
  const servico = await buscarServicoPorId(id);
  if (!servico) {
    throw new NotFoundError('Serviço não encontrado');
  }
  return servico;
}

export async function criarNovoServico(input: CreateServicoInput): Promise<ServicoDTO> {
  // Validações de negócio além do schema Zod (que valida tipos/formato).
  validarNome(input.nome);
  validarPreco(input.preco);
  validarDuracao(input.duracao_minutos);
  return criarServico(input);
}

export async function editarServico(
  id: string,
  input: UpdateServicoInput
): Promise<ServicoDTO> {
  // Garante que o serviço existe antes de tentar atualizar.
  await obterServicoPorId(id);

  if (input.nome !== undefined) {
    validarNome(input.nome);
  }
  if (input.preco !== undefined) {
    validarPreco(input.preco);
  }
  if (input.duracao_minutos !== undefined) {
    validarDuracao(input.duracao_minutos);
  }

  const atualizado = await atualizarServico(id, input);
  if (!atualizado) {
    throw new NotFoundError('Serviço não encontrado');
  }
  return atualizado;
}

export async function trocarStatusServico(
  id: string,
  input: UpdateServicoStatusInput
): Promise<ServicoDTO> {
  // Garante que o serviço existe antes de alternar o status.
  await obterServicoPorId(id);

  const atualizado = await atualizarStatusServico(id, { ativo: input.ativo });
  if (!atualizado) {
    throw new NotFoundError('Serviço não encontrado');
  }
  return atualizado;
}

function validarNome(nome: string): void {
  if (!nome || nome.trim().length === 0) {
    throw new ValidationError('Nome do serviço é obrigatório');
  }
}

function validarPreco(preco: string): void {
  const numeric = Number(preco);
  if (Number.isNaN(numeric)) {
    throw new ValidationError('Preço deve ser um número válido');
  }
  if (numeric < 0) {
    throw new ValidationError('Preço não pode ser negativo');
  }
}

function validarDuracao(duracao: number): void {
  if (!Number.isInteger(duracao) || duracao <= 0) {
    throw new ValidationError('Duração deve ser um inteiro positivo (em minutos)');
  }
}
