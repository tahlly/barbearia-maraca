import type { CargoFuncionario, Professional, Service } from "../types.js";
import { httpJson } from "./api.js";

/* ------------------------------------------------------------------ */
/*  DTO shapes (espelho fiel de shared/types/index.ts — não importar   */
/*  diretamente por rootDir ser src/ no tsconfig do frontend)          */
/* ------------------------------------------------------------------ */

interface ServicoPublicoDTO {
  id: string;
  nome: string;
  descricao?: string | null;
  duracao_minutos: number;
  preco: string;
  categorias?: string[];
}

interface ServicoAdminDTO {
  id: string;
  nome: string;
  descricao: string | null;
  duracao_minutos: number;
  preco: string;
  ativo: boolean;
  categorias?: string[];
}

interface FuncionarioPublicoDTO {
  id: string;
  nome: string;
  cargo: CargoFuncionario;
  especialidade: string | null;
  foto: string | null;
  descricao: string | null;
  categorias?: string[];
}

interface CategoriaDTO {
  id: string;
  nome: string;
}

/* ------------------------------------------------------------------ */
/*  Cache (module-level)                                               */
/* ------------------------------------------------------------------ */

let _servicesCache: Service[] = [];
let _professionalsCache: Professional[] = [];
let _categoriesCache: string[] = [];

/* ------------------------------------------------------------------ */
/*  DTO → Frontend type mappers                                        */
/* ------------------------------------------------------------------ */

function mapServico(dto: ServicoPublicoDTO): Service {
  return {
    id: dto.id,
    name: dto.nome,
    description: dto.descricao ?? "",
    durationMin: dto.duracao_minutos,
    price: parseFloat(dto.preco),
    icon: "scissors",
    categories: dto.categorias ?? [],
    active: true,
  };
}

function mapServicoAdmin(dto: ServicoAdminDTO): Service {
  return {
    id: dto.id,
    name: dto.nome,
    description: dto.descricao ?? "",
    durationMin: dto.duracao_minutos,
    price: parseFloat(dto.preco),
    icon: "scissors",
    categories: dto.categorias ?? [],
    active: dto.ativo,
  };
}

function mapProfissional(dto: FuncionarioPublicoDTO): Professional {
  return {
    id: dto.id,
    name: dto.nome,
    // `role` é rótulo visual (especialidade ou fallback contextual por cargo).
    role:
      dto.especialidade ??
      (dto.cargo === "recepcionista"
        ? "RECEPCIONISTA"
        : dto.cargo === "administrador"
          ? "ADMINISTRADOR"
          : "BARBEIRO"),
    categories: dto.categorias ?? [],
    active: true,
    photo: dto.foto ?? undefined,
    cargo: dto.cargo,
  };
}

/* ------------------------------------------------------------------ */
/*  Async fetchers (API real)                                          */
/* ------------------------------------------------------------------ */

export async function fetchServices(): Promise<Service[]> {
  const dtos = await httpJson<ServicoPublicoDTO[]>("/servicos");
  _servicesCache = dtos.map(mapServico);
  return _servicesCache;
}

export async function fetchProfessionals(): Promise<Professional[]> {
  const dtos = await httpJson<FuncionarioPublicoDTO[]>("/funcionarios");
  _professionalsCache = dtos.map(mapProfissional);
  return _professionalsCache;
}

/**
 * Busca profissionais filtrando por cargo (`?cargo=...`).
 * O cache global permanece com a lista completa (manter compatibilidade com
 * manage.ts e minhaConta.ts); o resultado por cargo NÃO substitui esse cache
 * global. Usada pelo wizard de agendamento para oferecer somente barbeiros.
 */
export async function fetchProfessionalsByCargo(cargo: CargoFuncionario): Promise<Professional[]> {
  const dtos = await httpJson<FuncionarioPublicoDTO[]>(
    `/funcionarios?cargo=${encodeURIComponent(cargo)}`,
  );
  return dtos.map(mapProfissional);
}

