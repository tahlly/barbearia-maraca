// DTOs do domínio Exceções de Horário (horario_excecao).

// `data` é coluna DATE do Postgres; é trafegada como string "YYYY-MM-DD".
// `hora_inicio` e `hora_fim` são colunas TIME; são trafegadas como string
// (ex.: "09:00:00" ou "09:00") pela API.
// `tipo` é enum tipo_excecao_horario ('bloqueio' | 'liberacao').

export type TipoExcecaoHorario = 'bloqueio' | 'liberacao';

export interface HorarioExcecao {
  id: string;
  funcionario_id: string;
  funcionario_nome: string;
  data: string;
  hora_inicio: string;
  hora_fim: string;
  tipo: TipoExcecaoHorario;
  motivo: string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface CreateHorarioExcecaoInput {
  funcionario_id: string;
  data: string;
  hora_inicio: string;
  hora_fim: string;
  tipo: TipoExcecaoHorario;
  motivo?: string | null;
}

export interface UpdateHorarioExcecaoInput {
  data?: string;
  hora_inicio?: string;
  hora_fim?: string;
  tipo?: TipoExcecaoHorario;
  motivo?: string | null;
}
