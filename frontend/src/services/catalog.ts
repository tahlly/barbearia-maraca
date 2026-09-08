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
  categoria?: string | null;
  duracao_minutos: number;
  preco: string;
}

interface ServicoAdminDTO {
  id: string;
  nome: string;
  descricao: string | null;
  categoria?: string | null;
  duracao_minutos: number;
  preco: string;
  ativo: boolean;
}

interface FuncionarioPublicoDTO {
  id: string;
  nome: string;
  cargo: CargoFuncionario;
  especialidade: string | null;
  categoria?: string | null;
  foto: string | null;
  descricao: string | null;
}

/* ------------------------------------------------------------------ */
/*  Cache (module-level)                                               */
/* ------------------------------------------------------------------ */

let _servicesCache: Service[] = [];
let _professionalsCache: Professional[] = [];

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
    category: dto.categoria ?? "",
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
    category: dto.categoria ?? "",
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
        ? "Recepcionista"
        : dto.cargo === "administrador"
          ? "Administrador"
          : "Barbeiro"),
    category: dto.categoria ?? "",
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
  await Promise.all([fetchServices(), fetchProfessionals()]);
}

/* ------------------------------------------------------------------ */
/*  Admin CRUD — serviços (API real)                                   */
/* ------------------------------------------------------------------ */

export async function createServico(data: {
  name: string;
  description: string;
  category: string;
  durationMin: number;
  price: number;
}): Promise<Service> {
  const dto = await httpJson<ServicoAdminDTO>("/servicos", {
    method: "POST",
    body: JSON.stringify({
      nome: data.name,
      descricao: data.description || null,
      categoria: data.category || null,
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
    category: string;
    durationMin: number;
    price: number;
  },
): Promise<Service> {
  const dto = await httpJson<ServicoAdminDTO>(
    `/servicos/${encodeURIComponent(id)}`,
    {
      method: "PUT",
      body: JSON.stringify({
        nome: data.name,
        descricao: data.description || null,
        categoria: data.category || null,
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
/*  Categorias — derivadas dinamicamente das categorias persistidas    */
/*  nos serviços (o backend não modela uma tabela própria de categorias) */
/* ------------------------------------------------------------------ */

export function loadCategories(): string[] {
  const set = new Set<string>();
  for (const s of _servicesCache) {
    if (s.category && s.category.trim().length > 0) {
      set.add(s.category.trim());
    }
  }
  return [...set].sort((a, b) => a.localeCompare(b, "pt-BR"));
}
