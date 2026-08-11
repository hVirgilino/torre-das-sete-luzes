/**
 * Chaves de operação do jogo — as duas coisas que se liga e desliga sem tocar
 * no código: a tela de manutenção e a fechadura que atravessa ela.
 *
 * São variáveis de **build** (`VITE_*`, embutidas no bundle pelo Vite), não de
 * runtime. Trocar o valor no painel da Vercel só vale depois de um redeploy —
 * o que serve bem para uma chave que se gira em dias de lançamento, e não a
 * cada minuto. Nada aqui é fronteira de segurança: quem abre o devtools passa
 * de qualquer jeito, e é por isso que o código do cofre continua sendo
 * conferido no servidor (ver `api/_rotas/manutencao.ts`).
 *
 * | VITE_MANUTENCAO | VITE_COFRE | o que acontece                              |
 * |-----------------|------------|---------------------------------------------|
 * | on              | on         | tela de manutenção; quem sabe o código entra |
 * | on              | off        | tela de manutenção para todos, sem saída     |
 * | off             | (qualquer) | jogo aberto; o cofre não tem o que trancar   |
 */

/** Aceita as formas que uma pessoa realmente digita num painel de deploy. */
const ligado = (valor: unknown): boolean =>
  ['1', 'on', 'true', 'sim', 'yes'].includes(String(valor ?? '').trim().toLowerCase());

const desligado = (valor: unknown): boolean =>
  ['0', 'off', 'false', 'nao', 'não', 'no'].includes(String(valor ?? '').trim().toLowerCase());

/**
 * Sem a variável, o padrão depende de onde o jogo está rodando.
 *
 * Em produção a manutenção fica **ligada**: esquecer de configurar não pode
 * abrir o jogo ao mundo por acidente — o erro tem de ser para o lado seguro.
 * No `npm run dev` fica desligada, senão desenvolver qualquer tela viraria
 * digitar o código a cada recarga.
 */
const padraoManutencao = !import.meta.env.DEV;

const bruto = (valor: unknown, padrao: boolean): boolean => {
  if (ligado(valor)) return true;
  if (desligado(valor)) return false;
  return padrao;
};

/** Mostrar a tela de manutenção no lugar do menu. */
export const EM_MANUTENCAO = bruto(import.meta.env.VITE_MANUTENCAO, padraoManutencao);

/**
 * Desenhar a fechadura do cofre na tela de manutenção. Desligada, a tela vira
 * só o recado — nem quem já digitou o código antes atravessa, porque o cofre é
 * a única passagem e ela deixou de existir.
 */
export const COFRE_ATIVO = bruto(import.meta.env.VITE_COFRE, true);
