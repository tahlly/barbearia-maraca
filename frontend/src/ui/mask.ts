/**
 * DDs brasileiros válidos: 11–99, exceto 20–29.
 * Aceita qualquer 2 dígitos na entrada, mas marca visualmente
 * como inválido quando o DDD não está na faixa aceita.
 */
import { formatCurrency } from "./format.js";

function isValidDDD(ddd: string): boolean {
  const num = Number(ddd);
  if (num >= 11 && num <= 99 && !(num >= 20 && num <= 29)) return true;
  return false;
}

export function maskPhone(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length === 0) return "";
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 6) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

/**
 * Retorna `true` se o telefone formatado possui DDD válido.
 * Útil para exibir feedback visual leve sem bloquear a digitação.
 */
export function isPhoneDddValid(value: string): boolean {
  const match = value.match(/^\((\d{2})\)/);
  return match ? isValidDDD(match[1]) : false;
}

export function attachPhoneMask(input: HTMLInputElement): void {
  input.addEventListener("input", () => {
    input.value = maskPhone(input.value);
  });
}

export function maskBookingCode(value: string): string {
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, "")
    .slice(0, 8);
}

export function attachCodeMask(input: HTMLInputElement): void {
  input.addEventListener("input", () => {
    input.value = maskBookingCode(input.value);
  });
}

export function attachUppercaseMask(input: HTMLInputElement): void {
  input.addEventListener("input", () => {
    const upper = input.value.toUpperCase();
    if (upper === input.value) return;
    const { selectionStart, selectionEnd } = input;
    input.value = upper;
    if (selectionStart !== null && selectionEnd !== null) {
      input.setSelectionRange(selectionStart, selectionEnd);
    }
  });
}

/**
 * Máscara de Moeda Brasileira em tempo de digitação.
 * Os dígitos digitados representam centavos (padrão de calculadora):
 *  "150" -> "R$ 1,50", "180000" -> "R$ 1.800,00".
 */
export function maskCurrency(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length === 0) return "R$ 0,00";
  return formatCurrency(Number(digits) / 100);
}

export function attachCurrencyMask(input: HTMLInputElement): void {
  input.addEventListener("input", () => {
    input.value = maskCurrency(input.value);
  });
}

/**
 * Converte o valor mascarado (ex.: "R$ 1.234,56") de volta para número.
 * Retorna 0 quando não há dígitos válidos.
 */
export function currencyToNumber(value: string): number {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 0) return 0;
  return Number(digits) / 100;
}

/**
 * Máscara de PERCENTUAL estrito (regra de comissão, spec 3.5): somente
 * inteiros de 1 a 100. Remove qualquer caractere não numérico, limita a 3
 * dígitos, neutraliza "0" isolado (vira vazio — "não paga comissão") e limita
 * o teto em 100. O sinal "%" NÃO entra no value (é sufixo visual do markup);
 * assim o payload do submit continua numérico puro.
 */
export function maskPercent(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 3);
  if (digits.length === 0) return "";
  const numero = Number(digits);
  // Zero (isolado ou sequência de zeros) = "não paga comissão": vazio.
  if (numero === 0) return "";
  if (numero > 100) return "100";
  return String(numero);
}

export function attachPercentMask(input: HTMLInputElement): void {
  input.addEventListener("input", () => {
    const next = maskPercent(input.value);
    if (next === input.value) return;
    input.value = next;
  });
}
