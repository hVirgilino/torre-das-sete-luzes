import Phaser from 'phaser';
import { FONTS, GAME_HEIGHT, GAME_WIDTH } from '../data/config';
import { State } from '../systems/state';
import { Audio } from '../systems/audio';
import { Dialog, fadeIn, fadeOut, wait } from '../systems/ui';

export class IntroScene extends Phaser.Scene {
  private dialog!: Dialog;

  constructor() {
    super('Intro');
  }

  create() {
    this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'bg-throne');
    this.dialog = new Dialog(this);
    fadeIn(this, 800);

    const skip = this.add
      .text(GAME_WIDTH - 16, 14, 'pular ›', { fontFamily: FONTS.body, fontSize: '15px', color: '#767ea8' })
      .setOrigin(1, 0)
      .setDepth(2000)
      .setInteractive({ useHandCursor: true })
      .once('pointerdown', () => {
        if (!State.save) State.newGame('');
        this.scene.start('Tutorial');
      });

    this.runCutscene().catch(() => {});
  }

  private askName(): Promise<string> {
    return new Promise((resolve) => {
      const overlay = document.getElementById('name-overlay')!;
      const input = document.getElementById('name-input') as HTMLInputElement;
      const btn = document.getElementById('name-confirm')!;
      overlay.classList.add('visible');
      input.value = '';
      setTimeout(() => input.focus(), 50);
      const done = () => {
        overlay.classList.remove('visible');
        btn.removeEventListener('click', done);
        input.removeEventListener('keydown', onKey);
        Audio.confirm();
        resolve(input.value.trim() || 'Galahad');
      };
      const onKey = (e: KeyboardEvent) => {
        if (e.key === 'Enter') done();
        e.stopPropagation();
      };
      btn.addEventListener('click', done);
      input.addEventListener('keydown', onKey);
    });
  }

  private async runCutscene() {
    const floorY = 430;
    // personagens
    const king = this.add.sprite(510, floorY - 34, 'king').setScale(2.4).setOrigin(0.5, 1);
    const knight = this.add.sprite(430, floorY, 'knight-sheet', 'kneel').setScale(2.4).setOrigin(0.5, 1);
    const sword = this.add.sprite(480, floorY - 90, 'sword').setScale(2).setOrigin(0.5, 1).setAngle(-40).setVisible(false);

    await wait(this, 900);

    // os três toques da espada
    sword.setVisible(true);
    for (let i = 0; i < 3; i++) {
      this.tweens.add({ targets: sword, angle: -70, duration: 260, ease: 'sine.out', yoyo: true });
      await wait(this, 280);
      Audio.sword();
      this.cameras.main.flash(120, 255, 240, 184);
      await wait(this, 520);
    }
    sword.setVisible(false);
    await wait(this, 400);

    // rei dá as costas e chama Merlin
    king.setFlipX(true);
    await this.dialog.play([{ speaker: 'Rei', text: 'Merlin...' }]);

    // Merlin entra na sala
    const merlin = this.add.sprite(-40, floorY, 'merlin').setScale(2.4).setOrigin(0.5, 1);
    this.tweens.add({ targets: merlin, x: 300, duration: 1600, ease: 'sine.inout' });
    await wait(this, 1700);
    king.setFlipX(false);

    await this.dialog.play([{ speaker: 'Merlin', text: 'Sim, majestade?' }]);

    // momento do nome
    const nome = await this.askName();
    State.newGame(nome);

    await this.dialog.play([
      {
        speaker: 'Rei',
        text: `Declaro Sir ${State.save!.playerName} Cavaleiro da Guarda Real do Rei. Dê a ele o último teste.`
      },
      { speaker: 'Merlin', text: 'Claro, majestade.' },
      {
        speaker: 'Merlin',
        text: `Você entrou como escudeiro, foi iniciado na Ordem e agora terá que provar os ensinamentos passados.`
      },
      {
        speaker: 'Merlin',
        text: 'Somente receberá o grau se cumprir com este desafio.'
      }
    ]);

    // explosão!
    Audio.explosion();
    this.cameras.main.flash(400, 255, 138, 60);
    this.cameras.main.shake(900, 0.02);
    const emitter = this.add.particles(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'spark', {
      speed: { min: 120, max: 420 },
      lifespan: 900,
      quantity: 60,
      scale: { start: 2, end: 0 },
      emitting: false
    });
    emitter.explode(80);
    await wait(this, 1100);
    await fadeOut(this, 500);

    // a queda da torre
    this.children.removeAll();
    this.cameras.main.setBackgroundColor(0x060a1c);
    const night = this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'bg-castle').setAlpha(0.35).setScale(1.4);
    const wall = this.add.tileSprite(GAME_WIDTH / 2, GAME_HEIGHT / 2, 300, GAME_HEIGHT, 'wall').setAlpha(0.8);
    const faller = this.add.sprite(GAME_WIDTH / 2, -60, 'knight-sheet', 'jump').setScale(2.4);
    fadeIn(this, 300);
    this.tweens.add({ targets: faller, y: GAME_HEIGHT + 80, angle: 360 * 3, duration: 2600, ease: 'quad.in' });
    this.tweens.add({ targets: wall, tilePositionY: -1600, duration: 2600, ease: 'quad.in' });
    Audio.wrong();
    await wait(this, 2400);
    await fadeOut(this, 600);
    this.scene.start('Tutorial');
  }
}
