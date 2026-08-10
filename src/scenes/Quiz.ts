import Phaser from 'phaser';
import { FONTS, GAME_HEIGHT, GAME_WIDTH, LOCKS_RETURNED_ON_ABILITY, abilityByVela } from '../data/config';
import { State } from '../systems/state';
import { Audio } from '../systems/audio';
import { generateQuestion, Question } from '../systems/questions';
import { initSceneView, uiPx } from '../systems/display';
import { Api, ErroApi } from '../systems/api';
import { Ranqueado } from '../systems/ranqueado';

const LETTERS = ['A', 'B', 'C', 'D'];

/** tinta das alternativas: escura no pergaminho, clara sobre o vermelho de erro */
const OPT_INK = '#2c1c08';
const OPT_INK_ERRADA = '#f3e6c4';

interface OptionButton {
  container: Phaser.GameObjects.Container;
  bg: Phaser.GameObjects.Image;
  text: Phaser.GameObjects.Text;
  index: number;
  disabled: boolean;
}

export class QuizScene extends Phaser.Scene {
  private vela = 1;
  private practice = false;
  private question!: Question;
  private options: OptionButton[] = [];
  private locked = false; // aguardando feedback
  private remaining = 10;
  private frozen = false;
  private noReset = false;
  private timerBar!: Phaser.GameObjects.Image;
  private timerEvent!: Phaser.Time.TimerEvent;
  private questionText!: Phaser.GameObjects.Text;
  private origemText!: Phaser.GameObjects.Text;
  private locksText!: Phaser.GameObjects.Text;
  private feedback!: Phaser.GameObjects.Text;
  private hintText!: Phaser.GameObjects.Text;
  private abilityIcons: Phaser.GameObjects.Container[] = [];
  private buffIcons!: Phaser.GameObjects.Text;
  private lastTick = -1;
  /** partida ranqueada: pergunta, resposta e habilidade passam pelo servidor */
  private ranqueado = false;
  /** id da pergunta em aberto no servidor (só no ranqueado) */
  private questionId = '';
  /** evita disparar duas chamadas enquanto uma está no ar */
  private aguardando = false;

  constructor() {
    super('Quiz');
  }

