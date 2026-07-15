import Phaser from 'phaser';
import { FONTS, GAME_HEIGHT, GAME_WIDTH } from '../data/config';
import { State } from '../systems/state';
import { Audio } from '../systems/audio';
import { fadeIn, fadeOut } from '../systems/ui';
import { renderScale, uiPx } from '../systems/display';

const FLOOR_H = 160;
const FLOORS = 8;
const WORLD_H = FLOORS * FLOOR_H + 300;
const GROUND_Y = WORLD_H - 60; // topo do chão térreo
const isTouch = () => window.matchMedia('(pointer: coarse)').matches;

interface Station {
  vela: number;
  x: number;
  y: number;
  pedestal: Phaser.GameObjects.Image;
  candle: Phaser.GameObjects.Sprite;
  locksRow: Phaser.GameObjects.Container;
  label: Phaser.GameObjects.Text;
  halo: Phaser.GameObjects.Image;
  haloTween?: Phaser.Tweens.Tween;
}

export class TowerScene extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Sprite;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<string, Phaser.Input.Keyboard.Key>;
  private ladders!: Phaser.GameObjects.Zone[];
  private climbing = false;
  private stations: Station[] = [];
  private nearStation: Station | null = null;
  private nearKing = false;
  private gate!: Phaser.GameObjects.Image;
  private gateBody!: Phaser.Physics.Arcade.Image;
  private king!: Phaser.GameObjects.Sprite;
  private hudCandles: Phaser.GameObjects.Container[] = [];
  private floorText!: Phaser.GameObjects.Text;
  private promptText!: Phaser.GameObjects.Text;
  private touchState = { left: false, right: false, up: false, down: false };
  private actionBtn?: Phaser.GameObjects.Container;
  private busy = false;
  private lastStepSound = 0;
  private worldLayer!: Phaser.GameObjects.Layer;
  private hudLayer!: Phaser.GameObjects.Layer;
  private hudCam!: Phaser.Cameras.Scene2D.Camera;

  constructor() {
    super('Tower');
  }

  floorY(n: number) {
    return GROUND_Y - n * FLOOR_H;
  }

  create(data: { practiceFirst?: boolean }) {
    if (!State.save) State.newGame('');
    this.stations = [];
    this.hudCandles = [];
    this.climbing = false;
    this.busy = false;

    // camadas separadas: mundo rola com o jogador, HUD fica fixo na tela —
    // necessário porque setScrollFactor(0) não funciona sob zoom de câmera
    // (as resoluções >540p aplicam zoom na câmera principal)
    this.worldLayer = this.add.layer();
    this.hudLayer = this.add.layer();

    const k = renderScale();
    this.cameras.main.setZoom(k);
    this.physics.world.setBounds(0, 0, GAME_WIDTH, WORLD_H);
    this.cameras.main.setBounds(0, 0, GAME_WIDTH, WORLD_H);
    this.cameras.main.setBackgroundColor(0x11142a);

    // parede distante (paralaxe) + parede de fundo
    const farWall = this.add
      .tileSprite(GAME_WIDTH / 2, WORLD_H / 2, GAME_WIDTH, WORLD_H, 'wall')
      .setAlpha(0.5)
      .setTint(0x1c2038)
      .setScrollFactor(1, 0.5);
    this.worldLayer.add(farWall);
    this.worldLayer.add(this.add.tileSprite(GAME_WIDTH / 2, WORLD_H / 2, GAME_WIDTH, WORLD_H, 'wall').setAlpha(0.9));

    // tochas ambiente com halo tremeluzente e brasas subindo
    for (let n = 0; n <= 7; n++) {
      const y = this.floorY(n) - 90;
      for (const x of [200, 760]) {
        const torch = this.add.sprite(x, y, 'torch-flame-0').setScale(1.6);
        torch.play({ key: 'torch-flame', delay: (n * 137) % 400 });
        const halo = this.add
          .image(x, y - 4, 'glow')
          .setBlendMode(Phaser.BlendModes.ADD)
          .setTint(0xff8a3c)
          .setScale(0.7)
          .setAlpha(0.5);
        this.tweens.add({
          targets: halo,
          alpha: { from: 0.35, to: 0.7 },
          scale: { from: 0.6, to: 0.85 },
          duration: 500 + Math.random() * 400,
          yoyo: true,
          repeat: -1,
          ease: 'sine.inout',
          delay: Math.random() * 300
        });
        const embers = this.add.particles(x, y - 8, 'spark', {
          speed: { min: 4, max: 14 },
          angle: { min: 260, max: 280 },
          lifespan: 1400,
          frequency: 900 + Math.random() * 400,
          alpha: { start: 0.5, end: 0 },
          scale: { start: 0.8, end: 0.1 },
          tint: 0xff8a3c
        });
        this.worldLayer.add([torch, halo, embers]);
      }
    }

    // poeira flutuando na torre inteira
    const dust = this.add.particles(GAME_WIDTH / 2, WORLD_H / 2, 'spark', {
      x: { min: 0, max: GAME_WIDTH },
      y: { min: 0, max: WORLD_H },
      speedY: { min: -6, max: -2 },
      speedX: { min: -3, max: 3 },
      lifespan: 6000,
      frequency: 400,
      alpha: { start: 0.12, end: 0 },
      scale: { start: 0.6, end: 1.2 },
      tint: 0x8890b8
    });
    this.worldLayer.add(dust);

    const platforms = this.physics.add.staticGroup();
    const addPlatform = (x1: number, x2: number, topY: number) => {
      const w = x2 - x1;
      if (w <= 0) return;
      const seg = this.add.tileSprite(x1 + w / 2, topY + 12, w, 24, 'floor');
      platforms.add(seg);
      (seg.body as Phaser.Physics.Arcade.StaticBody).setSize(w, 24);
      this.worldLayer.add(seg);
    };

    // chão térreo
    addPlatform(0, GAME_WIDTH, GROUND_Y);

    // andares 1–8 com vão para a escada (alterna esquerda/direita)
    this.ladders = [];
    for (let n = 1; n <= FLOORS; n++) {
      const y = this.floorY(n);
      const gapLeft = n % 2 === 1;
      const g1 = gapLeft ? 70 : 810;
      const g2 = g1 + 70;
      addPlatform(0, g1, y);
      addPlatform(g2, GAME_WIDTH, y);
      // escada do andar n-1 até n, dentro do vão
      const lx = g1 + 40;
      const bottom = this.floorY(n - 1);
      const h = bottom - y;
      this.worldLayer.add(this.add.tileSprite(lx, y + h / 2 + 12, 32, h, 'ladder'));
      const zone = this.add.zone(lx, y + h / 2, 44, h + 24);
      this.physics.add.existing(zone, true);
      this.ladders.push(zone);
    }

    // estações das velas — andares 1 a 7, posições variadas
    const stationX = [480, 620, 340, 480, 660, 300, 480];
    for (let vela = 1; vela <= 7; vela++) {
      this.buildStation(vela, stationX[vela - 1], this.floorY(vela));
    }

    // portão do 8º andar (bloqueia o vão de subida)
    const gateGapLeft = FLOORS % 2 === 1;
    const gx = (gateGapLeft ? 70 : 810) + 40;
    const gy = this.floorY(8) + 70;
    this.gate = this.add.image(gx, gy + 60, 'gate').setAlpha(0.95);
    this.tweens.add({ targets: this.gate, alpha: 0.65, yoyo: true, repeat: -1, duration: 900 });
    this.gateBody = this.physics.add.staticImage(gx, gy + 60, 'px').setVisible(false);
    (this.gateBody.body as Phaser.Physics.Arcade.StaticBody).setSize(72, 130);
    this.worldLayer.add(this.gate);
    this.worldLayer.add(
      this.add
        .text(gx, gy - 20, 'As sete luzes\nabrem o caminho', {
          fontFamily: FONTS.body, fontSize: uiPx(14), color: '#ffc24d', align: 'center'
        })
        .setOrigin(0.5)
    );

    // o Rei no 8º andar
    this.king = this.add.sprite(480, this.floorY(8), 'king').setScale(2.4).setOrigin(0.5, 1);
    this.worldLayer.add(this.king);
    this.worldLayer.add(
      this.add
        .text(480, this.floorY(8) - 96, 'O Rei', { fontFamily: FONTS.display, fontSize: uiPx(15), color: '#d9a441' })
        .setOrigin(0.5)
    );

    // jogador
    const spawnFloor = Math.min(State.save!.floor ?? 1, 7);
    this.player = this.physics.add.sprite(140, this.floorY(Math.max(0, spawnFloor - 1)) - 30, 'knight-sheet', 'idle');
    this.player.setScale(2);
    this.player.setSize(12, 26).setOffset(4, 2);
    this.player.setCollideWorldBounds(true);
    this.physics.add.collider(this.player, platforms, undefined, () => !this.climbing);
    this.physics.add.collider(this.player, this.gateBody, undefined, () => !State.allLit);
    this.worldLayer.add(this.player);

    this.cameras.main.startFollow(this.player, false, 0.12, 0.12);

    // input
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasd = this.input.keyboard!.addKeys('W,A,S,D,E') as any;
    this.input.keyboard!.on('keydown-E', () => this.tryInteract());
    this.input.keyboard!.on('keydown-ENTER', () => this.tryInteract());

    this.buildHUD();
    if (isTouch()) this.buildTouchControls();

    // câmera de HUD: fixa no mundo lógico 960×540, não segue o jogador
    this.hudCam = this.cameras.add(0, 0);
    this.hudCam.setZoom(k).centerOn(GAME_WIDTH / 2, GAME_HEIGHT / 2);
    this.hudCam.ignore(this.worldLayer);
    this.cameras.main.ignore(this.hudLayer);

    fadeIn(this, 500);
    this.hudCam.fadeIn(500, 4, 6, 18);
    Audio.ambientStart();

    this.events.off('resume');
    this.events.on('resume', () => {
      this.refreshStations();
      this.refreshHUD();
      this.refreshGate();
    });

    if (data?.practiceFirst) {
      this.time.delayedCall(400, () => this.openQuiz(1, true));
    }
  }

  // ------------------------------------------------------------- estações
  private buildStation(vela: number, x: number, floorTopY: number) {
    const y = floorTopY;
    const halo = this.add
      .image(x, y - 48, 'glow')
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(0xffc24d)
      .setScale(0)
      .setAlpha(0);
    const pedestal = this.add.image(x, y - 18, 'pedestal');
    const candle = this.add.sprite(x, y - 48, 'candle-unlit').setScale(1.6);
    const locksRow = this.add.container(x, y - 92);
    const label = this.add
      .text(x, y - 118, `Vela ${vela}`, { fontFamily: FONTS.display, fontSize: uiPx(14), color: '#aeb8e8' })
      .setOrigin(0.5);
    pedestal.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
      if (this.nearStation?.vela === vela) this.tryInteract();
    });
    this.worldLayer.add([halo, pedestal, candle, locksRow, label]);
    const st: Station = { vela, x, y, pedestal, candle, locksRow, label, halo };
    this.stations.push(st);
    this.refreshStation(st);
  }

  private refreshStation(st: Station) {
    const c = State.candle(st.vela);
    st.locksRow.removeAll(true);
    if (c.locks > 0) {
      st.candle.setVisible(false);
      const total = c.locks;
      for (let i = 0; i < total; i++) {
        const lock = this.add.image((i - (total - 1) / 2) * 26, 0, 'lock');
        st.locksRow.add(lock);
      }
      st.label.setColor('#aeb8e8');
      this.setStationHalo(st, false);
    } else {
      st.candle.setVisible(true);
      if (c.lit) {
        st.candle.play('candle-flame', true);
        st.label.setColor('#ffc24d');
        this.setStationHalo(st, true);
      } else {
        st.candle.stop();
        st.candle.setTexture('candle-unlit');
        st.label.setColor('#dcc494');
        this.setStationHalo(st, false);
      }
    }
  }

  /** poça de luz permanente sobre as velas acesas */
  private setStationHalo(st: Station, on: boolean) {
    if (on && !st.haloTween) {
      st.halo.setScale(1.5).setAlpha(0.35);
      st.haloTween = this.tweens.add({
        targets: st.halo,
        alpha: { from: 0.35, to: 0.6 },
        scale: { from: 1.4, to: 1.8 },
        duration: 1400,
        yoyo: true,
        repeat: -1,
        ease: 'sine.inout'
      });
    } else if (!on && st.haloTween) {
      st.haloTween.stop();
      st.haloTween = undefined;
      st.halo.setScale(0).setAlpha(0);
    }
  }

  private refreshStations() {
    this.stations.forEach((s) => this.refreshStation(s));
  }

  private refreshGate() {
    if (State.allLit) {
      this.gate.setVisible(false);
      this.gateBody.disableBody(true, true);
    }
  }

  // ------------------------------------------------------------------ HUD
  private buildHUD() {
    const vignette = this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'vignette').setAlpha(0.4).setDepth(890);
    this.hudLayer.add(vignette);

    const hudBg = this.add
      .image(GAME_WIDTH / 2, 26, 'px')
      .setDisplaySize(GAME_WIDTH, 52)
      .setTint(0x060a1c)
      .setAlpha(0.75)
      .setDepth(900);
    this.hudLayer.add(hudBg);

    for (let v = 1; v <= 7; v++) {
      const icon = this.add.sprite(0, 0, 'candle-unlit').setScale(1);
      const count = this.add
        .text(0, 18, '', { fontFamily: FONTS.body, fontSize: uiPx(13), color: '#f3e6c4' })
        .setOrigin(0.5);
      const c = this.add.container(24 + v * 44, 22, [icon, count]).setDepth(901);
      this.hudLayer.add(c);
      this.hudCandles.push(c);
    }
    this.floorText = this.add
      .text(GAME_WIDTH - 130, 16, '', { fontFamily: FONTS.display, fontSize: uiPx(16), color: '#f3e6c4' })
      .setDepth(901);
    this.hudLayer.add(this.floorText);
    const menuBtn = this.add
      .text(GAME_WIDTH - 24, 16, '☰', { fontFamily: FONTS.display, fontSize: uiPx(22), color: '#ffc24d' })
      .setOrigin(1, 0)
      .setDepth(901)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', async () => {
        State.persistSave();
        Audio.ambientStop();
        await fadeOut(this, 400);
        this.hudCam.fadeOut(400, 4, 6, 18);
        this.scene.start('Menu');
      });
    this.hudLayer.add(menuBtn);

    this.promptText = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT - 110, '', {
        fontFamily: FONTS.body, fontSize: uiPx(18), color: '#ffc24d',
        backgroundColor: 'rgba(6,10,28,0.8)', padding: { x: 12, y: 6 }
      })
      .setOrigin(0.5)
      .setDepth(902)
      .setVisible(false);
    this.hudLayer.add(this.promptText);

    this.refreshHUD();
  }

  private refreshHUD() {
    for (let v = 1; v <= 7; v++) {
      const c = State.candle(v);
      const cont = this.hudCandles[v - 1];
      const icon = cont.getAt(0) as Phaser.GameObjects.Sprite;
      const count = cont.getAt(1) as Phaser.GameObjects.Text;
      if (c.lit) {
        icon.play('candle-flame', true);
        count.setText('✓').setColor('#ffc24d');
      } else {
        icon.stop();
        icon.setTexture('candle-unlit');
        icon.setAlpha(c.locks > 0 ? 0.55 : 1);
        count.setText(c.locks > 0 ? `${c.locks}🔒` : 'apta').setColor('#aeb8e8');
      }
    }
  }

  // ----------------------------------------------------------- touch controls
  private buildTouchControls() {
    const mk = (x: number, y: number, label: string, key: keyof typeof this.touchState | 'action') => {
      const bg = this.add.image(0, 0, 'px').setDisplaySize(74, 74).setTint(0x14182e).setAlpha(0.7);
      const tx = this.add
        .text(0, 0, label, { fontFamily: FONTS.display, fontSize: uiPx(30), color: '#f3e6c4' })
        .setOrigin(0.5);
      const c = this.add.container(x, y, [bg, tx]).setDepth(950);
      this.hudLayer.add(c);
      c.setSize(74, 74).setInteractive();
      if (key === 'action') {
        c.on('pointerdown', () => this.tryInteract());
      } else {
        c.on('pointerdown', () => (this.touchState[key] = true));
        c.on('pointerup', () => (this.touchState[key] = false));
        c.on('pointerout', () => (this.touchState[key] = false));
      }
      return c;
    };
    mk(58, GAME_HEIGHT - 58, '◀', 'left');
    mk(146, GAME_HEIGHT - 58, '▶', 'right');
    mk(GAME_WIDTH - 58, GAME_HEIGHT - 58, '⬆', 'up');
    mk(GAME_WIDTH - 58, GAME_HEIGHT - 146, '⬇', 'down');
    this.actionBtn = mk(GAME_WIDTH - 150, GAME_HEIGHT - 58, '✦', 'action');
    this.actionBtn.setVisible(false);
  }

  // ------------------------------------------------------------- interação
  private tryInteract() {
    if (this.busy) return;
    if (this.nearKing && State.allLit) {
      this.busy = true;
      State.persistSave();
      Audio.ambientStop();
      fadeOut(this, 600).then(() => this.scene.start('Final'));
      return;
    }
    if (!this.nearStation) return;
    const c = State.candle(this.nearStation.vela);
    if (c.locks > 0) {
      this.openQuiz(this.nearStation.vela, false);
    } else if (!c.lit) {
      const st = this.nearStation;
      State.lightCandle(st.vela);
      Audio.candleLight();
      this.cameras.main.flash(200, 255, 194, 77);
      const burst = this.add.particles(st.x, st.y - 48, 'spark', {
        speed: { min: 40, max: 120 },
        lifespan: 600,
        quantity: 18,
        scale: { start: 1.4, end: 0 },
        tint: 0xffc24d,
        emitting: false
      });
      this.worldLayer.add(burst);
      burst.explode(18);
      this.refreshStations();
      this.refreshHUD();
      this.refreshGate();
    }
  }

  private openQuiz(vela: number, practice: boolean) {
    this.busy = true;
    this.scene.pause();
    this.scene.launch('Quiz', { vela, practice });
    this.scene.get('Quiz').events.once('shutdown', () => {
      this.busy = false;
    });
  }

  // ---------------------------------------------------------------- update
  update() {
    if (!this.player?.body) return;
    const body = this.player.body as Phaser.Physics.Arcade.Body;

    const left = this.cursors.left.isDown || this.wasd.A.isDown || this.touchState.left;
    const right = this.cursors.right.isDown || this.wasd.D.isDown || this.touchState.right;
    const up = this.cursors.up.isDown || this.wasd.W.isDown || this.touchState.up;
    const down = this.cursors.down.isDown || this.wasd.S.isDown || this.touchState.down;
    const jump = Phaser.Input.Keyboard.JustDown(this.cursors.space) || (this.touchState.up && body.blocked.down);

    // escada?
    let onLadder = false;
    for (const z of this.ladders) {
      const zb = z.body as Phaser.Physics.Arcade.StaticBody;
      if (
        this.player.x > zb.x && this.player.x < zb.x + zb.width &&
        this.player.y > zb.y - 10 && this.player.y < zb.y + zb.height + 10
      ) {
        onLadder = true;
        break;
      }
    }

    const now = this.time.now;
    if (onLadder && (up || down || this.climbing)) {
      this.climbing = true;
      body.setAllowGravity(false);
      body.setVelocityX(left ? -120 : right ? 120 : 0);
      body.setVelocityY(up ? -140 : down ? 140 : 0);
      if (up || down) {
        this.player.play('knight-climb', true);
        if (now - this.lastStepSound > 220) {
          Audio.climb();
          this.lastStepSound = now;
        }
      } else this.player.anims.pause();
    } else {
      this.climbing = false;
      body.setAllowGravity(true);
      const speed = 210;
      if (left) {
        body.setVelocityX(-speed);
        this.player.setFlipX(true);
      } else if (right) {
        body.setVelocityX(speed);
        this.player.setFlipX(false);
      } else {
        body.setVelocityX(0);
      }
      if ((jump || (up && body.blocked.down)) && body.blocked.down) {
        body.setVelocityY(-360);
        Audio.jump();
      }
      if (!body.blocked.down) {
        this.player.play('knight-jump', true);
      } else if (left || right) {
        this.player.play('knight-walk', true);
        if (now - this.lastStepSound > 260) {
          Audio.footstep();
          this.lastStepSound = now;
        }
      } else {
        this.player.play('knight-idle', true);
      }
    }

    // andar atual + persistência leve
    const floor = Phaser.Math.Clamp(Math.round((GROUND_Y - this.player.y) / FLOOR_H), 0, 8);
    if (State.save && State.save.floor !== floor) {
      State.save.floor = floor;
      State.persistSave();
    }
    this.floorText?.setText(floor === 0 ? 'Térreo' : `${floor}º andar`);

    // proximidade das estações
    this.nearStation = null;
    for (const st of this.stations) {
      if (Math.abs(this.player.x - st.x) < 60 && Math.abs(this.player.y - st.y) < 80) {
        this.nearStation = st;
        break;
      }
    }
    this.nearKing =
      Math.abs(this.player.x - this.king.x) < 70 && Math.abs(this.player.y - this.king.y) < 90;

    let prompt = '';
    if (this.nearStation) {
      const c = State.candle(this.nearStation.vela);
      if (c.locks > 0) prompt = isTouch() ? '✦ Enfrentar as trancas' : 'E · Enfrentar as trancas';
      else if (!c.lit) prompt = isTouch() ? '✦ Acender a vela' : 'E · Acender a vela';
    } else if (this.nearKing) {
      prompt = State.allLit
        ? (isTouch() ? '✦ Apresentar-se ao Rei' : 'E · Apresentar-se ao Rei')
        : 'O Rei aguarda as sete luzes...';
    }
    this.promptText?.setText(prompt).setVisible(!!prompt);
    this.actionBtn?.setVisible(!!prompt && (!!this.nearStation || (this.nearKing && State.allLit)));
  }
}
