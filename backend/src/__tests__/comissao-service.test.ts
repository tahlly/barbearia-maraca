import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  obterConfiguracao,
  atualizarConfiguracao,
  listarComissoesDoFuncionario,
  salvarComissoesDoFuncionario,
  aplicarComissaoNaConclusao,
  removerComissaoDaConclusao,
} from '../services/comissao-service';
import { ForbiddenError } from '../errors/ForbiddenError';
import { NotFoundError } from '../errors/NotFoundError';
import { ValidationError } from '../errors/ValidationError';

// ── Mocks ─────────────────────────────────────────────────────

// Declarados ANTES dos vi.mock (mesmo padrão do agendamento-service.test.ts):
// os factories referenciam estas funções quando o módulo sob teste é importado.
const transactionMock = vi.fn();
const exigirPermissaoMock = vi.fn();
const buscarConfiguracaoComissaoMock = vi.fn();
const upsertConfiguracaoComissaoMock = vi.fn();
const listarComissoesDoFuncionarioRepoMock = vi.fn();
const substituirComissoesDoFuncionarioMock = vi.fn();
const buscarPercentualComissaoMock = vi.fn();
const buscarDadosParaComissaoDeAgendamentoMock = vi.fn();
const buscarDespesaComissaoPorAgendamentoMock = vi.fn();
const criarDespesaComissaoAutomaticaMock = vi.fn();
const removerDespesaComissaoPorAgendamentoMock = vi.fn();
const buscarFuncionarioPorIdMock = vi.fn();
const buscarServicoPorIdMock = vi.fn();

vi.mock('../database/connection', () => ({
  default: {
    transaction: (...args: unknown[]) => transactionMock(...args),
  },
}));

vi.mock('../services/permissao-service', () => ({
  exigirPermissao: (...args: unknown[]) => exigirPermissaoMock(...args),
}));

vi.mock('../repositories/comissao-repository', () => ({
  buscarConfiguracaoComissao: (...args: unknown[]) => buscarConfiguracaoComissaoMock(...args),
  upsertConfiguracaoComissao: (...args: unknown[]) => upsertConfiguracaoComissaoMock(...args),
  listarComissoesDoFuncionario: (...args: unknown[]) => listarComissoesDoFuncionarioRepoMock(...args),
  substituirComissoesDoFuncionario: (...args: unknown[]) => substituirComissoesDoFuncionarioMock(...args),
  buscarPercentualComissao: (...args: unknown[]) => buscarPercentualComissaoMock(...args),
  buscarDadosParaComissaoDeAgendamento: (...args: unknown[]) => buscarDadosParaComissaoDeAgendamentoMock(...args),
  buscarDespesaComissaoPorAgendamento: (...args: unknown[]) => buscarDespesaComissaoPorAgendamentoMock(...args),
  criarDespesaComissaoAutomatica: (...args: unknown[]) => criarDespesaComissaoAutomaticaMock(...args),
  removerDespesaComissaoPorAgendamento: (...args: unknown[]) => removerDespesaComissaoPorAgendamentoMock(...args),
}));

vi.mock('../repositories/funcionario-repository', () => ({
  buscarPorId: (...args: unknown[]) => buscarFuncionarioPorIdMock(...args),
}));

vi.mock('../repositories/servico-repository', () => ({
  buscarServicoPorId: (...args: unknown[]) => buscarServicoPorIdMock(...args),
}));

// ── Helpers ───────────────────────────────────────────────────

const trxFake = { transacao: true };

// Retorna um ID de usuário coerente com o papel (as services recebem
// `usuarioId: string` — mantendo o padrão dos demais arquivos de teste).
function usuario(role: string): string {
  return `user-${role}`;
}

function funcionario() {
  return {
    id: 'func-1',
    nome: 'João Pedro',
    cargo: 'barbeiro',
    ativo: true,
  };
}

function servicoValido(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'svc-1',
    nome: 'Corte',
    preco: '45.00',
    ativo: true,
    ...overrides,
  };
}

