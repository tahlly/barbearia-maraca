// DTOs do domínio Clientes (backend).
//
// Estes tipos espelham os contratos HTTP compartilhados em `shared/types/index.ts`
// (ClienteDTO, CreateClienteRequest, UpdateClienteRequest). O backend compila com
// `rootDir: ./src`, por isso os tipos são definidos localmente (padrão já usado por
// servico-dto.ts e auth-dto.ts) em vez de importar de `shared/`.

export interface ClienteDTO {
  id: string;
  nome: string;
  email: string;
  telefone: string | null;
}

export interface CreateClienteInput {
  nome: string;
  email: string;
  telefone?: string;
  // DECISÃO: senha é obrigatória no POST /api/clientes (ver cliente-service.ts).
  senha: string;
}

export interface UpdateClienteInput {
  nome?: string;
  email?: string;
  telefone?: string;
}
