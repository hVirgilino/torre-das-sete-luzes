import { sql } from './db';
import { ErroHttp } from './http';

/**
 * Rate limit por janela fixa, guardado no próprio Postgres.
 *
 * Janela fixa deixa passar uma rajada na virada da janela; para o volume deste
 * jogo isso é irrelevante, e evita depender de um Redis só por causa disto.
 *
 * O UPDATE condicional e o INSERT ... ON CONFLICT fazem o incremento ser
 * atômico: duas invocações simultâneas da função não conseguem ler o mesmo
 * contador e gravar o mesmo valor.
 */
export async function limitar(
  chave: string,
  maximo: number,
  janelaSegundos: number
): Promise<void> {
  const linhas = (await sql`
    insert into rate_limit (chave, contador, janela_em)
    values (${chave}, 1, now())
    on conflict (chave) do update
      set contador = case
            when rate_limit.janela_em < now() - make_interval(secs => ${janelaSegundos})
            then 1
            else rate_limit.contador + 1
          end,
          janela_em = case
            when rate_limit.janela_em < now() - make_interval(secs => ${janelaSegundos})
            then now()
            else rate_limit.janela_em
          end
    returning contador
  `) as { contador: number }[];

  if ((linhas[0]?.contador ?? 0) > maximo) {
    throw new ErroHttp(429, 'muitas tentativas, aguarde um pouco');
  }
}
