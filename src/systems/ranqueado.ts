import { Api, guardarEntrada, type EstadoCorrida } from './api';
import { State, type SaveData } from './state';

const CHAVE = 'cerimonia-da-luz:ranqueado:v1';

export interface Sessao {
  runId: string;
  token: string;
  dificuldade: string;
}

/**
 * Partida ranqueada: o servidor manda, o cliente obedece.
 *
 * O truque para isto não virar uma segunda implementação do jogo é o
 * espelhamento. Toda resposta do servidor é copiada para `State.save.candles`,
 * então a Torre, a HUD e as estações continuam lendo o `State` exatamente como
 * no modo casual — só que agora o `State` é um reflexo do banco, e não a fonte
 * da verdade. Quem escreve (responder, usar habilidade, acender) passa por aqui.
 */
class ModoRanqueado {
  sessao: Sessao | null = null;

  constructor() {
    this.carregar();
  }

  get ativo(): boolean {
    return this.sessao !== null;
  }

  private carregar() {
    try {
      const cru = localStorage.getItem(CHAVE);
      const s = cru ? JSON.parse(cru) : null;
      if (s && typeof s.runId === 'string' && typeof s.token === 'string') this.sessao = s;
    } catch {
      this.sessao = null;
    }
  }

  private persistir() {
    try {
      if (this.sessao) localStorage.setItem(CHAVE, JSON.stringify(this.sessao));
      else localStorage.removeItem(CHAVE);
    } catch {
      /* noop */
    }
  }

  /** Abre a corrida no servidor e prepara um save local só para desenhar. */
  async iniciar(nome: string, dificuldade: string): Promise<void> {
    const corrida = await Api.iniciarCorrida(nome, dificuldade);
    this.sessao = { runId: corrida.runId, token: corrida.token, dificuldade };
    this.persistir();

    State.newGame(nome);
    // a dificuldade que vale é a que o servidor registrou na corrida
    State.save!.difficulty = dificuldade as SaveData['difficulty'];
    this.espelhar(corrida);
  }

  /**
   * Copia o estado autoritativo para o save local.
   *
   * O `elapsedMs` local continua correndo só para a HUD; o tempo que vale é o
   * do servidor, medido entre `iniciada_em` e `concluida_em`.
   */
  espelhar(estado: EstadoCorrida): void {
    if (!State.save) return;
    State.save.candles = estado.velas.map((v) => ({ locks: v.locks, lit: v.lit }));
    State.save.protectionActive = estado.protecaoAtiva;
    State.persistSave();
  }

  async acender(vela: number) {
    const s = this.exigir();
    this.espelhar(await Api.acender(s.runId, s.token, vela));
  }

  async concluir() {
    const s = this.exigir();
    return Api.concluir(s.runId, s.token);
  }

  async submeter(capitulo: string | null) {
    const s = this.exigir();
    const r = await Api.submeter(s.runId, s.token, capitulo);
    guardarEntrada({ id: r.entradaId, token: r.entradaToken });
    return r;
  }

  exigir(): Sessao {
    if (!this.sessao) throw new Error('nenhuma corrida ranqueada em andamento');
    return this.sessao;
  }

  encerrar() {
    this.sessao = null;
    this.persistir();
  }
}

export const Ranqueado = new ModoRanqueado();
