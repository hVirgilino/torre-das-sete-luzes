import Phaser from 'phaser';
import {
  DESIGN_DX, DIFFICULTIES, FONTS, GAME_HEIGHT, GAME_WIDTH, MAX_ESTRELAS, dificuldadePorId
} from '../data/config';
import { MOON_X } from './Boot';
import { nextTrack, trackById, TRACKS } from '../data/tracks';
import { State, formatClock } from '../systems/state';
import { Audio } from '../systems/audio';
import {
  makeButton, makeSlider, makeStarRow, aplicarEstiloEstrela, estiloPorPosicao,
  dificuldadeDaEstrela, fadeOut, type EstiloEstrela
} from '../systems/ui';
import { Api, ErroApi, entradasPublicadas, ehRanqueavel } from '../systems/api';
import { Ranqueado } from '../systems/ranqueado';
import { pedirTexto } from '../systems/modal';
import {
  RESOLUTIONS, initSceneView, isAutoResolution, renderScale, resolutionOf, uiScale
} from '../systems/display';
import { UI_SCALES } from '../data/config';

export class MenuScene extends Phaser.Scene {
  private optionsPanel?: Phaser.GameObjects.Container;
  private menuItems: Phaser.GameObjects.GameObject[] = [];
  private bg!: Phaser.GameObjects.Image;
  private discSpin?: Phaser.Tweens.Tween;
  private trackLabel?: Phaser.GameObjects.Text;
  private trackToast?: Phaser.GameObjects.Text;
  private botoes: Phaser.GameObjects.Text[] = [];
  /** true enquanto uma ação assíncrona do menu está no ar */
  private ocupado = false;

  constructor() {
    super('Menu');
  }

  create() {
    initSceneView(this);
    // a cena é reaproveitada a cada volta ao menu: sem isto a lista acumula
    // referências aos objetos já destruídos das visitas anteriores
    this.menuItems = [];
    this.botoes = [];
    this.ocupado = false;
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

    this.buildTrophies();

    // a mancha vem antes dos botões para ficar por baixo deles
    const sombra = this.add
      .image(GAME_WIDTH / 2, 364, 'sombra-menu')
      .setDisplaySize(430, 260);
    this.menuItems.push(sombra);

    const novo = makeButton(this, GAME_WIDTH / 2, 276, 'Novo Jogo', () => this.startNewGame(), 24);
    const cont = makeButton(this, GAME_WIDTH / 2, 320, 'Continuar', () => this.continueGame(), 24);
    const rank = makeButton(this, GAME_WIDTH / 2, 364, 'Partida Ranqueada', () => this.iniciarRanqueada(), 24);
    const tab = makeButton(this, GAME_WIDTH / 2, 408, 'Ranking', () => this.abrirRanking(), 24);
    const opts = makeButton(this, GAME_WIDTH / 2, 452, 'Opções', () => this.toggleOptions(), 24);
    if (!State.hasSave) {
      cont.setAlpha(0.35).disableInteractive();
    }
    this.botoes = [novo, cont, rank, tab, opts];
    this.menuItems.push(novo, cont, rank, tab, opts);

    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT - 36, `v${__VERSAO__}`, {
        fontFamily: FONTS.body,
        fontSize: '12px',
        color: '#3a4472'
      })
      .setOrigin(0.5);
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

  // ------------------------------------------------------------- troféus
  /**
   * Estrelas conquistadas sob o título e, no canto, o melhor tempo de cada
   * dificuldade já vencida — a vitrine de quem faz speedrun.
   */
  private buildTrophies() {
    // ?podio=lenda|platina|bronze força o brilho sem precisar de ranking — é o
    // único jeito de conferir a arte antes de existir um top 3 de verdade
    const forcado = new URLSearchParams(location.search).get('podio') as EstiloEstrela | null;

    const { container, stars } = makeStarRow(
      this, 36, GAME_HEIGHT - 60, forcado ? MAX_ESTRELAS : State.stars, 0.62,
      forcado ? Array(MAX_ESTRELAS).fill(forcado) : [],
      'vertical'
    );
    container.setDepth(20);
    this.menuItems.push(container);
    stars.forEach((s, i) => {
      if (i >= State.stars && !forcado) s.setAlpha(0.45);
    });
    if (!forcado) this.aplicarBrilhoDePodio(stars);

    this.buildRecordes();
  }

