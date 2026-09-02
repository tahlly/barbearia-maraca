import type { Professional, Service } from "../types.js";
import { CONFIG } from "../config.js";

export const DEFAULT_CATEGORIES: string[] = [];

function readList<T>(key: string): T[] {
  const raw = localStorage.getItem(key);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as T[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeList<T>(key: string, list: T[]): void {
  localStorage.setItem(key, JSON.stringify(list));
}

export function loadServices(): Service[] {
  return readList<Service>(CONFIG.servicesKey);
}

export function saveServices(services: Service[]): void {
  writeList(CONFIG.servicesKey, services);
}

export function loadProfessionals(): Professional[] {
  return readList<Professional>(CONFIG.professionalsKey);
}

export function saveProfessionals(professionals: Professional[]): void {
  writeList(CONFIG.professionalsKey, professionals);
}

export function loadCategories(): string[] {
  const raw = localStorage.getItem(CONFIG.categoriesKey);
  if (!raw) return [...DEFAULT_CATEGORIES];
  try {
    const parsed = JSON.parse(raw) as string[];
    return Array.isArray(parsed) ? parsed : [...DEFAULT_CATEGORIES];
  } catch {
    return [...DEFAULT_CATEGORIES];
  }
}

export function saveCategories(categories: string[]): void {
  writeList(CONFIG.categoriesKey, categories);
}
