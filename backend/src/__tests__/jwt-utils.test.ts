import { describe, it, expect } from 'vitest';
import { parseExpiresInToMs } from '../utils/jwt-utils';

describe('parseExpiresInToMs', () => {
  it('converte segundos ("30s") para 30_000 ms', () => {
    expect(parseExpiresInToMs('30s')).toBe(30_000);
  });

  it('converte minutos ("30m") para 1_800_000 ms', () => {
    expect(parseExpiresInToMs('30m')).toBe(1_800_000);
  });

  it('converte horas ("2h") para 7_200_000 ms', () => {
    expect(parseExpiresInToMs('2h')).toBe(7_200_000);
  });

  it('converte dias ("7d") para 604_800_000 ms', () => {
    expect(parseExpiresInToMs('7d')).toBe(604_800_000);
  });

  it('trata número sem unidade ("30") como segundos → 30_000 ms', () => {
    expect(parseExpiresInToMs('30')).toBe(30_000);
  });

  it('trata undefined retornando fallback de 30 minutos', () => {
    expect(parseExpiresInToMs(undefined)).toBe(30 * 60 * 1000);
  });

  it('trata valor numérico como segundos', () => {
    expect(parseExpiresInToMs(60)).toBe(60_000);
  });

  it('retorna fallback para string inválida', () => {
    expect(parseExpiresInToMs('abc')).toBe(30 * 60 * 1000);
  });
});
