import { listarServicosAtivos } from '../repositories/servico-repository';
import type { ServicoResponse } from '../dtos/servico-dto';

export async function obterServicosAtivos(): Promise<ServicoResponse[]> {
  return listarServicosAtivos();
}