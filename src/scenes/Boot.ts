import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../data/config';

/**
 * Gera 100% da arte proceduralmente (pixel art via canvas).
 * Cada textura tem uma chave estável — para usar sprites reais no futuro,
 * basta carregar um PNG com a mesma chave no lugar.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create() {
    this.makeCastleBackground();
    this.makeThroneRoom();
    this.makeTowerTiles();
    this.makeCandle();
    this.makeLock();
    this.makeKnight();
    this.makeCharacters();
    this.makeMisc();
    this.makeAnimations();
    this.scene.start('Menu');
  }

  private ctxOf(key: string, w: number, h: number) {
    const tex = this.textures.createCanvas(key, w, h)!;
    return { tex, ctx: tex.getContext() };
  }

  // ---------------------------------------------------------- fundo: castelo
  private makeCastleBackground() {
    const { tex, ctx } = this.ctxOf('bg-castle', GAME_WIDTH, GAME_HEIGHT);
    // céu noturno em degradê
    const sky = ctx.createLinearGradient(0, 0, 0, GAME_HEIGHT);
    sky.addColorStop(0, '#060a1c');
    sky.addColorStop(0.6, '#0b1026');
    sky.addColorStop(1, '#1a2142');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    // estrelas
    for (let i = 0; i < 140; i++) {
      const x = Math.random() * GAME_WIDTH;
      const y = Math.random() * GAME_HEIGHT * 0.65;
      ctx.fillStyle = Math.random() < 0.2 ? '#fff0b8' : '#aeb8e8';
      ctx.fillRect(x, y, Math.random() < 0.15 ? 2 : 1, Math.random() < 0.15 ? 2 : 1);
    }
    // lua
    ctx.fillStyle = '#e8ecff';
    ctx.beginPath();
    ctx.arc(780, 90, 34, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#c9d2f5';
    ctx.beginPath();
    ctx.arc(770, 82, 8, 0, Math.PI * 2);
    ctx.arc(792, 100, 5, 0, Math.PI * 2);
    ctx.fill();
    // colinas
    ctx.fillStyle = '#101632';
    ctx.beginPath();
    ctx.moveTo(0, 470);
    ctx.quadraticCurveTo(240, 400, 480, 460);
    ctx.quadraticCurveTo(720, 510, 960, 450);
    ctx.lineTo(960, 540);
    ctx.lineTo(0, 540);
    ctx.fill();
    // castelo (silhueta com janelas acesas)
    const castle = (x: number, w: number, h: number, roof = true) => {
      ctx.fillStyle = '#161c38';
      ctx.fillRect(x, 460 - h, w, h);
      // ameias
      for (let bx = x; bx < x + w; bx += 14) ctx.fillRect(bx, 460 - h - 8, 8, 8);
      if (roof) {
        ctx.fillStyle = '#20264a';
        ctx.beginPath();
        ctx.moveTo(x - 6, 460 - h - 8);
        ctx.lineTo(x + w / 2, 460 - h - 8 - w * 0.7);
        ctx.lineTo(x + w + 6, 460 - h - 8);
        ctx.fill();
      }
      // janelas
      for (let wy = 460 - h + 18; wy < 440; wy += 34) {
        for (let wx = x + 10; wx < x + w - 12; wx += 24) {
          if (Math.random() < 0.55) {
            ctx.fillStyle = Math.random() < 0.5 ? '#ffc24d' : '#ff8a3c';
            ctx.fillRect(wx, wy, 6, 10);
          }
        }
      }
    };
    // torre central alta (a Torre das Sete Luzes)
    castle(180, 70, 150);
    castle(640, 70, 130);
    ctx.fillStyle = '#1c2244';
    ctx.fillRect(250, 340, 390, 120); // corpo do castelo
    for (let bx = 250; bx < 640; bx += 16) ctx.fillRect(bx, 332, 9, 8);
    castle(420, 90, 300); // torre principal
    // portão
    ctx.fillStyle = '#0a0d20';
    ctx.beginPath();
    ctx.arc(445 + 20, 460, 26, Math.PI, 0);
    ctx.fill();
    ctx.fillRect(439, 460, 52, 0);
    tex.refresh();
  }

  // ----------------------------------------------------- fundo: sala do trono
  private makeThroneRoom() {
    const { tex, ctx } = this.ctxOf('bg-throne', GAME_WIDTH, GAME_HEIGHT);
    // parede de pedra
    ctx.fillStyle = '#3d4463';
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    ctx.strokeStyle = '#2a2f45';
    ctx.lineWidth = 2;
    for (let y = 0; y < 420; y += 36) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(GAME_WIDTH, y);
      ctx.stroke();
      for (let x = (y / 36) % 2 === 0 ? 0 : 32; x < GAME_WIDTH; x += 64) {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, y + 36);
        ctx.stroke();
      }
    }
    // janelas em arco com noite
    for (const wx of [120, 760]) {
      ctx.fillStyle = '#0b1026';
      ctx.fillRect(wx, 80, 80, 150);
      ctx.beginPath();
      ctx.arc(wx + 40, 80, 40, Math.PI, 0);
      ctx.fill();
      ctx.fillStyle = '#e8ecff';
      ctx.fillRect(wx + 30, 96, 3, 3);
      ctx.fillRect(wx + 55, 120, 2, 2);
      ctx.fillRect(wx + 18, 140, 2, 2);
    }
    // estandartes
    for (const bx of [280, 620]) {
      ctx.fillStyle = '#7a1f1f';
      ctx.fillRect(bx, 60, 60, 130);
      ctx.beginPath();
      ctx.moveTo(bx, 190);
      ctx.lineTo(bx + 30, 220);
      ctx.lineTo(bx + 60, 190);
      ctx.fill();
      ctx.fillStyle = '#d9a441';
      ctx.fillRect(bx - 4, 54, 68, 8);
      // emblema: coroa
      ctx.fillRect(bx + 20, 110, 20, 8);
      ctx.fillRect(bx + 20, 100, 4, 10);
      ctx.fillRect(bx + 28, 96, 4, 14);
      ctx.fillRect(bx + 36, 100, 4, 10);
    }
    // piso
    ctx.fillStyle = '#2a2f45';
    ctx.fillRect(0, 420, GAME_WIDTH, 120);
    ctx.strokeStyle = '#1d2136';
    for (let x = 0; x < GAME_WIDTH; x += 48) {
      ctx.beginPath();
      ctx.moveTo(x, 420);
      ctx.lineTo(x - 30, 540);
      ctx.stroke();
    }
    // tapete vermelho
    ctx.fillStyle = '#7a1f1f';
    ctx.beginPath();
    ctx.moveTo(400, 420);
    ctx.lineTo(560, 420);
    ctx.lineTo(640, 540);
    ctx.lineTo(320, 540);
    ctx.fill();
    ctx.fillStyle = '#d9a441';
    ctx.beginPath();
    ctx.moveTo(410, 420);
    ctx.lineTo(418, 420);
    ctx.lineTo(342, 540);
    ctx.lineTo(330, 540);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(542, 420);
    ctx.lineTo(550, 420);
    ctx.lineTo(630, 540);
    ctx.lineTo(618, 540);
    ctx.fill();
    // trono
    ctx.fillStyle = '#5b3a1e';
    ctx.fillRect(440, 300, 80, 130);
    ctx.fillStyle = '#7a5227';
    ctx.fillRect(448, 310, 64, 110);
    ctx.fillStyle = '#d9a441';
    ctx.fillRect(436, 292, 88, 10);
    ctx.fillRect(452, 276, 8, 18);
    ctx.fillRect(476, 268, 8, 26);
    ctx.fillRect(500, 276, 8, 18);
    tex.refresh();
  }

  // -------------------------------------------------------------- torre: tiles
  private makeTowerTiles() {
    // parede interna
    {
      const { tex, ctx } = this.ctxOf('wall', 64, 64);
      ctx.fillStyle = '#2e3350';
      ctx.fillRect(0, 0, 64, 64);
      ctx.strokeStyle = '#232742';
      ctx.lineWidth = 2;
      for (let y = 0; y < 64; y += 16) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(64, y);
        ctx.stroke();
        for (let x = (y / 16) % 2 === 0 ? 0 : 16; x < 64; x += 32) {
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x, y + 16);
          ctx.stroke();
        }
      }
      // variação de pedra
      ctx.fillStyle = 'rgba(86,94,133,0.25)';
      ctx.fillRect(4, 4, 24, 10);
      ctx.fillRect(36, 36, 22, 10);
      tex.refresh();
    }
    // plataforma / laje
    {
      const { tex, ctx } = this.ctxOf('floor', 32, 24);
      ctx.fillStyle = '#565e85';
      ctx.fillRect(0, 0, 32, 8);
      ctx.fillStyle = '#3d4463';
      ctx.fillRect(0, 8, 32, 16);
      ctx.fillStyle = '#767ea8';
      ctx.fillRect(0, 0, 32, 2);
      ctx.strokeStyle = '#2a2f45';
      ctx.strokeRect(0.5, 0.5, 31, 23);
      tex.refresh();
    }
    // escada
    {
      const { tex, ctx } = this.ctxOf('ladder', 32, 32);
      ctx.fillStyle = '#7a5227';
      ctx.fillRect(4, 0, 5, 32);
      ctx.fillRect(23, 0, 5, 32);
      ctx.fillStyle = '#5b3a1e';
      for (let y = 4; y < 32; y += 8) ctx.fillRect(4, y, 24, 4);
      tex.refresh();
    }
    // pedestal da vela
    {
      const { tex, ctx } = this.ctxOf('pedestal', 48, 36);
      ctx.fillStyle = '#565e85';
      ctx.fillRect(8, 0, 32, 6);
      ctx.fillStyle = '#3d4463';
      ctx.fillRect(14, 6, 20, 24);
      ctx.fillStyle = '#565e85';
      ctx.fillRect(6, 30, 36, 6);
      ctx.fillStyle = '#d9a441';
      ctx.fillRect(20, 12, 8, 3);
      tex.refresh();
    }
    // portão mágico (8º andar)
    {
      const { tex, ctx } = this.ctxOf('gate', 72, 120);
      const g = ctx.createLinearGradient(0, 0, 72, 0);
      g.addColorStop(0, 'rgba(122,31,31,0.15)');
      g.addColorStop(0.5, 'rgba(217,164,65,0.55)');
      g.addColorStop(1, 'rgba(122,31,31,0.15)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 72, 120);
      ctx.strokeStyle = '#ffc24d';
      ctx.lineWidth = 2;
      for (let y = 6; y < 120; y += 14) {
        ctx.beginPath();
        ctx.moveTo(8, y);
        ctx.lineTo(64, y);
        ctx.stroke();
      }
      tex.refresh();
    }
  }

  // ------------------------------------------------------------------- vela
  private makeCandle() {
    const draw = (key: string, lit: boolean, flameOffset: number) => {
      const { tex, ctx } = this.ctxOf(key, 24, 40);
      // vela
      ctx.fillStyle = '#f3e6c4';
      ctx.fillRect(8, 16, 8, 20);
      ctx.fillStyle = '#dcc494';
      ctx.fillRect(8, 16, 2, 20);
      // pavio
      ctx.fillStyle = '#2c1c08';
      ctx.fillRect(11, 13, 2, 4);
      if (lit) {
        // brilho
        const g = ctx.createRadialGradient(12, 10, 1, 12, 10, 11);
        g.addColorStop(0, 'rgba(255,240,184,0.9)');
        g.addColorStop(1, 'rgba(255,194,77,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, 24, 22);
        // chama
        ctx.fillStyle = '#ff8a3c';
        ctx.beginPath();
        ctx.ellipse(12, 8 + flameOffset, 4, 7, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffc24d';
        ctx.beginPath();
        ctx.ellipse(12, 9 + flameOffset, 2.6, 5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff0b8';
        ctx.beginPath();
        ctx.ellipse(12, 10 + flameOffset, 1.4, 3, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      tex.refresh();
    };
    draw('candle-unlit', false, 0);
    draw('candle-lit-0', true, 0);
    draw('candle-lit-1', true, 1.5);
  }

  // ------------------------------------------------------------------ tranca
  private makeLock() {
    const { tex, ctx } = this.ctxOf('lock', 20, 26);
    ctx.strokeStyle = '#aeb8e8';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(10, 9, 6, Math.PI, 0);
    ctx.stroke();
    ctx.fillStyle = '#d9a441';
    ctx.fillRect(2, 10, 16, 14);
    ctx.fillStyle = '#7a5227';
    ctx.fillRect(8, 15, 4, 6);
    tex.refresh();
  }

  // ---------------------------------------------------------------- cavaleiro
  private makeKnight() {
    const FW = 20;
    const FH = 28;
    const frames = ['idle', 'walk0', 'walk1', 'walk2', 'walk3', 'jump', 'climb0', 'climb1', 'kneel'];
    const { tex, ctx } = this.ctxOf('knight-sheet', FW * frames.length, FH);

    const drawKnight = (ox: number, pose: string) => {
      const P = (x: number, y: number, w: number, h: number, c: string) => {
        ctx.fillStyle = c;
        ctx.fillRect(ox + x, y, w, h);
      };
      const steel = '#aeb8e8';
      const steelD = '#767ea8';
      const plume = '#a53434';
      const gold = '#d9a441';
      const kneel = pose === 'kneel';
      const dy = kneel ? 5 : 0;
      // pluma
      P(9, 0 + dy, 3, 4, plume);
      // elmo
      P(6, 3 + dy, 9, 6, steel);
      P(7, 5 + dy, 7, 2, '#1d2136'); // viseira
      // torso
      P(5, 9 + dy, 11, 9, steelD);
      P(9, 10 + dy, 3, 7, gold); // detalhe dourado
      // braços
      if (pose === 'climb0') {
        P(3, 6 + dy, 3, 8, steel);
        P(15, 11 + dy, 3, 8, steel);
      } else if (pose === 'climb1') {
        P(3, 11 + dy, 3, 8, steel);
        P(15, 6 + dy, 3, 8, steel);
      } else if (pose === 'jump') {
        P(2, 8, 3, 6, steel);
        P(16, 8, 3, 6, steel);
      } else {
        P(3, 10 + dy, 3, 8, steel);
        P(15, 10 + dy, 3, 8, steel);
      }
      // pernas
      if (kneel) {
        P(6, 21, 4, 4, steelD); // joelho no chão
        P(12, 18, 4, 8, steelD);
        P(4, 25, 8, 3, '#2a2f45');
      } else if (pose === 'walk0') {
        P(6, 18, 4, 10, steelD);
        P(12, 18, 4, 8, steelD);
      } else if (pose === 'walk1') {
        P(5, 18, 4, 9, steelD);
        P(13, 18, 4, 10, steelD);
      } else if (pose === 'walk2') {
        P(7, 18, 4, 8, steelD);
        P(11, 18, 4, 10, steelD);
      } else if (pose === 'walk3') {
        P(6, 18, 4, 10, steelD);
        P(12, 18, 4, 9, steelD);
      } else if (pose === 'jump') {
        P(6, 18, 4, 7, steelD);
        P(12, 18, 4, 7, steelD);
      } else {
        P(7, 18, 4, 10, steelD);
        P(11, 18, 4, 10, steelD);
      }
    };

    frames.forEach((pose, i) => drawKnight(i * FW, pose));
    tex.refresh();
    frames.forEach((pose, i) => tex.add(pose, 0, i * FW, 0, FW, FH));
  }

  // ------------------------------------------------------------ personagens
  private makeCharacters() {
    // Rei
    {
      const { tex, ctx } = this.ctxOf('king', 24, 34);
      const P = (x: number, y: number, w: number, h: number, c: string) => {
        ctx.fillStyle = c;
        ctx.fillRect(x, y, w, h);
      };
      P(7, 4, 10, 6, '#e8c39e'); // rosto
      P(7, 0, 10, 4, '#d9a441'); // coroa
      P(7, -1, 2, 3, '#d9a441');
      P(11, -1, 2, 3, '#d9a441');
      P(15, -1, 2, 3, '#d9a441');
      P(7, 8, 10, 3, '#e6e6e6'); // barba
      P(4, 10, 16, 16, '#7a1f1f'); // manto
      P(9, 10, 6, 14, '#27408b'); // túnica
      P(4, 26, 6, 8, '#2a2f45');
      P(14, 26, 6, 8, '#2a2f45');
      tex.refresh();
    }
    // Merlin
    {
      const { tex, ctx } = this.ctxOf('merlin', 24, 36);
      const P = (x: number, y: number, w: number, h: number, c: string) => {
        ctx.fillStyle = c;
        ctx.fillRect(x, y, w, h);
      };
      // chapéu
      ctx.fillStyle = '#27408b';
      ctx.beginPath();
      ctx.moveTo(4, 8);
      ctx.lineTo(12, -2);
      ctx.lineTo(20, 8);
      ctx.fill();
      P(8, 8, 8, 5, '#e8c39e'); // rosto
      P(8, 12, 8, 6, '#e6e6e6'); // barba longa
      P(10, 18, 4, 3, '#e6e6e6');
      P(5, 13, 14, 16, '#27408b'); // túnica
      P(5, 13, 14, 2, '#d9a441');
      P(2, 14, 3, 18, '#5b3a1e'); // cajado
      P(1, 12, 5, 3, '#ffc24d');
      P(6, 29, 5, 7, '#1d2136');
      P(13, 29, 5, 7, '#1d2136');
      tex.refresh();
    }
    // espada (para os três toques)
    {
      const { tex, ctx } = this.ctxOf('sword', 8, 40);
      ctx.fillStyle = '#e8ecff';
      ctx.fillRect(3, 0, 2, 28);
      ctx.fillStyle = '#d9a441';
      ctx.fillRect(0, 28, 8, 3);
      ctx.fillStyle = '#5b3a1e';
      ctx.fillRect(3, 31, 2, 8);
      tex.refresh();
    }
  }

  // ---------------------------------------------------------------- diversos
  private makeMisc() {
    // faísca / partícula
    {
      const { tex, ctx } = this.ctxOf('spark', 6, 6);
      ctx.fillStyle = '#ffc24d';
      ctx.fillRect(1, 1, 4, 4);
      ctx.fillStyle = '#fff0b8';
      ctx.fillRect(2, 2, 2, 2);
      tex.refresh();
    }
    // pixel branco (para overlays e barras)
    {
      const { tex, ctx } = this.ctxOf('px', 2, 2);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 2, 2);
      tex.refresh();
    }
  }

  private makeAnimations() {
    this.anims.create({
      key: 'knight-walk',
      frames: ['walk0', 'walk1', 'walk2', 'walk3'].map((f) => ({ key: 'knight-sheet', frame: f })),
      frameRate: 10,
      repeat: -1
    });
    this.anims.create({
      key: 'knight-idle',
      frames: [{ key: 'knight-sheet', frame: 'idle' }],
      frameRate: 1
    });
    this.anims.create({
      key: 'knight-jump',
      frames: [{ key: 'knight-sheet', frame: 'jump' }],
      frameRate: 1
    });
    this.anims.create({
      key: 'knight-climb',
      frames: ['climb0', 'climb1'].map((f) => ({ key: 'knight-sheet', frame: f })),
      frameRate: 6,
      repeat: -1
    });
    this.anims.create({
      key: 'candle-flame',
      frames: [{ key: 'candle-lit-0' }, { key: 'candle-lit-1' }],
      frameRate: 5,
      repeat: -1
    });
  }
}
