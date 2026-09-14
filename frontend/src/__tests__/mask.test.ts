import { describe, it, expect } from 'vitest';
import { maskPercent } from '../ui/mask';

/* ------------------------------------------------------------------ */
/*  maskPercent (spec 3.5: somente inteiros 1 a 100)                   */
/* ------------------------------------------------------------------ */
describe('maskPercent', () => {
  it('mantém inteiro válido', () => {
    expect(maskPercent('40')).toBe('40');
  });

  it('remover não-dígitos', () => {
    expect(maskPercent('4a0.%')).toBe('40');
  });

  it('limita a 3 dígitos preservando centena válida', () => {
    expect(maskPercent('099')).toBe('99');
  });

  it('limita o teto em 100', () => {
    expect(maskPercent('150')).toBe('100');
  });

  it('limita o teto em 100 para entrada com mais de 3 dígitos', () => {
    expect(maskPercent('1234')).toBe('100');
  });

  it('neutraliza zero isolado (não paga comissão)', () => {
    expect(maskPercent('0')).toBe('');
  });

  it('neutraliza sequência com zero à frente isolado após limpeza', () => {
    expect(maskPercent('00')).toBe('');
  });

  it('aceita 1 (limite inferior)', () => {
    expect(maskPercent('1')).toBe('1');
  });

  it('aceita 100 (limite superior)', () => {
    expect(maskPercent('100')).toBe('100');
  });

  it('string vazia permanece vazia', () => {
    expect(maskPercent('')).toBe('');
  });
});