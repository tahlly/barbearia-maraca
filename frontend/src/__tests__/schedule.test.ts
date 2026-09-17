import { describe, it, expect } from 'vitest';
import {
  excecoesToScheduleConfig,
  diffScheduleExceptions,
  type ScheduleConfig,
} from '../services/schedule';

/* ------------------------------------------------------------------ */
/*  Mapeamentos puros das exceções de horário (API ↔ ScheduleConfig)  */
/* ------------------------------------------------------------------ */

interface ExcecaoFixture {
  id: string;
  funcionario_id: string;
  funcionario_nome: string;
  data: string;
  hora_inicio: string;
  hora_fim: string;
  tipo: 'bloqueio' | 'liberacao';
  motivo: string | null;
  created_at: string;
  updated_at: string;
}

function excecaoFixture(overrides: Partial<ExcecaoFixture> = {}): ExcecaoFixture {
  return {
    id: 'rec-id',
    funcionario_id: 'func-id',
    funcionario_nome: 'Barbeiro Teste',
    data: '2026-09-12',
    hora_inicio: '00:00',
    hora_fim: '23:59',
    tipo: 'bloqueio',
    motivo: null,
    created_at: '2026-09-01T12:00:00.000Z',
    updated_at: '2026-09-01T12:00:00.000Z',
    ...overrides,
  };
}

function configFixture(
  overrides: Partial<Pick<ScheduleConfig, 'blockedDates' | 'exceptions'>> = {},
): ScheduleConfig {
  return {
    weekly: {
      0: { open: false, start: '09:00', end: '19:00' },
      1: { open: true, start: '09:00', end: '19:00' },
      2: { open: true, start: '09:00', end: '19:00' },
      3: { open: true, start: '09:00', end: '19:00' },
      4: { open: true, start: '09:00', end: '19:00' },
      5: { open: true, start: '09:00', end: '19:00' },
      6: { open: true, start: '09:00', end: '19:00' },
    },
    blockedDates: [],
    exceptions: [],
    ...overrides,
  };
}

describe('excecoesToScheduleConfig — API /horario-excecoes → ScheduleConfig', () => {
  it('retorna listas vazias sem exceções', () => {
    expect(excecoesToScheduleConfig([])).toEqual({ blockedDates: [], exceptions: [] });
  });

  it('mapeia tipo=bloqueio para blockedDates (dia inteiro sem horário)', () => {
    const result = excecoesToScheduleConfig([
      excecaoFixture({ id: 'b1', data: '2026-09-12' }),
      excecaoFixture({ id: 'b2', data: '2026-09-13', hora_inicio: '09:00:00', hora_fim: '18:00:00' }),
    ]);
    expect(result.blockedDates).toEqual(['2026-09-12', '2026-09-13']);
    expect(result.exceptions).toEqual([]);
  });

  it('mapeia tipo=liberacao para exceptions com horários normalizados', () => {
    const result = excecoesToScheduleConfig([
      excecaoFixture({ id: 'l1', tipo: 'liberacao', data: '2026-09-14', hora_inicio: '09:00:00', hora_fim: '18:00:00' }),
    ]);
    expect(result.blockedDates).toEqual([]);
    expect(result.exceptions).toEqual([
      { dateIso: '2026-09-14', start: '09:00', end: '18:00' },
    ]);
  });

  it('deduplica datas repetidas para o mesmo tipo (prevalece a última)', () => {
    const result = excecoesToScheduleConfig([
      excecaoFixture({ id: 'b1', data: '2026-09-12' }),
      excecaoFixture({ id: 'b2', data: '2026-09-12' }),
    ]);
    expect(result.blockedDates).toEqual(['2026-09-12']);
  });

  it('mantém bloqueio e liberação da mesma data em buckets separados', () => {
    const result = excecoesToScheduleConfig([
      excecaoFixture({ id: 'b1', data: '2026-09-12' }),
      excecaoFixture({ id: 'l1', tipo: 'liberacao', data: '2026-09-12', hora_inicio: '09:00', hora_fim: '18:00' }),
    ]);
    expect(result.blockedDates).toEqual(['2026-09-12']);
    expect(result.exceptions).toEqual([
      { dateIso: '2026-09-12', start: '09:00', end: '18:00' },
    ]);
  });
});

