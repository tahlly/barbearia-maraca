import { ValidationError } from '../errors/ValidationError';

/**
 * Validações de formato de data e hora usadas nos contratos HTTP.
 *
 * Separa a checagem da máscara (regex) da checagem de valor real:
 * "2026-99-99" passa na máscara mas é rejeitado como data de calendário,
 * e "24:00" passa em um regex genérico de dígitos mas é rejeitado como hora.
 */

/** Máscara de data "YYYY-MM-DD" (não valida se a data existe de verdade). */
export const DATA_ISO_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/** Hora no formato "HH:MM" com faixas válidas (00–23 : 00–59). */
export const HORA_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Valida se uma string "YYYY-MM-DD" é uma data de calendário real
 * (rejeita "2026-02-30", "2026-04-31", "2026-99-99", etc.).
 * Usa componentes UTC para não depender do fuso local do servidor.
 */
export function validarDataISO(valor: string): boolean {
  if (!DATA_ISO_REGEX.test(valor)) {
    return false;
  }

  const [ano, mes, dia] = valor.split('-').map(Number);
  const data = new Date(Date.UTC(ano, mes - 1, dia));

  return (
    data.getUTCFullYear() === ano &&
    data.getUTCMonth() === mes - 1 &&
    data.getUTCDate() === dia
  );
}

/**
 * Valida um intervalo de datas no formato "YYYY-MM-DD" e lança
 * `ValidationError` quando o formato é inválido ou `inicio` é maior que `fim`.
 *
 * Usada pelos resumos financeiros (`obterFaturamento`, `obterResumoDespesas`).
 */
export function validarIntervaloData(inicio: string, fim: string): void {
  if (!validarDataISO(inicio) || !validarDataISO(fim)) {
    throw new ValidationError('Intervalo de datas inválido');
  }
  if (inicio > fim) {
    throw new ValidationError('Data inicial não pode ser maior que a final');
  }
}