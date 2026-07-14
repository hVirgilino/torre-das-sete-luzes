import Phaser from 'phaser';
import { FONTS, GAME_HEIGHT, GAME_WIDTH } from '../data/config';
import { State } from '../systems/state';
import { Audio } from '../systems/audio';
import { Dialog, fadeIn, fadeOut, wait } from '../systems/ui';
import { makeButton } from '../systems/ui';

export class FinalScene extends Phaser.Scene {
  constructor() {
    super('Final');
  }

  create() {
    this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'bg-throne');
    fadeIn(this, 800);

    // as sete velas acesas atrás do trono
    for (let i = 0; i < 7; i++) {
      const c = this.add.sprite(330 + i * 50, 300, 'candle-lit-0').setScale(1.6);
      c.play({ key: 'candle-flame', delay: i * 120 });
    }

    this.runCutscene().catch(() => {});
  }

  private async runCutscene() {
    const dialog = new Dialog(this);
    const floorY = 430;
    const king = this.add.sprite(510, floorY - 34, 'king').setScale(2.4).setOrigin(0.5, 1);
    const merlin = this.add.sprite(320, floorY, 'merlin').setScale(2.4).setOrigin(0.5, 1);
    const knight = this.add.sprite(430, floorY, 'knight-sheet', 'kneel').setScale(2.4).setOrigin(0.5, 1);
    const sword = this.add.sprite(480, floorY - 90, 'sword').setScale(2).setOrigin(0.5, 1).setAngle(-40).setVisible(false);

    const nome = State.save?.playerName ?? 'Cavaleiro';

    await wait(this, 900);
    await dialog.play([
      { speaker: 'Merlin', text: 'Majestade, ele acendeu as sete luzes. Os ensinamentos vivem nele.' },
      { speaker: 'Rei', text: 'Que se ajoelhe diante da corte.' }
    ]);

    // os três toques
    sword.setVisible(true);
    for (let i = 0; i < 3; i++) {
      this.tweens.add({ targets: sword, angle: -70, duration: 260, ease: 'sine.out', yoyo: true });
      await wait(this, 280);
      Audio.sword();
      this.cameras.main.flash(120, 255, 240, 184);
      await wait(this, 520);
    }
    sword.setVisible(false);

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

    this.add
      .text(GAME_WIDTH / 2, 150, 'FIM', {
        fontFamily: FONTS.display, fontSize: '64px', fontStyle: 'bold',
        color: '#ffc24d', stroke: '#2c1c08', strokeThickness: 10
      })
      .setOrigin(0.5)
      .setDepth(1200);
    this.add
      .text(GAME_WIDTH / 2, 205, `Sir ${nome} · Cavaleiro da Guarda Real`, {
        fontFamily: FONTS.body, fontSize: '20px', fontStyle: 'italic', color: '#f3e6c4'
      })
      .setOrigin(0.5)
      .setDepth(1200);

    makeButton(this, GAME_WIDTH / 2, GAME_HEIGHT - 60, 'Voltar ao Menu', async () => {
      await fadeOut(this, 500);
      this.scene.start('Menu');
    }).setDepth(1200);
  }
}
