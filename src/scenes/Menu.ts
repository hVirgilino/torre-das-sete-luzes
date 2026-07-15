import Phaser from 'phaser';
import { DIFFICULTIES, FONTS, GAME_HEIGHT, GAME_WIDTH } from '../data/config';
import { nextTrack, trackById, TRACKS } from '../data/tracks';
import { State } from '../systems/state';
import { Audio } from '../systems/audio';
import { makeButton, makeSlider, fadeOut } from '../systems/ui';
import { RESOLUTIONS, initSceneView, renderScale, resolutionOf, uiScale } from '../systems/display';
import { UI_SCALES } from '../data/config';

export class MenuScene extends Phaser.Scene {
  private optionsPanel?: Phaser.GameObjects.Container;
  private menuItems: Phaser.GameObjects.GameObject[] = [];
  private bg!: Phaser.GameObjects.Image;
  private discSpin?: Phaser.Tweens.Tween;
  private trackLabel?: Phaser.GameObjects.Text;
  private trackToast?: Phaser.GameObjects.Text;

  constructor() {
    super('Menu');
  }

  create() {
    initSceneView(this);
    this.cameras.main.setBackgroundColor(0x060a1c);
    this.bg = this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'bg-castle');
    this.cameras.main.fadeIn(500, 4, 6, 18);

    // velas flutuantes decorativas
    for (let i = 0; i < 3; i++) {
      const c = this.add.sprite(120 + i * 60, 480 - i * 12, 'candle-lit-0').setScale(1.4);
      c.play({ key: 'candle-flame', delay: i * 180 });
    }

    this.buildAtmosphere();

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

    this.buildVitrola();