function comissaoSalva(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    servico_id: 'svc-1',
    servico_nome: 'Corte',
    percentual: '40.00',
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  // Defaults seguros: usuário com permissão, transação executa o callback.
  exigirPermissaoMock.mockResolvedValue(undefined);
  transactionMock.mockImplementation(async (cb: (trx: unknown) => Promise<unknown>) => cb(trxFake));
});

// ── Interruptor global (spec 3.4) ────────────────────────────

describe('obterConfiguracao', () => {
  it('devolve comissao_ativa false quando a linha singleton não existe (não inventa linha)', async () => {
    buscarConfiguracaoComissaoMock.mockResolvedValue(null);

    const configuracao = await obterConfiguracao(usuario('admin'), 'admin');

    expect(configuracao).toEqual({ comissao_ativa: false });
    expect(buscarConfiguracaoComissaoMock).toHaveBeenCalledTimes(1);
  });

  it('devolve true quando a linha existe com comissao_ativa true', async () => {
    buscarConfiguracaoComissaoMock.mockResolvedValue(true);

    const configuracao = await obterConfiguracao(usuario('admin'), 'admin');

    expect(configuracao).toEqual({ comissao_ativa: true });
  });

  it('nega quem não tem ver_financeiro e nada é consultado', async () => {
    exigirPermissaoMock.mockRejectedValue(new ForbiddenError());

    await expect(obterConfiguracao(usuario('recepcionista'), 'recepcionista')).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    expect(buscarConfiguracaoComissaoMock).not.toHaveBeenCalled();
  });
});