/** Atalho legível para o wizard: somente barbeiros. */
export function fetchBarbeiros(): Promise<Professional[]> {
  return fetchProfessionalsByCargo("barbeiro");
}

/* ------------------------------------------------------------------ */
/*  Sync cache readers (mantêm compatibilidade com call sites existentes) */
/* ------------------------------------------------------------------ */

export function loadServices(): Service[] {
  return _servicesCache;
}

export function loadProfessionals(): Professional[] {
  return _professionalsCache;
}

/* ------------------------------------------------------------------ */
/*  Prime / init – chamar no boot do app                               */
/* ------------------------------------------------------------------ */

export async function primeCatalog(): Promise<void> {
  await Promise.all([fetchServices(), fetchProfessionals(), fetchCategories()]);
}

let _primePromise: Promise<void> | null = null;
let _catalogPrimed = false;

/**
 * Garante que o catálogo (serviços, profissionais e categorias) foi carregado
 * no cache.
 *
 * Idempotente: enquanto o carregamento inicial está em andamento, retorna a
 * MESMA promessa (nunca dispara fetches duplicados); após a primeira
 * conclusão bem-sucedida, resolve imediatamente nas chamadas seguintes.
 *
 * Views que dependem do cache síncrono (`loadServices`/`loadProfessionals`)
 * devem `await` esta função antes de ler — o Dashboard faz isso para nunca
 * renderizar Faturamento zerado, nomes `-` ou destaque vazio no boot.
 */
export function ensureCatalogLoaded(): Promise<void> {
  if (_catalogPrimed) {
    return Promise.resolve();
  }
  if (!_primePromise) {
    _primePromise = primeCatalog()
      .then(() => {
        _catalogPrimed = true;
      })
      .finally(() => {
        _primePromise = null;
      });
  }
  return _primePromise;
}

/* ------------------------------------------------------------------ */
/*  Admin CRUD — serviços (API real)                                   */
/* ------------------------------------------------------------------ */

export async function createServico(data: {
  name: string;
  description: string;
  durationMin: number;
  price: number;
}): Promise<Service> {
  const dto = await httpJson<ServicoAdminDTO>("/servicos", {
    method: "POST",
    body: JSON.stringify({
      // Nome do serviço padronizado em CAIXA ALTA (descrição preservada).
      nome: data.name.trim().toUpperCase(),
      descricao: data.description || null,
      duracao_minutos: data.durationMin,
      preco: data.price,
    }),
  });
  await fetchServices();
  return mapServicoAdmin(dto);
}

export async function updateServico(
  id: string,
  data: {
    name: string;
    description: string;
    durationMin: number;
    price: number;
  },
): Promise<Service> {
  const dto = await httpJson<ServicoAdminDTO>(
    `/servicos/${encodeURIComponent(id)}`,
    {
method: "PUT",
    body: JSON.stringify({
      // Nome do serviço padronizado em CAIXA ALTA (descrição preservada).
      nome: data.name.trim().toUpperCase(),
      descricao: data.description || null,
      duracao_minutos: data.durationMin,
      preco: data.price,
    }),
    },
  );
  await fetchServices();
  return mapServicoAdmin(dto);
}

export async function setServicoStatus(
  id: string,
  ativo: boolean,
): Promise<Service> {
  const dto = await httpJson<ServicoAdminDTO>(
    `/servicos/${encodeURIComponent(id)}/status`,
    {
      method: "PATCH",
      body: JSON.stringify({ ativo }),
    },
  );
  await fetchServices();
  return mapServicoAdmin(dto);
}

/* ------------------------------------------------------------------ */
/*  Categorias (catálogo)                                              */
/* ------------------------------------------------------------------ */

export async function fetchCategories(): Promise<string[]> {
  const dtos = await httpJson<CategoriaDTO[]>("/categorias");
  _categoriesCache = dtos.map((d) => d.nome);
  return [..._categoriesCache];
}

/** Categorias do catálogo (cache populado pelo `primeCatalog`). */
export function loadCategories(): string[] {
  return [..._categoriesCache];
}
