import Phaser from 'phaser';
import { DESIGN_DX, Difficulty, FONTS, GAME_HEIGHT, GAME_WIDTH } from '../data/config';
import { State, formatDuration } from '../systems/state';
import { Audio } from '../systems/audio';
import { Dialog, fadeIn, fadeOut, wait, makeStarRow } from '../systems/ui';
import { makeButton } from '../systems/ui';
import { placeCourt, swordSwings } from './cutscene';
import { initSceneView } from '../systems/display';

export class FinalScene extends Phaser.Scene {
  constructor() {
    super('Final');
  }

  create() {
    initSceneView(this);
    this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'bg-throne');
    fadeIn(this, 800);

    // as sete velas acesas atrás do trono
    for (let i = 0; i < 7; i++) {
      const c = this.add.sprite(330 + i * 50 + DESIGN_DX, 300, 'candle-lit-0').setScale(1.6);
      c.play({ key: 'candle-flame', delay: i * 120 });
    }

    this.runCutscene().catch(() => {});
  }

  private async runCutscene() {
    const dialog = new Dialog(this);
    const floorY = 430;
    const { knight, sword } = placeCourt(this, { withMerlin: true, floorY });

    const nome = State.save?.playerName ?? 'Cavaleiro';
    // o cronômetro já parou na Torre; aqui só se lê o total e se registra
    const dificuldade = State.difficulty;
    const tempoMs = State.save?.elapsedMs ?? 0;
    const conquista = State.recordClear(dificuldade.id, tempoMs);

    await wait(this, 900);
    await dialog.play([
      { speaker: 'Merlin', text: 'Majestade, ele acendeu as sete luzes. Os ensinamentos vivem nele.' },
      { speaker: 'Rei', text: 'Que se ajoelhe diante da corte.' }
    ]);

    // os três toques da espada — a condecoração de verdade
    await swordSwings(this, sword, 3, { flash: true, sfx: true });

    await dialog.play([
      {
        speaker: 'Rei',
        text: `Pelo Amor Filial, pela Reverência, pela Cortesia, pelo Companheirismo, pela Fidelidade, pela Pureza e pelo Patriotismo...`
      },
      {
        speaker: 'Rei',
        text: `Eu vos declaro, Sir ${nome}, Cavaleiro da Guarda Real do Rei!`
      }
    ]);

    // levantar + fanfarra + partículas douradas
    knight.setFrame('idle');
    Audio.fanfare();
    const emitter = this.add.particles(430, floorY - 60, 'spark', {
      speed: { min: 40, max: 160 },
      lifespan: 1400,
      quantity: 4,
      frequency: 60,
      scale: { start: 1.6, end: 0 },
      gravityY: -60
    });
    await wait(this, 2600);
    emitter.stop();

    await dialog.play([
      { speaker: 'Merlin', text: 'Leve estas sete luzes consigo, e faça-as brilhar sobre os outros. Aí reside a finalidade de viver.' }
    ]);

    if (State.save) {
      State.save.finished = true;
      State.persistSave();
    }

    await this.showEndPanel(nome, dificuldade, tempoMs, conquista);
  }

  /** Cartela de fim de jogo: grau, estrelas, palavra do Rei e tempo do desafio. */
  private async showEndPanel(
    nome: string,
    dificuldade: Difficulty,
    tempoMs: number,
    conquista: { before: number; after: number; previousBest?: number; isRecord: boolean }
  ) {
    const D = 1200;
    const cx = GAME_WIDTH / 2;
    this.add
      .image(cx, GAME_HEIGHT / 2, 'px')
      .setDisplaySize(GAME_WIDTH, GAME_HEIGHT)
      .setTint(0x04060f)
      .setAlpha(0.82)
      .setDepth(D - 1);

    this.add
      .text(cx, 62, 'FIM', {
        fontFamily: FONTS.display, fontSize: '58px', fontStyle: 'bold',
        color: '#ffc24d', stroke: '#2c1c08', strokeThickness: 10
      })
      .setOrigin(0.5)
      .setDepth(D);
    this.add
      .text(cx, 110, `Sir ${nome} · Cavaleiro da Guarda Real`, {
        fontFamily: FONTS.body, fontSize: '19px', fontStyle: 'italic', color: '#f3e6c4'
      })
      .setOrigin(0.5)
      .setDepth(D);
    this.add
      .text(cx, 136, `Modo ${dificuldade.nome}`, {
        fontFamily: FONTS.display, fontSize: '15px', color: '#aeb8e8'
      })
      .setOrigin(0.5)
      .setDepth(D);

    // estrelas: as antigas já entram acesas, as novas nascem apagadas e
    // acendem uma a uma logo abaixo
    const { container, stars } = makeStarRow(this, cx, 196, conquista.before, 1.1);
    container.setDepth(D);

    this.add
      .text(cx, 268, dificuldade.mensagemFinal, {
        fontFamily: FONTS.body, fontSize: '18px', color: '#f3e6c4',
        align: 'center', wordWrap: { width: 620 }, lineSpacing: 5
      })
      .setOrigin(0.5)
      .setDepth(D);

    // partida iniciada antes do cronômetro existir não tem tempo para mostrar
    if (tempoMs > 0) {
      const tempoText = this.add
        .text(cx, 366, `Você concluiu o desafio de Merlin em ${formatDuration(tempoMs)}.`, {
          fontFamily: FONTS.body, fontSize: '19px', color: '#ffc24d'
        })
        .setOrigin(0.5)
        .setDepth(D);

      const recorde = conquista.isRecord
        ? conquista.previousBest === undefined
          ? `Primeiro tempo registrado no modo ${dificuldade.nome}.`
          : `Novo recorde no modo ${dificuldade.nome}! (antes: ${formatDuration(conquista.previousBest)})`
        : `Vosso recorde no modo ${dificuldade.nome} segue em ${formatDuration(
            conquista.previousBest ?? tempoMs
          )}.`;
      this.add
        .text(cx, 396, recorde, {
          fontFamily: FONTS.body, fontSize: '15px', fontStyle: 'italic',
          color: conquista.isRecord ? '#ffc24d' : '#aeb8e8'
        })
        .setOrigin(0.5)
        .setDepth(D);

      if (conquista.isRecord) {
        this.tweens.add({
          targets: tempoText, scale: { from: 1, to: 1.06 },
          duration: 700, yoyo: true, repeat: -1, ease: 'sine.inout'
        });
      }
    }

    // acende as estrelas conquistadas nesta partida, uma de cada vez
    for (let i = conquista.before; i < conquista.after; i++) {
      await wait(this, 550);
      const star = stars[i];
      star.setTexture('star-on').setScale(0);
      Audio.candleLight();
      this.cameras.main.flash(180, 255, 194, 77);
      const burst = this.add
        .particles(container.x + star.x, container.y, 'spark', {
          speed: { min: 50, max: 150 }, lifespan: 800, quantity: 20,
          scale: { start: 1.4, end: 0 }, tint: 0xffc24d, emitting: false
        })
        .setDepth(D);
      burst.explode(20);
      this.tweens.add({ targets: star, scale: { from: 0, to: 1.1 }, duration: 420, ease: 'back.out' });
    }

    makeButton(this, cx, GAME_HEIGHT - 48, 'Voltar ao Menu', async () => {
      await fadeOut(this, 500);
      this.scene.start('Menu');
    }).setDepth(D);
  }
}
