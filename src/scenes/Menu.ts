import Phaser from 'phaser';
import { DIFFICULTIES, FONTS, GAME_HEIGHT, GAME_WIDTH } from '../data/config';
import { State } from '../systems/state';
import { Audio } from '../systems/audio';
import { makeButton, makeSlider, fadeOut } from '../systems/ui';

export class MenuScene extends Phaser.Scene {
  private optionsPanel?: Phaser.GameObjects.Container;
  private menuItems: Phaser.GameObjects.GameObject[] = [];
  private bg!: Phaser.GameObjects.Image;

  constructor() {
    super('Menu');
  }

  create() {
    this.cameras.main.setBackgroundColor(0x060a1c);
    this.bg = this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'bg-castle');
    this.cameras.main.fadeIn(500, 4, 6, 18);

    // velas flutuantes decorativas
    for (let i = 0; i < 3; i++) {
      const c = this.add.sprite(120 + i * 60, 480 - i * 12, 'candle-lit-0').setScale(1.4);
      c.play({ key: 'candle-flame', delay: i * 180 });
    }

    const title1 = this.add
      .text(GAME_WIDTH / 2, 92, 'A TORRE DAS', {
        fontFamily: FONTS.display,
        fontSize: '30px',
        color: '#aeb8e8',
        stroke: '#060a1c',
        strokeThickness: 6
      })
      .setOrigin(0.5);
    const title2 = this.add
      .text(GAME_WIDTH / 2, 138, 'SETE LUZES', {
        fontFamily: FONTS.display,
        fontSize: '58px',
        fontStyle: 'bold',
        color: '#ffc24d',
        stroke: '#2c1c08',
        strokeThickness: 10
      })
      .setOrigin(0.5);
    this.add
      .text(GAME_WIDTH / 2, 178, 'baseado na Cerimônia da Luz · Ordem DeMolay', {
        fontFamily: FONTS.body,
        fontSize: '16px',
        fontStyle: 'italic',
        color: '#dcc494'
      })
      .setOrigin(0.5);
    this.tweens.add({ targets: [title2], scale: { from: 1, to: 1.02 }, yoyo: true, repeat: -1, duration: 1600, ease: 'sine.inout' });
    this.menuItems.push(title1, title2);