    this.input.once('pointerdown', () => {
      Audio.unlock();
      Audio.startMusic();
      this.startDiscSpin();
    });
    this.input.keyboard?.once('keydown', () => {
      Audio.unlock();
      Audio.startMusic();
      this.startDiscSpin();
    });
  }

  // ---------------------------------------------------------- atmosfera
  private buildAtmosphere() {
    // tochas tremulando sobre janelas/ameias do castelo
    const torchSpots: Array<[number, number, number]> = [
      [188, 322, 0xffc24d],
      [655, 300, 0xff8a3c],
      [430, 200, 0xffc24d],
      [465, 175, 0xfff0b8]
    ];
    for (const [gx, gy, tint] of torchSpots) {
      const g = this.add.image(gx, gy, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(tint).setScale(0.5);
      this.tweens.add({
        targets: g,
        alpha: { from: 0.5, to: 0.95 },
        scale: { from: 0.42, to: 0.58 },
        duration: 700 + Math.random() * 500,
        yoyo: true,
        repeat: -1,
        ease: 'sine.inout',
        delay: Math.random() * 400
      });
    }

    // respiração lenta do luar
    const moonGlow = this.add
      .image(780, 90, 'glow')
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(0xc9d2f5)
      .setScale(1.6)
      .setAlpha(0.25);
    this.tweens.add({ targets: moonGlow, alpha: 0.4, duration: 3400, yoyo: true, repeat: -1, ease: 'sine.inout' });

    // fumaça discreta subindo do portão
    this.add.particles(465, 456, 'spark', {
      speed: { min: 6, max: 16 },
      angle: { min: 260, max: 280 },
      lifespan: 2200,
      frequency: 700,
      alpha: { start: 0.18, end: 0 },
      scale: { start: 1, end: 2.2 },
      tint: 0x8890b8
    });
  }

  // ------------------------------------------------------------- vitrola
  private buildVitrola() {
    const x = GAME_WIDTH - 70;
    const y = GAME_HEIGHT - 64;

    const box = this.add.image(0, 0, 'vitrola').setOrigin(0.5, 1);
    const disc = this.add.image(-12, -12, 'vitrola-disc').setScale(1.3);
    this.trackLabel = this.add
      .text(0, -46, trackById(State.settings.track).nome, {
        fontFamily: FONTS.body,
        fontSize: '12px',
        fontStyle: 'italic',
        color: '#dcc494',
        align: 'center',
        wordWrap: { width: 100 }
      })
      .setOrigin(0.5, 1);

    const c = this.add.container(x, y, [box, disc, this.trackLabel]);
    c.setSize(70, 60).setInteractive({ useHandCursor: true });

    this.trackToast = this.add
      .text(x, y - 70, '', { fontFamily: FONTS.display, fontSize: '15px', color: '#ffc24d' })
      .setOrigin(0.5)
      .setAlpha(0);

    this.discSpin = this.tweens.add({
      targets: disc,
      angle: 360,
      duration: 4000,
      repeat: -1,
      paused: true
    });

    c.on('pointerdown', () => {
      Audio.unlock();
      const track = nextTrack(State.settings.track);
      State.settings.track = track.id;
      State.persistSettings();
      Audio.setTrack(track.id);
      this.startDiscSpin();
      this.trackLabel?.setText(track.nome);
      this.showTrackToast(track.nome);
      Audio.select();
    });
  }

  private startDiscSpin() {
    if (this.discSpin?.isPlaying()) return;
    this.discSpin?.play();
  }

  private showTrackToast(nome: string) {
    if (!this.trackToast) return;
    this.trackToast.setText(nome).setAlpha(1);
    this.tweens.add({ targets: this.trackToast, alpha: 0, duration: 1200, delay: 400 });
  }

  private async startNewGame() {
    if (this.optionsPanel) this.toggleOptions();
    this.menuItems.forEach((m) => (m as any).setVisible?.(false));
    // câmera dá zoom no castelo com fade out
    this.cameras.main.zoomTo(3.2 * renderScale(), 1600, 'Sine.easeIn');
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
    const W = 760;
    const H = 470;
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2 + 10;
    const colL = -W / 2 + 190; // centro da coluna esquerda (Jogo + Áudio)
    const colR = W / 2 - 190; // centro da coluna direita (Vídeo)

    const kids: Phaser.GameObjects.GameObject[] = [];

    const border = this.add.image(0, 0, 'px').setDisplaySize(W + 6, H + 6).setTint(0xd9a441);
    const bg = this.add.image(0, 0, 'px').setDisplaySize(W, H).setTint(0x14182e).setAlpha(0.97);
    const title = this.add
      .text(0, -H / 2 + 30, 'OPÇÕES', { fontFamily: FONTS.display, fontSize: '26px', color: '#ffc24d' })
      .setOrigin(0.5);
    kids.push(border, bg, title);

    const sectionTitle = (x: number, y: number, label: string) =>
      this.add
        .text(x, y, label, { fontFamily: FONTS.display, fontSize: '19px', color: '#d9a441' })
        .setOrigin(0.5);
    const rowLabel = (x: number, y: number, label: string) =>
      this.add
        .text(x - 150, y, label, { fontFamily: FONTS.display, fontSize: '16px', color: '#f3e6c4' })
        .setOrigin(0, 0.5);
    const arrowBtn = (x: number, y: number, dir: -1 | 1, onClick: () => void) =>
      this.add
        .text(x, y, dir === -1 ? '‹' : '›', { fontFamily: FONTS.display, fontSize: '24px', color: '#f3e6c4' })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => {
          Audio.select();
          onClick();
        });

    // ------------------------------------------------------- Jogo
    let y = -H / 2 + 76;
    kids.push(sectionTitle(colL, y, 'JOGO'));
    y += 34;
    kids.push(rowLabel(colL, y, 'Dificuldade'));
    const diffIdx = () => DIFFICULTIES.findIndex((d) => d.id === State.settings.difficulty);
    const diffName = this.add
      .text(colL + 60, y, '', { fontFamily: FONTS.body, fontSize: '18px', color: '#ffc24d' })
      .setOrigin(0.5);
    kids.push(diffName);
    y += 30;
    const diffDesc = this.add
      .text(colL, y, '', {
        fontFamily: FONTS.body, fontSize: '13px', fontStyle: 'italic', color: '#aeb8e8'
      })
      .setOrigin(0.5);
    kids.push(diffDesc);
    const refreshDiff = () => {
      const d = DIFFICULTIES[diffIdx()];
      diffName.setText(d.nome);
      diffDesc.setText(d.descricao);
    };
    refreshDiff();
    kids.push(
      arrowBtn(colL - 20, y - 30, -1, () => {
        const i = (diffIdx() - 1 + DIFFICULTIES.length) % DIFFICULTIES.length;
        State.settings.difficulty = DIFFICULTIES[i].id;
        State.persistSettings();
        refreshDiff();
      }),
      arrowBtn(colL + 140, y - 30, 1, () => {
        const i = (diffIdx() + 1) % DIFFICULTIES.length;
        State.settings.difficulty = DIFFICULTIES[i].id;
        State.persistSettings();
        refreshDiff();
      })
    );

    // ------------------------------------------------------- Áudio
    y += 50;
    kids.push(sectionTitle(colL, y, 'ÁUDIO'));
    y += 40;
    kids.push(rowLabel(colL, y, 'Música'));
    const musY = y;
    y += 46;
    kids.push(rowLabel(colL, y, 'Efeitos'));
    const sfxY = y;
    y += 46;
    kids.push(rowLabel(colL, y, 'Faixa'));
    const trackName = this.add
      .text(colL + 60, y, trackById(State.settings.track).nome, {
        fontFamily: FONTS.body, fontSize: '15px', color: '#ffc24d'
      })
      .setOrigin(0.5);
    kids.push(trackName);
    const changeTrack = (dir: -1 | 1) => {
      const i = (TRACKS.findIndex((t) => t.id === State.settings.track) + dir + TRACKS.length) % TRACKS.length;
      const t = TRACKS[i];
      State.settings.track = t.id;
      State.persistSettings();
      Audio.setTrack(t.id);
      trackName.setText(t.nome);
      this.trackLabel?.setText(t.nome);
    };
    kids.push(arrowBtn(colL - 20, y, -1, () => changeTrack(-1)), arrowBtn(colL + 140, y, 1, () => changeTrack(1)));

    // ------------------------------------------------------- Vídeo
    let yr = -H / 2 + 76;
    kids.push(sectionTitle(colR, yr, 'VÍDEO'));
    yr += 34;
    kids.push(rowLabel(colR, yr, 'Resolução'));
    const resIdx = () => RESOLUTIONS.findIndex((r) => r.id === State.settings.resolutionId);
    const resName = this.add
      .text(colR + 60, yr, resolutionOf(State.settings.resolutionId).label, {
        fontFamily: FONTS.body, fontSize: '16px', color: '#ffc24d'
      })
      .setOrigin(0.5);
    kids.push(resName);
    const applyBtn = makeButton(
      this,
      colR,
      yr + 40,
      'Aplicar (recarrega)',
      () => window.location.reload(),
      14
    ).setVisible(false);
    kids.push(applyBtn);
    const cycleRes = (dir: -1 | 1) => {
      const i = (resIdx() + dir + RESOLUTIONS.length) % RESOLUTIONS.length;
      State.settings.resolutionId = RESOLUTIONS[i].id;
      State.persistSettings();
      resName.setText(RESOLUTIONS[i].label);
      applyBtn.setVisible(true);
    };
    kids.push(
      arrowBtn(colR - 20, yr, -1, () => cycleRes(-1)),
      arrowBtn(colR + 140, yr, 1, () => cycleRes(1))
    );

    yr += 74;
    kids.push(rowLabel(colR, yr, 'Tam. interface'));
    const scaleIdx = () => UI_SCALES.indexOf(State.settings.uiScale as (typeof UI_SCALES)[number]);
    const scaleName = this.add
      .text(colR + 60, yr, `${Math.round(uiScale() * 100)}%`, {
        fontFamily: FONTS.body, fontSize: '16px', color: '#ffc24d'
      })
      .setOrigin(0.5);
    kids.push(scaleName);
    const changeScale = (dir: -1 | 1) => {
      const i = (scaleIdx() + dir + UI_SCALES.length) % UI_SCALES.length;
      State.settings.uiScale = UI_SCALES[i];
      State.persistSettings();
      scaleName.setText(`${Math.round(UI_SCALES[i] * 100)}%`);
    };
    kids.push(arrowBtn(colR - 20, yr, -1, () => changeScale(-1)), arrowBtn(colR + 140, yr, 1, () => changeScale(1)));

    yr += 60;
    kids.push(
      this.add
        .text(colR, yr, 'A resolução exige recarregar a página.\nO tamanho da interface se aplica na próxima tela.', {
          fontFamily: FONTS.body, fontSize: '12px', fontStyle: 'italic', color: '#767ea8', align: 'center'
        })
        .setOrigin(0.5)
    );

    const note = this.add
      .text(0, H / 2 - 56, 'A dificuldade escolhida vale para o próximo Novo Jogo.', {
        fontFamily: FONTS.body,
        fontSize: '13px',
        fontStyle: 'italic',
        color: '#767ea8'
      })
      .setOrigin(0.5);
    kids.push(note);
    const close = makeButton(this, 0, H / 2 - 22, 'Fechar', () => this.toggleOptions(), 18);
    kids.push(close);

    this.optionsPanel = this.add.container(cx, cy, kids);
    this.optionsPanel.setDepth(500);

    // sliders precisam de coordenadas absolutas de mundo (worldX)
    const musSlider = makeSlider(this, cx + colL + 60, cy + musY, 190, State.settings.musicVolume, (v) => {
      State.settings.musicVolume = v;
      State.persistSettings();
      Audio.applyVolumes();
    });
    const sfxSlider = makeSlider(this, cx + colL + 60, cy + sfxY, 190, State.settings.sfxVolume, (v) => {
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