describe('atualizarConfiguracao', () => {
  it('faz upsert ligando a comissão e devolve o estado salvo', async () => {
    upsertConfiguracaoComissaoMock.mockResolvedValue(undefined);

    const configuracao = await atualizarConfiguracao(usuario('admin'), 'admin', {
      comissao_ativa: true,
    });

    expect(upsertConfiguracaoComissaoMock).toHaveBeenCalledWith(true);
    expect(configuracao).toEqual({ comissao_ativa: true });
  });

  it('desativar a comissão NÃO apaga as linhas de comissao_servico (só para de aplicar)', async () => {
    upsertConfiguracaoComissaoMock.mockResolvedValue(undefined);

    const configuracao = await atualizarConfiguracao(usuario('admin'), 'admin', {
      comissao_ativa: false,
    });

    expect(upsertConfiguracaoComissaoMock).toHaveBeenCalledWith(false);
    expect(configuracao).toEqual({ comissao_ativa: false });
    // Nenhuma função que mexe em comissao_servico é chamada durante a desativação.
    expect(substituirComissoesDoFuncionarioMock).not.toHaveBeenCalled();
    expect(listarComissoesDoFuncionarioRepoMock).not.toHaveBeenCalled();
  });

  it('rejeita comissao_ativa que não seja booleano', async () => {
    await expect(
      atualizarConfiguracao(usuario('admin'), 'admin', { comissao_ativa: 'sim' as unknown as boolean }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(upsertConfiguracaoComissaoMock).not.toHaveBeenCalled();
  });

  it('nega quem não tem ver_financeiro', async () => {
    exigirPermissaoMock.mockRejectedValue(new ForbiddenError());

    await expect(
      atualizarConfiguracao(usuario('recepcionista'), 'recepcionista', { comissao_ativa: true }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(upsertConfiguracaoComissaoMock).not.toHaveBeenCalled();
  });
});

// ── Listagem de comissões do funcionário (spec 3.5) ────────────

describe('listarComissoesDoFuncionario', () => {
  it('lista as comissões do funcionário com nome do serviço', async () => {
    buscarFuncionarioPorIdMock.mockResolvedValue(funcionario());
    listarComissoesDoFuncionarioRepoMock.mockResolvedValue([
      comissaoSalva(),
      comissaoSalva({ servico_id: 'svc-2', servico_nome: 'Barba', percentual: '50.00' }),
    ]);

    const comissoes = await listarComissoesDoFuncionario(usuario('admin'), 'admin', 'func-1');

    expect(buscarFuncionarioPorIdMock).toHaveBeenCalledWith('func-1');
    expect(listarComissoesDoFuncionarioRepoMock).toHaveBeenCalledWith('func-1');
    expect(comissoes).toEqual([
      { servico_id: 'svc-1', servico_nome: 'Corte', percentual: '40.00' },
      { servico_id: 'svc-2', servico_nome: 'Barba', percentual: '50.00' },
    ]);
  });

  it('funcionário inexistente → NotFoundError', async () => {
    buscarFuncionarioPorIdMock.mockResolvedValue(null);

    await expect(
      listarComissoesDoFuncionario(usuario('admin'), 'admin', 'func-inexistente'),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(listarComissoesDoFuncionarioRepoMock).not.toHaveBeenCalled();
  });

  it('nega quem não tem ver_financeiro', async () => {
    exigirPermissaoMock.mockRejectedValue(new ForbiddenError());

    await expect(
      listarComissoesDoFuncionario(usuario('profissional'), 'profissional', 'func-1'),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(listarComissoesDoFuncionarioRepoMock).not.toHaveBeenCalled();
  });
});

// ── Salvamento (REPLACE) ───────────────────────────────────────

describe('salvarComissoesDoFuncionario', () => {
  it('substitui as linhas do funcionário em transação e devolve a lista salva', async () => {
    buscarFuncionarioPorIdMock.mockResolvedValue(funcionario());
    buscarServicoPorIdMock.mockResolvedValue(servicoValido());
    substituirComissoesDoFuncionarioMock.mockResolvedValue([comissaoSalva()]);

    const comissoes = await salvarComissoesDoFuncionario(usuario('admin'), 'admin', 'func-1', {
      comissoes: [
        { servico_id: 'svc-1', percentual: 40 },
        { servico_id: 'svc-2', percentual: 42.5 },
      ],
    });

    expect(transactionMock).toHaveBeenCalledTimes(1);
    expect(substituirComissoesDoFuncionarioMock).toHaveBeenCalledWith(
      'func-1',
      [
        { servico_id: 'svc-1', percentual: '40.00' },
        { servico_id: 'svc-2', percentual: '42.50' },
      ],
      trxFake,
    );
    expect(comissoes).toEqual([comissaoSalva()]);
  });

  it('lista vazia limpa as comissões (replace para nada)', async () => {
    buscarFuncionarioPorIdMock.mockResolvedValue(funcionario());
    substituirComissoesDoFuncionarioMock.mockResolvedValue([]);

    const comissoes = await salvarComissoesDoFuncionario(usuario('admin'), 'admin', 'func-1', {
      comissoes: [],
    });

    expect(substituirComissoesDoFuncionarioMock).toHaveBeenCalledWith('func-1', [], trxFake);
    expect(comissoes).toEqual([]);
  });

  it('funcionário inexistente → NotFoundError antes de qualquer escrita', async () => {
    buscarFuncionarioPorIdMock.mockResolvedValue(null);

    await expect(
      salvarComissoesDoFuncionario(usuario('admin'), 'admin', 'func-x', {
        comissoes: [{ servico_id: 'svc-1', percentual: 40 }],
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(substituirComissoesDoFuncionarioMock).not.toHaveBeenCalled();
    expect(transactionMock).not.toHaveBeenCalled();
  });

  it('serviço inexistente → ValidationError', async () => {
    buscarFuncionarioPorIdMock.mockResolvedValue(funcionario());
    buscarServicoPorIdMock.mockResolvedValue(null);

    await expect(
      salvarComissoesDoFuncionario(usuario('admin'), 'admin', 'func-1', {
        comissoes: [{ servico_id: 'svc-1', percentual: 40 }],
      }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(substituirComissoesDoFuncionarioMock).not.toHaveBeenCalled();
  });

  it('serviço inativo → ValidationError', async () => {
    buscarFuncionarioPorIdMock.mockResolvedValue(funcionario());
    buscarServicoPorIdMock.mockResolvedValue(servicoValido({ ativo: false }));

    await expect(
      salvarComissoesDoFuncionario(usuario('admin'), 'admin', 'func-1', {
        comissoes: [{ servico_id: 'svc-1', percentual: 40 }],
      }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(substituirComissoesDoFuncionarioMock).not.toHaveBeenCalled();
  });

  it('percentual não numérico → ValidationError', async () => {
    buscarFuncionarioPorIdMock.mockResolvedValue(funcionario());
    buscarServicoPorIdMock.mockResolvedValue(servicoValido());

    await expect(
      salvarComissoesDoFuncionario(usuario('admin'), 'admin', 'func-1', {
        comissoes: [{ servico_id: 'svc-1', percentual: '40' as unknown as number }],
      }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(substituirComissoesDoFuncionarioMock).not.toHaveBeenCalled();
  });

  it('percentual abaixo de 0 → ValidationError', async () => {
    buscarFuncionarioPorIdMock.mockResolvedValue(funcionario());

    await expect(
      salvarComissoesDoFuncionario(usuario('admin'), 'admin', 'func-1', {
        comissoes: [{ servico_id: 'svc-1', percentual: -1 }],
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('percentual acima de 100 → ValidationError', async () => {
    buscarFuncionarioPorIdMock.mockResolvedValue(funcionario());

    await expect(
      salvarComissoesDoFuncionario(usuario('admin'), 'admin', 'func-1', {
        comissoes: [{ servico_id: 'svc-1', percentual: 100.01 }],
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('percentual com mais de 2 casas decimais → ValidationError', async () => {
    buscarFuncionarioPorIdMock.mockResolvedValue(funcionario());

    await expect(
      salvarComissoesDoFuncionario(usuario('admin'), 'admin', 'func-1', {
        comissoes: [{ servico_id: 'svc-1', percentual: 40.001 }],
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('serviço duplicado na lista → ValidationError', async () => {
    buscarFuncionarioPorIdMock.mockResolvedValue(funcionario());
    buscarServicoPorIdMock.mockResolvedValue(servicoValido());

    await expect(
      salvarComissoesDoFuncionario(usuario('admin'), 'admin', 'func-1', {
        comissoes: [
          { servico_id: 'svc-1', percentual: 40 },
          { servico_id: 'svc-1', percentual: 45 },
        ],
      }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(substituirComissoesDoFuncionarioMock).not.toHaveBeenCalled();
  });

  it('comissoes ausente → ValidationError', async () => {
    buscarFuncionarioPorIdMock.mockResolvedValue(funcionario());

    await expect(
      salvarComissoesDoFuncionario(usuario('admin'), 'admin', 'func-1', {
        comissoes: undefined as unknown as Array<{ servico_id: string; percentual: number }>,
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('nega quem não tem ver_financeiro', async () => {
    exigirPermissaoMock.mockRejectedValue(new ForbiddenError());

    await expect(
      salvarComissoesDoFuncionario(usuario('recepcionista'), 'recepcionista', 'func-1', {
        comissoes: [{ servico_id: 'svc-1', percentual: 40 }],
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(transactionMock).not.toHaveBeenCalled();
  });
});

// ── Hooks automáticos (Passo 5) ───────────────────────────────

describe('aplicarComissaoNaConclusao', () => {
  function dadosComissao(overrides: Partial<Record<string, unknown>> = {}) {
    return {
      funcionario_id: 'func-1',
      funcionario_nome: 'João Pedro',
      servico_id: 'svc-1',
      servico_preco: '45.00',
      data: '2026-09-10',
      ...overrides,
    };
  }

  it('comissão ativa + percentual > 0 cria despesa com valor = preço × percentual / 100', async () => {
    buscarConfiguracaoComissaoMock.mockResolvedValue(true);
    buscarDespesaComissaoPorAgendamentoMock.mockResolvedValue(false);
    buscarDadosParaComissaoDeAgendamentoMock.mockResolvedValue(dadosComissao());
    buscarPercentualComissaoMock.mockResolvedValue('40.00');
    criarDespesaComissaoAutomaticaMock.mockResolvedValue(undefined);

    await aplicarComissaoNaConclusao({ agendamentoId: 'ag-1', trx: trxFake });

    expect(criarDespesaComissaoAutomaticaMock).toHaveBeenCalledTimes(1);
    expect(criarDespesaComissaoAutomaticaMock).toHaveBeenCalledWith(
      {
        descricao: 'Comissão João Pedro',
        valor: '18.00',
        data: '2026-09-10',
        funcionarioId: 'func-1',
        agendamentoId: 'ag-1',
      },
      trxFake,
    );
  });

  it('arredonda centavos com aritmética EXATA (BigInt): R$ 1,25 × 80,40% → R$ 1,01 (e não 1,00)', async () => {
    buscarConfiguracaoComissaoMock.mockResolvedValue(true);
    buscarDespesaComissaoPorAgendamentoMock.mockResolvedValue(false);
    buscarDadosParaComissaoDeAgendamentoMock.mockResolvedValue(
      dadosComissao({ servico_preco: '1.25' }),
    );
    buscarPercentualComissaoMock.mockResolvedValue('80.40');
    criarDespesaComissaoAutomaticaMock.mockResolvedValue(undefined);

    await aplicarComissaoNaConclusao({ agendamentoId: 'ag-1', trx: trxFake });

    expect(criarDespesaComissaoAutomaticaMock).toHaveBeenCalledTimes(1);
    expect(criarDespesaComissaoAutomaticaMock).toHaveBeenCalledWith(
      expect.objectContaining({ valor: '1.01' }),
      trxFake,
    );
  });

  it('não duplica quando já existe despesa de comissão para o agendamento', async () => {
    buscarConfiguracaoComissaoMock.mockResolvedValue(true);
    buscarDespesaComissaoPorAgendamentoMock.mockResolvedValue(true);

    await aplicarComissaoNaConclusao({ agendamentoId: 'ag-1', trx: trxFake });

    expect(buscarDadosParaComissaoDeAgendamentoMock).not.toHaveBeenCalled();
    expect(criarDespesaComissaoAutomaticaMock).not.toHaveBeenCalled();
  });

  it('comissão inativa → não cria despesa', async () => {
    buscarConfiguracaoComissaoMock.mockResolvedValue(false);

    await aplicarComissaoNaConclusao({ agendamentoId: 'ag-1', trx: trxFake });

    expect(criarDespesaComissaoAutomaticaMock).not.toHaveBeenCalled();
  });

  it('sem percentual configurado → não cria despesa', async () => {
    buscarConfiguracaoComissaoMock.mockResolvedValue(true);
    buscarDespesaComissaoPorAgendamentoMock.mockResolvedValue(false);
    buscarDadosParaComissaoDeAgendamentoMock.mockResolvedValue(dadosComissao());
    buscarPercentualComissaoMock.mockResolvedValue(null);

    await aplicarComissaoNaConclusao({ agendamentoId: 'ag-1', trx: trxFake });

    expect(criarDespesaComissaoAutomaticaMock).not.toHaveBeenCalled();
  });

  it('percentual 0 → não cria despesa', async () => {
    buscarConfiguracaoComissaoMock.mockResolvedValue(true);
    buscarDespesaComissaoPorAgendamentoMock.mockResolvedValue(false);
    buscarDadosParaComissaoDeAgendamentoMock.mockResolvedValue(dadosComissao());
    buscarPercentualComissaoMock.mockResolvedValue('0.00');

    await aplicarComissaoNaConclusao({ agendamentoId: 'ag-1', trx: trxFake });

    expect(criarDespesaComissaoAutomaticaMock).not.toHaveBeenCalled();
  });

  it('agendamento sem dados (sumiu) → não cria despesa', async () => {
    buscarConfiguracaoComissaoMock.mockResolvedValue(true);
    buscarDespesaComissaoPorAgendamentoMock.mockResolvedValue(false);
    buscarDadosParaComissaoDeAgendamentoMock.mockResolvedValue(null);

    await aplicarComissaoNaConclusao({ agendamentoId: 'ag-1', trx: trxFake });

    expect(criarDespesaComissaoAutomaticaMock).not.toHaveBeenCalled();
  });
});

describe('removerComissaoDaConclusao', () => {
  it('remove a despesa de comissão vinculada ao agendamento', async () => {
    removerDespesaComissaoPorAgendamentoMock.mockResolvedValue(undefined);

    await removerComissaoDaConclusao({ agendamentoId: 'ag-1', trx: trxFake });

    expect(removerDespesaComissaoPorAgendamentoMock).toHaveBeenCalledWith('ag-1', trxFake);
  });
});