  /** Melhores tempos locais, no canto oposto às estrelas. */
  private buildRecordes() {
    const vencidas = DIFFICULTIES.filter((d) => State.trophies.records[d.id] !== undefined);
    if (!vencidas.length) return;

    const kids: Phaser.GameObjects.GameObject[] = [
      this.add
        .text(0, 0, 'RECORDES', {
          fontFamily: FONTS.display, fontSize: '13px', color: '#d9a441'
        })
        .setOrigin(0, 0)
    ];
    vencidas.forEach((d, i) => {
      kids.push(
        this.add
          .text(0, 22 + i * 19, `${d.nome}`, {
            fontFamily: FONTS.body, fontSize: '14px', color: '#aeb8e8'
          })
          .setOrigin(0, 0),
        this.add
          .text(132, 22 + i * 19, formatClock(State.trophies.records[d.id]!), {
            fontFamily: FONTS.body, fontSize: '14px', color: '#f3e6c4'
          })
          .setOrigin(1, 0)
      );
    });
    this.menuItems.push(this.add.container(24, 26, kids));
  }

  /**
   * Pinta cada estrela com a colocação do jogador **na dificuldade dela**.
   *
   * A estrela 1 é do Iniciático, a 2 do DeMolay, a 3 do Cavaleiro. Três
   * lendárias significam três primeiros lugares distintos, não um só repetido.
   *
   * Assíncrono e tolerante a falha: sem rede, ou rodando fora da Vercel, as
   * estrelas ficam douradas e o menu não pisca.
   */
  private async aplicarBrilhoDePodio(stars: Phaser.GameObjects.Sprite[]) {
    const entradas = entradasPublicadas();
    if (!entradas.length || !State.stars) return;
    try {
      const { posicoes } = await Api.minhasColocacoes(entradas);
      if (!this.scene.isActive()) return;

      // várias publicações na mesma dificuldade: vale a melhor colocação
      const melhorPorDificuldade = new Map<string, number>();
      for (const p of posicoes) {
        const atual = melhorPorDificuldade.get(p.dificuldade);
        if (atual === undefined || p.posicao < atual) {
          melhorPorDificuldade.set(p.dificuldade, p.posicao);
        }
      }

      stars.forEach((sp, i) => {
        if (i >= State.stars || !sp.active) return;
        const dif = dificuldadeDaEstrela(i);
        const estilo = estiloPorPosicao(dif ? melhorPorDificuldade.get(dif) : undefined);
        if (estilo !== 'padrao') aplicarEstiloEstrela(sp, estilo, i);
      });
    } catch {
      /* ranking indisponível — o menu não deve nem piscar por causa disso */
    }
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
      .image(MOON_X, 90, 'glow')
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(0xc9d2f5)
      .setScale(1.6)
      .setAlpha(0.25);
    this.tweens.add({ targets: moonGlow, alpha: 0.4, duration: 3400, yoyo: true, repeat: -1, ease: 'sine.inout' });

    // fumaça discreta subindo do portão
    this.add.particles(465 + DESIGN_DX, 456, 'spark', {
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
    if (this.ocupado) return;
    if (this.optionsPanel) this.toggleOptions();
    // partida casual nunca herda uma corrida ranqueada pendente
    Ranqueado.encerrar();
    this.menuItems.forEach((m) => (m as any).setVisible?.(false));
    // câmera dá zoom no castelo com fade out
    this.cameras.main.zoomTo(3.2 * renderScale(), 1600, 'Sine.easeIn');
    this.cameras.main.pan(GAME_WIDTH / 2 - 15, 260, 1600, 'Sine.easeIn');
    await new Promise((r) => this.time.delayedCall(1000, r));
    await fadeOut(this, 800);
    this.scene.start('Intro');
  }

  /**
   * Partida ranqueada: pula intro e tutorial de propósito. O relógio é do
   * servidor e começa a correr no instante em que a corrida abre, então
   * qualquer cutscene no meio seria tempo perdido no placar.
   */
  /**
   * Tranca os botões durante uma ação demorada.
   *
   * Abrir corrida ranqueada é ida e volta de rede: sem isto dava para clicar em
   * Novo Jogo por cima e cair na cutscene com uma corrida já aberta no servidor.
   */
  private travarMenu(travado: boolean) {
    this.ocupado = travado;
    for (const b of this.botoes) {
      if (travado) b.disableInteractive().setAlpha(0.4);
      else b.setInteractive({ useHandCursor: true }).setAlpha(1);
    }
    // "Continuar" volta a ficar apagado se não houver save
    if (!travado && !State.hasSave) this.botoes[1]?.setAlpha(0.35).disableInteractive();
  }

  private async iniciarRanqueada() {
    if (this.ocupado) return;
    if (this.optionsPanel) this.toggleOptions();
    const dif = State.settings.difficulty;
    if (!ehRanqueavel(dif)) {
      this.mostrarAviso(
        `O modo ${dificuldadePorId(dif)?.nome} não entra no ranking.\n` +
          'Escolha Iniciático, DeMolay ou Cavaleiro nas Opções.'
      );
      return;
    }
    const nome = await pedirTexto({
      titulo: 'Partida ranqueada',
      dica: 'Nome do cavaleiro',
      ajuda: `Modo ${dificuldadePorId(dif)?.nome}. O tempo começa agora e corre até o Rei — ` +
        'sem pausa, numa sessão só. Trocar a dificuldade fica nas Opções.',
      confirmar: 'Começar'
    });
    if (nome === null) return;

    this.travarMenu(true);
    try {
      await Ranqueado.iniciar(nome.trim() || 'Galahad', dif);
      await fadeOut(this, 400);
      this.scene.start('Tower');
    } catch (erro) {
      const msg = erro instanceof ErroApi ? erro.message : 'falha ao abrir a corrida';
      this.mostrarAviso(`Não foi possível iniciar a partida ranqueada.\n${msg}`);
      this.travarMenu(false);
    }
  }

  private mostrarAviso(texto: string) {
    const aviso = this.add
      .text(GAME_WIDTH / 2, 500, texto, {
        fontFamily: FONTS.body, fontSize: '15px', color: '#ff8a8a', align: 'center',
        backgroundColor: 'rgba(6,10,28,0.9)', padding: { x: 10, y: 6 }
      })
      .setOrigin(0.5)
      .setDepth(1500);
    this.tweens.add({ targets: aviso, alpha: 0, delay: 3200, duration: 800, onComplete: () => aviso.destroy() });
  }

  private async abrirRanking() {
    if (this.ocupado) return;
    if (this.optionsPanel) this.toggleOptions();
    await fadeOut(this, 350);
    this.scene.start('Ranking');
  }

  private continueGame() {
    if (this.ocupado) return;
    Ranqueado.encerrar();
    State.loadSave();
    if (!State.hasSave) return;
    fadeOut(this, 500).then(() => this.scene.start('Tower'));
  }

  private toggleOptions() {
    if (this.ocupado) return;
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
    // no celular a resolução vem da tela do aparelho — o seletor não se aplica
    const auto = isAutoResolution();
    const resName = this.add
      .text(colR + 60, yr, auto ? 'Automática' : resolutionOf(State.settings.resolutionId).label, {
        fontFamily: FONTS.body, fontSize: '16px', color: auto ? '#aeb8e8' : '#ffc24d'
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
    if (!auto) {
      kids.push(
        arrowBtn(colR - 20, yr, -1, () => cycleRes(-1)),
        arrowBtn(colR + 140, yr, 1, () => cycleRes(1))
      );
    }

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
