import { httpJson } from "./api.js";

// ── Tipos de contrato HTTP (espelho de shared/types — mantidos localmente
// para evitar import fora do rootDir do frontend) ────────────────────────

type CargoFuncionario = "barbeiro" | "recepcionista" | "administrador";

interface FuncionarioDTO {
  id: string;
  usuarioId: string;
  nome: string;
  telefone: string | null;
  cargo: CargoFuncionario;
  especialidade: string | null;
  foto: string | null;
  descricao: string | null;
  ativo: boolean;
  email: string;
  createdAt: string;
  updatedAt: string;
}

interface CreateFuncionarioRequest {
  nome: string;
  email: string;
  senha: string;
  telefone?: string;
  cargo?: CargoFuncionario;
  especialidade?: string;
}

interface UpdateFuncionarioRequest {
  nome?: string;
  telefone?: string;
  cargo?: CargoFuncionario;
  especialidade?: string;
  foto?: string;
  descricao?: string;
  email?: string;
  senha?: string;
}

// ── Tipo público (mantido para compatibilidade com views) ───────────────

export interface UsuarioInterno {
  id: string;
  nome: string;
  email: string;
  senha: string;
  role: "admin" | "profissional" | "recepcionista";
  professionalId?: string;
  createdAt: string;
}

// ── Helpers de mapeamento API ───────────────────────────────────────────

/**
 * Mapeia `cargo` do backend → `role` do frontend.
 *
 * Backend:  'barbeiro' | 'recepcionista' | 'administrador'
 * Frontend: 'admin' | 'profissional' | 'recepcionista'
 *
 * 'barbeiro' → 'profissional'
 * 'administrador' → 'admin'
 * 'recepcionista' → 'recepcionista'
 * Valor desconhecido → 'profissional' (fallback seguro)
 */
function cargoToRole(cargo: string): "admin" | "profissional" | "recepcionista" {
  if (cargo === "recepcionista") return "recepcionista";
  if (cargo === "administrador") return "admin";
  return "profissional";
}

/**
 * Mapeia `role` do frontend → `cargo` do backend.
 */
function roleToCargo(role: "admin" | "profissional" | "recepcionista"): CargoFuncionario {
  if (role === "recepcionista") return "recepcionista";
  if (role === "admin") return "administrador";
  return "barbeiro";
}

/**
 * Converte `FuncionarioDTO` (backend) para `UsuarioInterno` (frontend).
 *
 * Decisões de mapeamento:
 * - `id` ← `funcionario.usuarioId` (ID do registro de autenticação)
 * - `professionalId` ← `funcionario.id` (ID do registro de funcionário)
 * - `senha` ← `""` (senhas nunca são expostas pela API; hash no backend)
 * - `role` ← `cargo` mapeado via `cargoToRole`
 * - `createdAt` ← `funcionario.createdAt`
 */
function funcionarioToUsuario(f: FuncionarioDTO): UsuarioInterno {
  return {
    id: f.usuarioId,
    nome: f.nome,
    email: f.email,
    senha: "",
    role: cargoToRole(f.cargo),
    professionalId: f.id,
    createdAt: f.createdAt,
  };
}

// ── Cache de funcionários (API mode) ────────────────────────────────────

/**
 * Cache simples de funcionários obtidos da API.
 * Invalidado a cada operação de escrita (create/update/delete).
 */
let funcionariosCache: UsuarioInterno[] | null = null;

function invalidateCache(): void {
  funcionariosCache = null;
}

/**
 * Busca todos os funcionários com dados completos via API.
 *
 * Usa o endpoint autenticado `GET /funcionarios/detalhes` (admin/recepcionista)
 * que retorna todos os dados em uma única requisição (JOIN no backend).
 *
 * Requer sessão autenticada com papel admin ou recepcionista.
 */
async function fetchAllFromApi(): Promise<UsuarioInterno[]> {
  if (funcionariosCache) return funcionariosCache;

  const fullDetails = await httpJson<FuncionarioDTO[]>("/funcionarios/detalhes");

  funcionariosCache = fullDetails.map(funcionarioToUsuario);
  return funcionariosCache;
}

// ── API pública ─────────────────────────────────────────────────────────

/**
 * Retorna a lista de usuários internos.
 *
 * **Modo mock:** lê de `localStorage`.
 * **Modo API:** busca todos os funcionários via API e mapeia.
 */
export async function listUsuariosInternos(): Promise<UsuarioInterno[]> {
  return fetchAllFromApi();
}

/**
 * Busca um usuário interno por e-mail.
 *
 * **Modo mock:** filtra a lista em `localStorage`.
 * **Modo API:** chama `GET /funcionarios/buscar?email=...` (autenticado;
 * admin/recepcionista encontram qualquer funcionário; um profissional só o
 * próprio). Retorna `null` em 404/erro para o caller tratar como inexistente.
 */
export async function findUsuarioByEmail(
  email: string,
): Promise<UsuarioInterno | null> {

  try {
    const funcionario = await httpJson<FuncionarioDTO>(
      `/funcionarios/buscar?email=${encodeURIComponent(email.trim().toLowerCase())}`,
    );
    return funcionarioToUsuario(funcionario);
  } catch {
    return null;
  }
}