    const novo = makeButton(this, GAME_WIDTH / 2, 280, 'Novo Jogo', () => this.startNewGame());
    const cont = makeButton(this, GAME_WIDTH / 2, 335, 'Continuar', () => this.continueGame());
    const opts = makeButton(this, GAME_WIDTH / 2, 390, 'Opções', () => this.toggleOptions());
    if (!State.hasSave) {
      cont.setAlpha(0.35).disableInteractive();
    }
    this.menuItems.push(novo, cont, opts);

    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT - 18, 'toque ou clique para liberar o som', {
        fontFamily: FONTS.body,
        fontSize: '13px',
        color: '#565e85'
      })
      .setOrigin(0.5);

    this.input.once('pointerdown', () => {
      Audio.unlock();
      Audio.startMusic();
    });
    this.input.keyboard?.once('keydown', () => {
      Audio.unlock();
      Audio.startMusic();
    });
  }

  private async startNewGame() {
    if (this.optionsPanel) this.toggleOptions();
    this.menuItems.forEach((m) => (m as any).setVisible?.(false));
    // câmera dá zoom no castelo com fade out
    this.cameras.main.zoomTo(3.2, 1600, 'Sine.easeIn');
    this.cameras.main.pan(GAME_WIDTH / 2 - 15, 260, 1600, 'Sine.easeIn');
    await new Promise((r) => this.time.delayedCall(1000, r));
    await fadeOut(this, 800);
    this.scene.start('Intro');
  }

  private continueGame() {
    State.loadSave();
    if (!State.hasSave) return;
    fadeOut(this, 500).then(() => this.scene.start('Tower'));
  }

  private toggleOptions() {
    if (this.optionsPanel) {
      this.optionsPanel.destroy();
      this.optionsPanel = undefined;
      return;
    }
    const W = 520;
    const H = 320;
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2 + 30;

    const border = this.add.image(0, 0, 'px').setDisplaySize(W + 6, H + 6).setTint(0xd9a441);
    const bg = this.add.image(0, 0, 'px').setDisplaySize(W, H).setTint(0x14182e).setAlpha(0.97);
    const title = this.add
      .text(0, -H / 2 + 28, 'OPÇÕES', { fontFamily: FONTS.display, fontSize: '24px', color: '#ffc24d' })
      .setOrigin(0.5);

    // dificuldade
    const diffLabel = this.add
      .text(-W / 2 + 30, -H / 2 + 66, 'Dificuldade', { fontFamily: FONTS.display, fontSize: '18px', color: '#f3e6c4' })
      .setOrigin(0, 0.5);
    const current = () => DIFFICULTIES.findIndex((d) => d.id === State.settings.difficulty);
    const diffName = this.add
      .text(60, -H / 2 + 66, '', { fontFamily: FONTS.body, fontSize: '20px', color: '#ffc24d' })
      .setOrigin(0.5);
    const diffDesc = this.add
      .text(0, -H / 2 + 96, '', { fontFamily: FONTS.body, fontSize: '15px', fontStyle: 'italic', color: '#aeb8e8' })
      .setOrigin(0.5);
    const refreshDiff = () => {
      const d = DIFFICULTIES[current()];
      diffName.setText(d.nome);
      diffDesc.setText(d.descricao);
    };
    refreshDiff();
    const arrow = (x: number, dir: -1 | 1, label: string) =>
      this.add
        .text(x, -H / 2 + 66, label, { fontFamily: FONTS.display, fontSize: '26px', color: '#f3e6c4' })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => {
          Audio.select();
          const i = (current() + dir + DIFFICULTIES.length) % DIFFICULTIES.length;
          State.settings.difficulty = DIFFICULTIES[i].id;
          State.persistSettings();
          refreshDiff();
        });
    const left = arrow(-60, -1, '‹');
    const right = arrow(180, 1, '›');

    // volumes
    const musLabel = this.add
      .text(-W / 2 + 30, 20, 'Música', { fontFamily: FONTS.display, fontSize: '18px', color: '#f3e6c4' })
      .setOrigin(0, 0.5);
    const sfxLabel = this.add
      .text(-W / 2 + 30, 80, 'Efeitos', { fontFamily: FONTS.display, fontSize: '18px', color: '#f3e6c4' })
      .setOrigin(0, 0.5);

    const note = this.add
      .text(0, H / 2 - 50, 'A dificuldade escolhida vale para o próximo Novo Jogo.', {
        fontFamily: FONTS.body,
        fontSize: '14px',
        fontStyle: 'italic',
        color: '#767ea8'
      })
      .setOrigin(0.5);
    const close = makeButton(this, 0, H / 2 - 22, 'Fechar', () => this.toggleOptions(), 18);

    this.optionsPanel = this.add.container(cx, cy, [
      border, bg, title, diffLabel, diffName, diffDesc, left, right, musLabel, sfxLabel, note, close
    ]);
    this.optionsPanel.setDepth(500);

    // sliders precisam de coordenadas absolutas (usam pointer.x)
    const musSlider = makeSlider(this, cx + 90, cy + 20, 240, State.settings.musicVolume, (v) => {
      State.settings.musicVolume = v;
      State.persistSettings();
      Audio.applyVolumes();
    });
    const sfxSlider = makeSlider(this, cx + 90, cy + 80, 240, State.settings.sfxVolume, (v) => {
      State.settings.sfxVolume = v;
      State.persistSettings();
      Audio.applyVolumes();
    });
    musSlider.setDepth(501);
    sfxSlider.setDepth(501);
    this.optionsPanel.once(Phaser.GameObjects.Events.DESTROY, () => {
      musSlider.destroy();
      sfxSlider.destroy();
    });
  }
}