  create(data: { vela: number; practice?: boolean }) {
    initSceneView(this);
    this.vela = data.vela;
    this.practice = !!data.practice;
    // o treino de Merlin nunca é ranqueado: não conta trancas nem tempo
    this.ranqueado = Ranqueado.ativo && !this.practice;
    this.questionId = '';
    this.aguardando = false;
    this.options = [];
    this.abilityIcons = [];
    this.locked = false;
    this.frozen = false;
    this.noReset = false;
    // o tempo gasto nas trancas também conta para o desafio de Merlin
    State.timerResume();

    // fundo escurecido + pergaminho
    this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'px').setDisplaySize(GAME_WIDTH, GAME_HEIGHT).setTint(0x04060f).setAlpha(0.82);
    const PW = 860;
    const PH = 470;
    this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'px').setDisplaySize(PW + 8, PH + 8).setTint(0x7a5227);
    this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'px').setDisplaySize(PW, PH).setTint(0xf3e6c4);

    const top = (GAME_HEIGHT - PH) / 2;

    // cabeçalho
    this.origemText = this.add
      .text(GAME_WIDTH / 2, top + 26, '', { fontFamily: FONTS.display, fontSize: uiPx(19), color: '#7a1f1f' })
      .setOrigin(0.5);
    this.locksText = this.add
      .text(GAME_WIDTH / 2 - PW / 2 + 18, top + 16, '', { fontFamily: FONTS.body, fontSize: uiPx(16), color: '#5b3a1e' })
      .setOrigin(0, 0);

    const retreat = this.add
      .text(GAME_WIDTH / 2 + PW / 2 - 18, top + 16, '✕ recuar', { fontFamily: FONTS.body, fontSize: uiPx(16), color: '#7a1f1f' })
      .setOrigin(1, 0)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.close());
    this.input.keyboard!.on('keydown-ESC', () => this.close());

    // timer
    this.add
      .image(GAME_WIDTH / 2, top + 52, 'px')
      .setDisplaySize(PW - 60, 10)
      .setTint(0xdcc494);
    this.timerBar = this.add
      .image(GAME_WIDTH / 2 - (PW - 60) / 2, top + 52, 'px')
      .setOrigin(0, 0.5)
      .setDisplaySize(PW - 60, 10)
      .setTint(0xa53434);

    // questão
    this.questionText = this.add
      .text(GAME_WIDTH / 2, top + 130, '', {
        fontFamily: FONTS.body,
        fontSize: uiPx(21),
        color: '#2c1c08',
        align: 'center',
        wordWrap: { width: PW - 90 },
        lineSpacing: 4
      })
      .setOrigin(0.5);
    this.hintText = this.add
      .text(GAME_WIDTH / 2, top + 205, '', { fontFamily: FONTS.body, fontSize: uiPx(17), fontStyle: 'italic', color: '#27408b' })
      .setOrigin(0.5);

    // alternativas (2 colunas)
    const optW = (PW - 90) / 2;
    for (let i = 0; i < 4; i++) {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = GAME_WIDTH / 2 + (col === 0 ? -optW / 2 - 10 : optW / 2 + 10);
      const y = top + 258 + row * 66;
      const bg = this.add.image(0, 0, 'px').setDisplaySize(optW, 56).setTint(0xdcc494);
      const text = this.add
        .text(-optW / 2 + 14, 0, '', {
          fontFamily: FONTS.body,
          fontSize: uiPx(17),
          color: OPT_INK,
          wordWrap: { width: optW - 28 }
        })
        .setOrigin(0, 0.5);
      const container = this.add.container(x, y, [bg, text]);
      container.setSize(optW, 56).setInteractive({ useHandCursor: true });
      const btn: OptionButton = { container, bg, text, index: i, disabled: false };
      container.on('pointerdown', () => this.answer(btn));
      container.on('pointerover', () => !btn.disabled && !this.locked && bg.setTint(0xe8d3a3));
      container.on('pointerout', () => !btn.disabled && !this.locked && bg.setTint(0xdcc494));
      this.options.push(btn);
    }
    // teclas A–D
    ['A', 'B', 'C', 'D'].forEach((k, i) => {
      this.input.keyboard!.on(`keydown-${k}`, () => {
        const btn = this.options[i];
        if (btn?.container.visible) this.answer(btn);
      });
    });

    // feedback
    this.feedback = this.add
      .text(GAME_WIDTH / 2, top + PH - 78, '', {
        fontFamily: FONTS.display, fontSize: uiPx(22), color: '#7a1f1f', align: 'center'
      })
      .setOrigin(0.5);

    // barra de habilidades
    this.buildAbilityBar(top + PH - 34);
    this.buffIcons = this.add
      .text(GAME_WIDTH / 2 + PW / 2 - 18, top + PH - 60, '', { fontFamily: FONTS.body, fontSize: uiPx(15), color: '#27408b' })
      .setOrigin(1, 0.5);

    // timer loop
    this.timerEvent = this.time.addEvent({ delay: 100, loop: true, callback: () => this.tickTimer() });

    this.newQuestion();
  }

  update() {
    // a Torre fica pausada enquanto o pergaminho está aberto, então o
    // cronômetro do desafio precisa continuar sendo alimentado aqui
    State.timerTick();
  }

  // ------------------------------------------------------------- habilidades
  private buildAbilityBar(y: number) {
    if (this.practice) {
      this.add
        .text(GAME_WIDTH / 2, y, 'Treino de Merlin — sem consequências', {
          fontFamily: FONTS.body, fontSize: uiPx(15), fontStyle: 'italic', color: '#5b3a1e'
        })
        .setOrigin(0.5);
      return;
    }
    for (let v = 1; v <= 7; v++) {
      const x = GAME_WIDTH / 2 - 7 * 46 / 2 + (v - 1) * 46 + 23;
      const icon = this.add.sprite(0, -4, 'candle-unlit').setScale(0.9);
      const num = this.add
        .text(0, 16, `${v}`, { fontFamily: FONTS.display, fontSize: uiPx(13), color: '#5b3a1e' })
        .setOrigin(0.5);
      const c = this.add.container(x, y, [icon, num]);
      c.setSize(40, 46).setInteractive({ useHandCursor: true });
      c.on('pointerdown', () => this.useAbility(v));
      this.abilityIcons.push(c);
      this.input.keyboard!.on(`keydown-${['ONE','TWO','THREE','FOUR','FIVE','SIX','SEVEN'][v-1]}`, () => this.useAbility(v));
      // tooltip simples no hover
      const ab = abilityByVela(v);
      c.on('pointerover', () => this.hintText.setText(`${ab.nome} — ${ab.descricao}`));
      c.on('pointerout', () => this.hintText.setText(this.currentHint));
    }
    this.refreshAbilityBar();
  }

  private refreshAbilityBar() {
    if (this.practice) return;
    for (let v = 1; v <= 7; v++) {
      const cont = this.abilityIcons[v - 1];
      if (!cont) continue;
      const icon = cont.getAt(0) as Phaser.GameObjects.Sprite;
      const lit = State.candle(v).lit;
      if (lit) {
        icon.play('candle-flame', true);
        cont.setAlpha(1);
      } else {
        icon.stop();
        icon.setTexture('candle-unlit');
        cont.setAlpha(0.35);
      }
    }
    const buffs: string[] = [];
    if (State.save?.protectionActive) buffs.push('🛡 fidelidade');
    if (this.noReset) buffs.push('⚭ elo');
    if (this.frozen) buffs.push('❄ tempo');
    this.buffIcons?.setText(buffs.join('  '));
  }

  private currentHint = '';

  /** alternativas falsas ainda em jogo (visíveis e não desabilitadas) */
  private visibleWrongOptions(): OptionButton[] {
    return this.options.filter(
      (o) => o.container.visible && !o.disabled && o.index !== this.question.indiceCorreta
    );
  }

  /**
   * Habilidade no modo ranqueado: quem aplica o efeito e paga o custo é o
   * servidor. O cliente só desenha o que voltou — se ficasse do lado de cá,
   * bastaria declarar "usei Luz Plena" para ganhar a questão sem gastar vela.
   */
  private async usarHabilidadeNoServidor(vela: number) {
    if (this.aguardando) return;
    this.aguardando = true;
    Audio.ability();
    try {
      const s = Ranqueado.exigir();
      const e = await Api.habilidade(s.runId, s.token, vela);
      if (!this.scene.isActive()) return;
      Ranqueado.espelhar(e);

      if (typeof e.eliminar === 'number' && this.options[e.eliminar]) {
        this.disableOption(this.options[e.eliminar]);
      }
      if (e.dica) {
        this.currentHint = e.dica;
        this.hintText.setText(e.dica);
      }
      if (typeof e.encurtar === 'number' && this.options[e.encurtar]) {
        const alvo = this.options[e.encurtar];
        const ws = alvo.text.text.split(' ');
        if (ws.length > 2) alvo.text.setText(ws.slice(0, -1).join(' ') + ' ✂');
      }
      if (e.congelada) {
        this.frozen = true;
        this.timerBar.setTint(0x27408b);
      }
      if (e.semReset) this.noReset = true;

      if (e.resolveuCerto) {
        if (typeof e.indiceCorreta === 'number') {
          this.question.indiceCorreta = e.indiceCorreta;
          this.options[e.indiceCorreta]?.bg.setTint(0xffc24d);
        }
        this.resolveCorrect(vela === 6);
      } else {
        this.refreshAbilityBar();
      }
    } catch (erro) {
      if (this.scene.isActive()) this.falharRede(erro);
    } finally {
      this.aguardando = false;
    }
  }

  private useAbility(vela: number) {
    if (this.practice || this.locked) return;
    const c = State.candle(vela);
    if (!c.lit) return;
    if (this.ranqueado) return void this.usarHabilidadeNoServidor(vela);
    const ab = abilityByVela(vela);
    Audio.ability();

    // custo: a vela se apaga e uma tranca retorna (salvo proteção ativa)
    const apply = () => State.extinguishForAbility(vela, LOCKS_RETURNED_ON_ABILITY);

    switch (ab.id) {
      case 'eliminarFalsa': {
        apply();
        const wrongs = this.visibleWrongOptions();
        if (wrongs.length) this.disableOption(wrongs[Math.floor(Math.random() * wrongs.length)]);
        break;
      }
      case 'preencherLacuna': {
        apply();
        const wsAll = this.question.correta.split(' ');
        const revealed = wsAll.length > 1 ? wsAll[0] + ' …' : this.question.correta.slice(0, Math.ceil(this.question.correta.length / 2)) + '…';
        this.currentHint = `A lacuna começa com: «${revealed}»`;
        this.hintText.setText(this.currentHint);
        // encurta uma alternativa falsa
        const wrongs = this.visibleWrongOptions();
        if (wrongs.length) {
          const t = wrongs[Math.floor(Math.random() * wrongs.length)];
          const ws = t.text.text.split(' ');
          if (ws.length > 2) t.text.setText(ws.slice(0, -1).join(' ') + ' ✂');
        }
        break;
      }
      case 'congelarTempo': {
        apply();
        this.frozen = true;
        this.timerBar.setTint(0x27408b);
        break;
      }
      case 'impedirReset': {
        apply();
        this.noReset = true;
        break;
      }
      case 'protegerVela': {
        // apaga a própria vela 5, então ativa a proteção para a PRÓXIMA habilidade
        apply();
        State.save!.protectionActive = true;
        State.persistSave();
        break;
      }
      case 'eliminarTranca': {
        apply();
        this.resolveCorrect(true);
        break;
      }
      case 'luzPlena': {
        apply();
        const correct = this.options[this.question.indiceCorreta];
        correct.bg.setTint(0xffc24d);
        this.time.delayedCall(600, () => this.resolveCorrect(false));
        this.locked = true;
        break;
      }
    }
    this.refreshAbilityBar();
    this.events.emit('state-changed');
  }

  private disableOption(o: OptionButton) {
    o.disabled = true;
    o.bg.setTint(0xb7a173);
    o.text.setAlpha(0.4);
    o.text.setText('✗ ' + o.text.text);
  }

  // ---------------------------------------------------------------- questões
  private async newQuestion() {
    this.locked = false;
    this.frozen = false;
    this.noReset = false;
    this.currentHint = '';
    this.hintText.setText('');
    this.feedback.setText('');
    const d = State.difficulty;

    if (this.ranqueado) {
      // no ranqueado a pergunta vem pronta do servidor, sem a resposta certa
      this.locked = true;
      this.feedback.setColor('#5b3a1e').setText('Consultando Merlin...');
      try {
        const s = Ranqueado.exigir();
        const p = await Api.pergunta(s.runId, s.token, this.vela);
        if (!this.scene.isActive()) return;
        Ranqueado.espelhar(p);
        this.questionId = p.questionId;
        this.question = {
          origem: p.origem, antes: p.antes, depois: p.depois,
          correta: '', opcoes: p.opcoes, indiceCorreta: -1
        };
        this.remaining = p.restanteMs / 1000;
        this.frozen = p.congelada;
        this.noReset = p.semReset;
        this.feedback.setText('');
        this.locked = false;
        this.pintarQuestao(p.eliminadas);
        return;
      } catch (erro) {
        if (this.scene.isActive()) this.falharRede(erro);
        return;
      }
    }

    this.question = generateQuestion(this.vela, d);
    this.remaining = d.tempo;
    this.lastTick = -1;
    this.timerBar.setTint(0xa53434);

    this.pintarQuestao([]);
  }

  /** desenha a questão atual; `eliminadas` já vêm marcadas ao retomar do servidor */
  private pintarQuestao(eliminadas: number[]) {
    this.lastTick = -1;
    this.timerBar.setTint(this.frozen ? 0x27408b : 0xa53434);
    this.origemText.setText(`— ${this.question.origem} —`);
    this.updateLocksText();

    const blank = ' ⟪ ______ ⟫ ';
    this.questionText.setText(
      `${this.question.antes}${this.question.antes ? ' ' : ''}${blank}${this.question.depois}`
    );

    this.options.forEach((o, i) => {
      const opt = this.question.opcoes[i];
      const visible = i < this.question.opcoes.length;
      o.container.setVisible(visible);
      o.disabled = false;
      o.bg.setTint(0xdcc494);
      o.text.setAlpha(1);
      // sem isto, a alternativa que ficou vermelha entrega o texto claro para
      // a pergunta seguinte e a opção nasce ilegível sobre o pergaminho
      o.text.setColor(OPT_INK);
      if (visible) o.text.setText(`${LETTERS[i]} · ${opt}`);
    });
    for (const i of eliminadas) if (this.options[i]) this.disableOption(this.options[i]);
    this.refreshAbilityBar();
  }

  /**
   * Corrida ranqueada exige servidor. Sem ele não dá para continuar sem
   * inventar estado — então explica e devolve o jogador à Torre.
   */
  private falharRede(erro: unknown) {
    const msg = erro instanceof ErroApi ? erro.message : 'falha de comunicação';
    this.locked = true;
    this.feedback.setColor('#7a1f1f').setText(`Corrida ranqueada interrompida:\n${msg}`);
    this.time.delayedCall(2600, () => this.close());
  }

  private updateLocksText() {
    if (this.practice) {
      this.locksText.setText('Treino');
      return;
    }
    this.locksText.setText(`Vela ${this.vela} · trancas: ${State.candle(this.vela).locks}`);
  }

  private tickTimer() {
    if (this.locked || this.frozen) return;
    this.remaining = Math.max(0, this.remaining - 0.1);
    const d = State.difficulty;
    const frac = this.remaining / d.tempo;
    this.timerBar.setDisplaySize(Math.max(1, (860 - 60) * frac), 10);
    const whole = Math.ceil(this.remaining);
    if (this.remaining <= 3 && whole !== this.lastTick && this.remaining > 0) {
      this.lastTick = whole;
      Audio.tick();
    }
    if (this.remaining <= 0) {
      if (this.ranqueado) this.responderNoServidor(-1);
      else this.resolveWrong('O tempo se esgotou!');
    }
  }

  private async answer(btn: OptionButton) {
    if (this.locked || btn.disabled || !btn.container.visible) return;

    if (this.ranqueado) return this.responderNoServidor(btn.index, btn);

    if (btn.index === this.question.indiceCorreta) {
      btn.bg.setTint(0x8fbf6f);
      this.resolveCorrect(false);
    } else {
      btn.bg.setTint(0xa53434);
      btn.text.setColor(OPT_INK_ERRADA);
      this.resolveWrong('Resposta incorreta!');
    }
  }

  /**
   * Envia a escolha e deixa o servidor julgar. `escolha = -1` é o cliente
   * avisando que o tempo acabou na tela dele — o servidor confere pelo prazo
   * que ele mesmo gravou, então adiantar ou atrasar esse aviso não ajuda.
   */
  private async responderNoServidor(escolha: number, btn?: OptionButton) {
    if (this.aguardando) return;
    this.aguardando = true;
    this.locked = true;
    try {
      const s = Ranqueado.exigir();
      const r = await Api.responder(s.runId, s.token, this.questionId, escolha);
      if (!this.scene.isActive()) return;
      Ranqueado.espelhar(r);
      this.question.indiceCorreta = r.indiceCorreta;
      if (r.acertou) {
        btn?.bg.setTint(0x8fbf6f);
        this.resolveCorrect(false);
      } else {
        if (btn) {
          btn.bg.setTint(0xa53434);
          btn.text.setColor(OPT_INK_ERRADA);
        }
        this.resolveWrong(r.expirou ? 'O tempo se esgotou!' : 'Resposta incorreta!');
      }
    } catch (erro) {
      if (this.scene.isActive()) this.falharRede(erro);
    } finally {
      this.aguardando = false;
    }
  }

  private resolveCorrect(byAbility: boolean) {
    this.locked = true;
    Audio.correct();
    // no ranqueado o servidor já debitou a tranca e o estado veio espelhado
    if (!this.practice && !this.ranqueado) {
      State.removeLock(this.vela);
    }
    this.updateLocksText();
    const locksLeft = this.practice ? 0 : State.candle(this.vela).locks;

    if (this.practice) {
      this.feedback.setColor('#2f5d2a').setText('Muito bem! Você está pronto. Suba a torre!');
      this.time.delayedCall(1800, () => this.close());
      return;
    }
    if (locksLeft <= 0) {
      Audio.unlockSfx();
      this.feedback.setColor('#2f5d2a').setText('A última tranca se partiu!\nA vela aguarda ser acesa.');
      this.time.delayedCall(1800, () => this.close());
    } else {
      this.feedback
        .setColor('#2f5d2a')
        .setText(byAbility ? 'Uma tranca foi destruída!' : `Correto! Restam ${locksLeft} tranca(s).`);
      this.time.delayedCall(1200, () => this.newQuestion());
    }
  }

  private resolveWrong(reason: string) {
    this.locked = true;
    Audio.wrong();
    this.cameras.main.shake(250, 0.008);
    // revela a correta
    const correct = this.options[this.question.indiceCorreta];
    correct?.bg.setTint(0x8fbf6f);

    if (this.practice) {
      this.feedback.setColor('#7a1f1f').setText(`${reason} A correta está marcada.\nNo desafio real, as trancas voltariam.`);
      this.time.delayedCall(2400, () => this.close());
      return;
    }
    if (this.noReset) {
      this.feedback.setColor('#27408b').setText(`${reason}\nO Elo dos Irmãos impediu o retorno das trancas.`);
    } else {
      if (!this.ranqueado) State.resetLocks(this.vela);
      this.updateLocksText();
      this.feedback.setColor('#7a1f1f').setText(`${reason}\nTodas as trancas desta vela retornaram...`);
    }
    this.time.delayedCall(2000, () => this.newQuestion());
  }

  private close() {
    this.timerEvent?.remove();
    this.input.keyboard?.removeAllListeners();
    this.scene.stop();
    this.scene.resume('Tower');
  }
}