/**
 * Valida credenciais de um usuário interno.
 *
 * Não é mais usada: a autenticação é tratada pelo endpoint `POST /auth/login`
 * no backend.
 */

/**
 * Cria um novo usuário interno.
 *
 * **Modo mock:** adiciona ao `localStorage`.
 * **Modo API:** chama `POST /funcionarios` (cria `usuario` + `funcionario`
 * atomicamente no backend).
 *
 * Decisão: o backend cria o registro de autenticação (`usuario`) e o
 * registro de funcionário em uma única requisição. O campo `professionalId`
 * do mock não é necessário — o backend retorna o ID do funcionário criado.
 *
 * PENDÊNCIA: `senha` é obrigatória no backend (mín. 6 caracteres).
 * Se o chamador não fornecer senha, a requisição falhará.
 */
export async function createUsuarioInterno(data: {
  nome: string;
  email: string;
  senha: string;
  role: "admin" | "profissional" | "recepcionista";
  professionalId?: string;
}): Promise<UsuarioInterno> {
  const response = await httpJson<{
    id: string;
    usuarioId: string;
    nome: string;
    email: string;
    telefone: string | null;
    cargo: string;
    especialidade: string | null;
  }>("/funcionarios", {
    method: "POST",
    body: JSON.stringify({
      nome: data.nome.trim(),
      email: data.email.trim().toLowerCase(),
      senha: data.senha,
      cargo: roleToCargo(data.role),
    } satisfies CreateFuncionarioRequest),
  });

  invalidateCache();

  return {
    id: response.usuarioId,
    nome: response.nome,
    email: response.email,
    senha: "",
    role: cargoToRole(response.cargo),
    professionalId: response.id,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Atualiza um usuário interno.
 *
 * **Modo mock:** atualiza no `localStorage`.
 * **Modo API:** chama `PUT /funcionarios/:id`.
 *
 * O `PUT /funcionarios/:id` aceita `nome`, `telefone`, `cargo`, `especialidade`,
 * `foto`, `descricao`, `email` e `senha`. `email` e `senha` são opcionais e
 * só são enviados quando o chamador os fornece (o backend aplica quando presente).
 *
 * PENDÊNCIA: O parâmetro `id` é o `usuarioId` do frontend, mas o backend
 * espera o `funcionarioId`. A função tenta resolver internamente via busca.
 */
export async function updateUsuarioInterno(
  id: string,
  data: { nome?: string; email?: string; senha?: string; especialidade?: string; cargo?: CargoFuncionario },
): Promise<UsuarioInterno | null> {

  // No modo API, precisamos do funcionarioId (não do usuarioId).
  // Busca o usuário na lista para obter o professionalId.
  const usuarios = await fetchAllFromApi();
  const usuario = usuarios.find((u) => u.id === id);
  if (!usuario?.professionalId) return null;

  const payload: UpdateFuncionarioRequest = {};
  if (data.nome !== undefined) payload.nome = data.nome.trim();
  if (data.especialidade !== undefined) payload.especialidade = data.especialidade;
  if (data.cargo !== undefined) payload.cargo = data.cargo;
  if (data.email !== undefined) payload.email = data.email.trim();
  if (data.senha !== undefined && data.senha !== "") payload.senha = data.senha;

  const updated = await httpJson<FuncionarioDTO>(
    `/funcionarios/${encodeURIComponent(usuario.professionalId)}`,
    {
      method: "PUT",
      body: JSON.stringify(payload),
    },
  );

  invalidateCache();
  return funcionarioToUsuario(updated);
}

/**
 * Busca um usuário interno pelo ID do funcionário.
 *
 * **Modo mock:** filtra a lista em `localStorage`.
 * **Modo API:** chama `GET /funcionarios/:id` (autenticado).
 *
 * Decisão: O parâmetro `professionalId` corresponde diretamente ao `id`
 * do `FuncionarioDTO` no backend.
 */
export async function findByProfessionalId(
  professionalId: string,
): Promise<UsuarioInterno | null> {

  try {
    const funcionario = await httpJson<FuncionarioDTO>(
      `/funcionarios/${encodeURIComponent(professionalId)}`,
    );
    return funcionarioToUsuario(funcionario);
  } catch {
    return null;
  }
}

/**
 * Remove (desativa) um usuário interno.
 *
 * **Modo mock:** remove do `localStorage`.
 * **Modo API:** chama `PATCH /funcionarios/:id/status` com `ativo: false`.
 *
 * PENDÊNCIA: O backend não possui endpoint de exclusão física (`DELETE`).
 * A operação é uma desativação lógica. Dados permanecem no banco.
 *
 * PENDÊNCIA: O parâmetro `id` é o `usuarioId`. A função resolve
 * internamente para o `funcionarioId` via busca.
 */
export async function deleteUsuarioInterno(id: string): Promise<void> {

  const usuarios = await fetchAllFromApi();
  const usuario = usuarios.find((u) => u.id === id);
  if (!usuario?.professionalId) return;

  await httpJson<{ mensagem: string; ativo: boolean }>(
    `/funcionarios/${encodeURIComponent(usuario.professionalId)}/status`,
    {
      method: "PATCH",
      body: JSON.stringify({ ativo: false }),
    },
  );

  invalidateCache();
}