describe('diffScheduleExceptions — ScheduleConfig → operações idempotentes', () => {
  it('cria bloqueio ausente com mapeamento obrigatório (00:00–23:59, motivo null)', () => {
    const config = configFixture({ blockedDates: ['2026-09-12'] });
    const diff = diffScheduleExceptions(config, [], 'func-id');

    expect(diff.create).toEqual([
      {
        funcionario_id: 'func-id',
        data: '2026-09-12',
        hora_inicio: '00:00',
        hora_fim: '23:59',
        tipo: 'bloqueio',
        motivo: null,
      },
    ]);
    expect(diff.update).toEqual([]);
    expect(diff.remove).toEqual([]);
  });

  it('cria abertura excepcional ausente com os horários desejados', () => {
    const config = configFixture({
      exceptions: [{ dateIso: '2026-09-14', start: '09:00', end: '18:00' }],
    });
    const diff = diffScheduleExceptions(config, [], 'func-id');

    expect(diff.create).toEqual([
      {
        funcionario_id: 'func-id',
        data: '2026-09-14',
        hora_inicio: '09:00',
        hora_fim: '18:00',
        tipo: 'liberacao',
        motivo: null,
      },
    ]);
  });

  it('não gera operações quando o estado desejado já existe (idempotência)', () => {
    const config = configFixture({
      blockedDates: ['2026-09-12'],
      exceptions: [{ dateIso: '2026-09-14', start: '09:00', end: '18:00' }],
    });
    const existing = [
      excecaoFixture({ id: 'b1', data: '2026-09-12', hora_inicio: '00:00', hora_fim: '23:59' }),
      excecaoFixture({ id: 'l1', tipo: 'liberacao', data: '2026-09-14', hora_inicio: '09:00', hora_fim: '18:00' }),
    ];

    const diff = diffScheduleExceptions(config, existing, 'func-id');
    expect(diff.create).toEqual([]);
    expect(diff.update).toEqual([]);
    expect(diff.remove).toEqual([]);
  });

  it('atualiza (PUT) registro reutilizável quando os horários mudam', () => {
    const config = configFixture({
      blockedDates: ['2026-09-12'],
      exceptions: [{ dateIso: '2026-09-14', start: '10:00', end: '11:00' }],
    });
    const existing = [
      // Bloqueio parcial (criado por outra via): normaliza para dia inteiro via PUT.
      excecaoFixture({ id: 'b1', data: '2026-09-12', hora_inicio: '10:00', hora_fim: '12:00' }),
      excecaoFixture({ id: 'l1', tipo: 'liberacao', data: '2026-09-14', hora_inicio: '09:00', hora_fim: '18:00' }),
    ];

    const diff = diffScheduleExceptions(config, existing, 'func-id');
    expect(diff.create).toEqual([]);
    expect(diff.update).toEqual([
      { id: 'b1', body: { hora_inicio: '00:00', hora_fim: '23:59' } },
      { id: 'l1', body: { hora_inicio: '10:00', hora_fim: '11:00' } },
    ]);
    expect(diff.remove).toEqual([]);
  });

  it('remove (DELETE) apenas registros que saíram do estado desejado', () => {
    const config = configFixture({
      blockedDates: ['2026-09-12'],
      exceptions: [{ dateIso: '2026-09-14', start: '09:00', end: '18:00' }],
    });
    const existing = [
      excecaoFixture({ id: 'b1', data: '2026-09-12', hora_inicio: '00:00', hora_fim: '23:59' }),
      excecaoFixture({ id: 'b2', data: '2026-09-13', hora_inicio: '00:00', hora_fim: '23:59' }),
      excecaoFixture({ id: 'l1', tipo: 'liberacao', data: '2026-09-14', hora_inicio: '09:00', hora_fim: '18:00' }),
      excecaoFixture({ id: 'l2', tipo: 'liberacao', data: '2026-09-15', hora_inicio: '10:00', hora_fim: '12:00' }),
    ];

    const diff = diffScheduleExceptions(config, existing, 'func-id');
    expect(diff.create).toEqual([]);
    expect(diff.update).toEqual([]);
    expect(diff.remove).toEqual(['b2', 'l2']);
  });

  it('não reaproveita registro de tipo diferente para cobrir o desejado', () => {
    // Data desejada como bloqueio mas existindo apenas liberação → POST bloqueio.
    const config = configFixture({ blockedDates: ['2026-09-12'] });
    const existing = [
      excecaoFixture({ id: 'l1', tipo: 'liberacao', data: '2026-09-12', hora_inicio: '09:00', hora_fim: '18:00' }),
    ];

    const diff = diffScheduleExceptions(config, existing, 'func-id');
    expect(diff.create).toHaveLength(1);
    expect(diff.create[0]).toMatchObject({ data: '2026-09-12', tipo: 'bloqueio' });
    // A liberação existente NÃO está no desejado e deve ser excluída.
    expect(diff.remove).toEqual(['l1']);
  });

  it('deduplica datas repetidas no estado desejado', () => {
    const config = configFixture({
      blockedDates: ['2026-09-12', '2026-09-12'],
      exceptions: [
        { dateIso: '2026-09-14', start: '09:00', end: '18:00' },
        { dateIso: '2026-09-14', start: '09:00', end: '18:00' },
      ],
    });
    const diff = diffScheduleExceptions(config, [], 'func-id');

    expect(diff.create).toHaveLength(2);
    expect(diff.create.filter((c) => c.tipo === 'bloqueio')).toHaveLength(1);
    expect(diff.create.filter((c) => c.tipo === 'liberacao')).toHaveLength(1);
  });
});