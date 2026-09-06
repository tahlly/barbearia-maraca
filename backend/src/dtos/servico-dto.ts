// DTOs de Serviço (domínio Serviços).
//
// DECISÃO DE TIPAGEM DE PREÇO:
// `preco` é armazenado no banco como DECIMAL(10,2). Hoje ele é retornado/aceito
// como STRING para preservar a precisão decimal exata de moeda (evita erros de
// ponto flutuante do IEEE 754 quando convertido para number). A entrada (create/
// update) aceita string ou number, mas é normalizada para string no repositório.
//
// `duracao_minutos` é inteiro (minutos).

export interface ServicoDTO {
  id: string;
  nome: string;
  descricao: string | null;
  duracao_minutos: number;
  preco: string;
  ativo: boolean;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface ServicoPublicoDTO {
  id: string;
  nome: string;
  descricao: string | null;
  duracao_minutos: number;
  preco: string;
}

export interface CreateServicoInput {
  nome: string;
  descricao?: string | null;
  duracao_minutos: number;
  preco: string;
}

export interface UpdateServicoInput {
  nome?: string;
  descricao?: string | null;
  duracao_minutos?: number;
  preco?: string;
}

export interface UpdateServicoStatusInput {
  ativo: boolean;
}
