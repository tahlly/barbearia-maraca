import { listarServicosAtivos } from '../repositories/servico-repository';
import type { ServicoDTO } from '../dtos/servico-dto';

export async function obterServicosAtivos(): Promise<ServicoDTO[]> {
  return listarServicosAtivos();
}