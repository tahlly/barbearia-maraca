// DTOs do domínio Horários (horario_trabalho).

// `hora_inicio` e `hora_fim` são colunas TIME do Postgres; são trafegadas como
// string (ex.: "09:00:00" ou "09:00") pela API.
// `dia_semana` é inteiro 0-6 (0=domingo ... 6=sábado).

export interface HorarioTrabalho {
  id: string;
  funcionario_id: string;
  funcionario_nome: string;
  dia_semana: number;
  hora_inicio: string;
  hora_fim: string;
  ativo: boolean;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface CreateHorarioInput {
  funcionario_id: string;
  dia_semana: number;
  hora_inicio: string;
  hora_fim: string;
}

export interface UpdateHorarioInput {
  dia_semana?: number;
  hora_inicio?: string;
  hora_fim?: string;
}

export interface FuncionarioMin {
  id: string;
  nome: string;
  ativo: boolean;
}
