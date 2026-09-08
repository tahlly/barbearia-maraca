import { describe, it, expect } from 'vitest';
import { DATA_ISO_REGEX, HORA_REGEX, validarDataISO } from '../utils/validadores';

describe('validarDataISO', () => {
  it('aceita data válida comum', () => {
    expect(validarDataISO('2026-09-12')).toBe(true);
  });

  it('aceita 29/02 em ano bissexto', () => {
    expect(validarDataISO('2024-02-29')).toBe(true);
  });

  it('rejeita 29/02 em ano não bissexto', () => {
    expect(validarDataISO('2026-02-29')).toBe(false);
  });

  it('rejeita dia inexistente no mês', () => {
    expect(validarDataISO('2026-04-31')).toBe(false);
  });

  it('rejeita mês inexistente', () => {
    expect(validarDataISO('2026-13-01')).toBe(false);
  });

  it('rejeita valor que passa na máscara mas não é data real', () => {
    expect(validarDataISO('2026-99-99')).toBe(false);
  });

  it('rejeita formato fora do padrão', () => {
    expect(validarDataISO('12/09/2026')).toBe(false);
  });

  it('rejeita data incompleta', () => {
    expect(validarDataISO('2026-09')).toBe(false);
  });
});

describe('DATA_ISO_REGEX', () => {
  it('aceita máscara YYYY-MM-DD', () => {
    expect(DATA_ISO_REGEX.test('2026-09-12')).toBe(true);
    // A máscara aceita "2026-99-99"; a checagem real fica em validarDataISO.
    expect(DATA_ISO_REGEX.test('2026-99-99')).toBe(true);
  });
});

describe('HORA_REGEX', () => {
  it('aceita "09:00"', () => {
    expect(HORA_REGEX.test('09:00')).toBe(true);
  });

  it('aceita limite máximo "23:59"', () => {
    expect(HORA_REGEX.test('23:59')).toBe(true);
  });

  it('rejeita hora fora da faixa', () => {
    expect(HORA_REGEX.test('24:00')).toBe(false);
  });

  it('rejeita minuto fora da faixa', () => {
    expect(HORA_REGEX.test('09:60')).toBe(false);
  });

  it('rejeita texto não numérico', () => {
    expect(HORA_REGEX.test('abc')).toBe(false);
  });

  it('rejeita hora sem zero à esquerda', () => {
    expect(HORA_REGEX.test('9:00')).toBe(false);
  });

  it('rejeita entrada que geraria NaN no comparador de horas', () => {
    expect(HORA_REGEX.test('09:xx')).toBe(false);
  });
});