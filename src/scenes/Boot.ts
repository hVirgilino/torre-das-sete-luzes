import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, DESIGN_DX } from '../data/config';

/** a lua fica ancorada na borda direita, não numa coluna fixa de 960 */
export const MOON_X = GAME_WIDTH - 180;

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
    this.makeStars();
    this.makeKnight();
    this.makeCharacters();
    this.makeGlow();
    this.makeVitrola();
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

    // céu noturno em degradê (4 estágios) + véu de névoa baixa
    const sky = ctx.createLinearGradient(0, 0, 0, GAME_HEIGHT);
    sky.addColorStop(0, '#040614');
    sky.addColorStop(0.35, '#080c22');
    sky.addColorStop(0.68, '#131a3a');
    sky.addColorStop(1, '#232c54');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    const mist = ctx.createLinearGradient(0, 380, 0, 470);
    mist.addColorStop(0, 'rgba(70,84,140,0)');
    mist.addColorStop(1, 'rgba(70,84,140,0.16)');
    ctx.fillStyle = mist;
    ctx.fillRect(0, 380, GAME_WIDTH, 90);

    // estrelas em 3 tamanhos, algumas com brilho em cruz
    for (let i = 0; i < 150; i++) {
      const x = Math.random() * GAME_WIDTH;
      const y = Math.random() * GAME_HEIGHT * 0.6;
      const big = Math.random() < 0.08;
      const mid = !big && Math.random() < 0.25;
      const c = Math.random() < 0.2 ? '#fff0b8' : '#c9d2f5';
      ctx.fillStyle = c;
      const s = big ? 2 : mid ? 1.4 : 1;
      ctx.fillRect(x, y, s, s);
      if (big) {
        ctx.globalAlpha = 0.55;
        ctx.fillRect(x - 3, y, 8, 1);
        ctx.fillRect(x, y - 3, 1, 8);
        ctx.globalAlpha = 1;
      }
    }

    // lua com halo suave + crateras — fica sempre à mesma distância da borda
    const MX = MOON_X;
    const moonHalo = ctx.createRadialGradient(MX, 90, 4, MX, 90, 70);
    moonHalo.addColorStop(0, 'rgba(232,236,255,0.35)');
    moonHalo.addColorStop(1, 'rgba(232,236,255,0)');
    ctx.fillStyle = moonHalo;
    ctx.fillRect(MX - 70, 20, 140, 140);
    ctx.fillStyle = '#e8ecff';
    ctx.beginPath();
    ctx.arc(MX, 90, 34, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#c9d2f5';
    ctx.beginPath();
    ctx.arc(MX - 10, 82, 8, 0, Math.PI * 2);
    ctx.arc(MX + 12, 100, 5, 0, Math.PI * 2);
    ctx.arc(MX - 12, 100, 3.5, 0, Math.PI * 2);
    ctx.fill();
    // nuvens finas translúcidas cruzando a lua
    ctx.fillStyle = 'rgba(20,24,50,0.35)';
    ctx.beginPath();
    ctx.ellipse(MX - 40, 100, 60, 8, -0.1, 0, Math.PI * 2);
    ctx.ellipse(MX + 40, 70, 40, 6, 0.15, 0, Math.PI * 2);
    ctx.fill();

    // montanhas distantes — plano extra de profundidade atrás das colinas.
    // O relevo acompanha a largura real para não sobrar céu na borda.
    const mx = (f: number) => f * GAME_WIDTH;
    ctx.fillStyle = '#0d1230';
    ctx.beginPath();
    ctx.moveTo(0, 430);
    ctx.lineTo(mx(0.125), 360);
    ctx.lineTo(mx(0.271), 420);
    ctx.lineTo(mx(0.448), 340);
    ctx.lineTo(mx(0.625), 410);
    ctx.lineTo(mx(0.792), 350);
    ctx.lineTo(GAME_WIDTH, 420);
    ctx.lineTo(GAME_WIDTH, 470);
    ctx.lineTo(0, 470);
    ctx.fill();

    // colinas (plano próximo)
    ctx.fillStyle = '#101632';
    ctx.beginPath();
    ctx.moveTo(0, 470);
    ctx.quadraticCurveTo(mx(0.25), 400, mx(0.5), 460);
    ctx.quadraticCurveTo(mx(0.75), 510, GAME_WIDTH, 450);
    ctx.lineTo(GAME_WIDTH, 540);
    ctx.lineTo(0, 540);
    ctx.fill();

    // o castelo é uma cena fechada: continua no design de 960, centralizado
    ctx.save();
    ctx.translate(DESIGN_DX, 0);

    // castelo (silhueta com face iluminada pela lua à direita, sombra à esquerda)
    const castle = (x: number, w: number, h: number, roof = true) => {
      const litSide = ctx.createLinearGradient(x, 0, x + w, 0);
      litSide.addColorStop(0, '#12162e');
      litSide.addColorStop(1, '#242b52');
      ctx.fillStyle = litSide;
      ctx.fillRect(x, 460 - h, w, h);
      // sugestão de textura de pedra: linhas esparsas
      ctx.strokeStyle = 'rgba(8,10,24,0.4)';
      ctx.lineWidth = 1;
      for (let sy = 460 - h + 12; sy < 456; sy += 18) {
        ctx.beginPath();
        ctx.moveTo(x + 2, sy);
        ctx.lineTo(x + w - 2, sy);
        ctx.stroke();
      }
      // ameias
      for (let bx = x; bx < x + w; bx += 14) ctx.fillRect(bx, 460 - h - 8, 8, 8);
      if (roof) {
        const roofGrad = ctx.createLinearGradient(x - 6, 0, x + w + 6, 0);
        roofGrad.addColorStop(0, '#181e3e');
        roofGrad.addColorStop(1, '#2c3462');
        ctx.fillStyle = roofGrad;
        ctx.beginPath();
        ctx.moveTo(x - 6, 460 - h - 8);
        ctx.lineTo(x + w / 2, 460 - h - 8 - w * 0.7);
        ctx.lineTo(x + w + 6, 460 - h - 8);
        ctx.fill();
        // brilho no cume do telhado
        ctx.fillStyle = 'rgba(174,184,232,0.7)';
        ctx.fillRect(x + w / 2 - 1, 460 - h - 8 - w * 0.7, 2, 6);
      }
      // janelas com halo por trás das acesas
      for (let wy = 460 - h + 18; wy < 440; wy += 34) {
        for (let wx = x + 10; wx < x + w - 12; wx += 24) {
          if (Math.random() < 0.55) {
            const halo = ctx.createRadialGradient(wx + 3, wy + 5, 1, wx + 3, wy + 5, 9);
            halo.addColorStop(0, 'rgba(255,194,77,0.45)');
            halo.addColorStop(1, 'rgba(255,194,77,0)');
            ctx.fillStyle = halo;
            ctx.fillRect(wx - 8, wy - 6, 22, 22);
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

    // estandartes nas torres laterais
    const banner = (x: number, y: number, color: string) => {
      ctx.fillStyle = color;
      ctx.fillRect(x, y, 10, 26);
      ctx.beginPath();
      ctx.moveTo(x, y + 26);
      ctx.lineTo(x + 5, y + 34);
      ctx.lineTo(x + 10, y + 26);
      ctx.fill();
    };
    banner(211, 312, '#7a1f1f');
    banner(671, 332, '#27408b');

    // portão com brilho quente vazando por baixo
    const gateGlow = ctx.createRadialGradient(465, 460, 2, 465, 460, 44);
    gateGlow.addColorStop(0, 'rgba(255,138,60,0.55)');
    gateGlow.addColorStop(1, 'rgba(255,138,60,0)');
    ctx.fillStyle = gateGlow;
    ctx.fillRect(415, 420, 100, 60);
    ctx.fillStyle = '#0a0d20';
    ctx.beginPath();
    ctx.arc(445 + 20, 460, 26, Math.PI, 0);
    ctx.fill();
    ctx.fillRect(439, 460, 52, 0);

    // as sete luzes — pontinhos dourados no topo da torre principal
    for (let i = 0; i < 7; i++) {
      const lx = 465 - 15 + i * 5;
      const ly = 158 + Math.sin(i * 1.3) * 3;
      const g = ctx.createRadialGradient(lx, ly, 0.5, lx, ly, 4);
      g.addColorStop(0, 'rgba(255,240,184,0.95)');
      g.addColorStop(1, 'rgba(255,194,77,0)');
      ctx.fillStyle = g;
      ctx.fillRect(lx - 4, ly - 4, 8, 8);
      ctx.fillStyle = '#fff0b8';
      ctx.fillRect(lx, ly, 1, 1);
    }
    ctx.restore();

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
    // janelas em arco com noite — presas às bordas laterais
    for (const wx of [120, GAME_WIDTH - 200]) {
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
    // estandartes — simétricos em torno do trono
    for (const bx of [GAME_WIDTH / 2 - 200, GAME_WIDTH / 2 + 140]) {
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
    // tapete e trono continuam no design de 960, centralizados
    ctx.save();
    ctx.translate(DESIGN_DX, 0);
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
    ctx.restore();
    tex.refresh();
  }

  // -------------------------------------------------------------- torre: tiles
  private makeTowerTiles() {
    // parede interna — blocos de pedra irregulares com juntas, rachaduras e musgo
    {
      const { tex, ctx } = this.ctxOf('wall', 64, 64);
      ctx.fillStyle = '#2a2f4a';
      ctx.fillRect(0, 0, 64, 64);
      const blocks: Array<[number, number, number, number]> = [
        [0, 0, 30, 16], [30, 0, 34, 16],
        [0, 16, 20, 18], [20, 16, 22, 18], [42, 16, 22, 18],
        [0, 34, 34, 16], [34, 34, 30, 16],
        [0, 50, 24, 14], [24, 50, 20, 14], [44, 50, 20, 14]
      ];
      for (const [bx, by, bw, bh] of blocks) {
        const tone = 0x2e3350 + (Math.random() < 0.5 ? 0x060a10 : 0);
        ctx.fillStyle = `rgb(${(tone >> 16) & 0xff},${(tone >> 8) & 0xff},${tone & 0xff})`;
        ctx.fillRect(bx + 1, by + 1, bw - 2, bh - 2);
        ctx.fillStyle = 'rgba(120,128,168,0.18)';
        ctx.fillRect(bx + 1, by + 1, bw - 2, 2);
      }
      ctx.strokeStyle = 'rgba(8,10,22,0.65)';
      ctx.lineWidth = 1;
      for (const [bx, by, bw, bh] of blocks) ctx.strokeRect(bx + 0.5, by + 0.5, bw - 1, bh - 1);
      // rachaduras
      ctx.strokeStyle = 'rgba(8,10,22,0.5)';
      ctx.beginPath();
      ctx.moveTo(24, 20);
      ctx.lineTo(28, 28);
      ctx.lineTo(25, 34);
      ctx.stroke();
      // musgo
      ctx.fillStyle = 'rgba(74,102,70,0.28)';
      ctx.fillRect(2, 48, 10, 6);
      ctx.fillRect(46, 6, 12, 5);
      tex.refresh();
    }
    // plataforma / laje — bisel claro no topo, fissuras, cantos gastos
    {
      const { tex, ctx } = this.ctxOf('floor', 32, 24);
      ctx.fillStyle = '#565e85';
      ctx.fillRect(0, 0, 32, 8);
      ctx.fillStyle = '#3d4463';
      ctx.fillRect(0, 8, 32, 16);
      ctx.fillStyle = '#767ea8';
      ctx.fillRect(0, 0, 32, 2);
      ctx.strokeStyle = 'rgba(20,24,44,0.5)';
      ctx.beginPath();
      ctx.moveTo(9, 8);
      ctx.lineTo(12, 14);
      ctx.lineTo(10, 20);
      ctx.stroke();
      ctx.fillStyle = 'rgba(20,24,44,0.35)';
      ctx.fillRect(0, 6, 4, 2);
      ctx.fillRect(28, 7, 4, 2);
      ctx.strokeStyle = '#2a2f45';
      ctx.strokeRect(0.5, 0.5, 31, 23);
      tex.refresh();
    }
    // escada — montantes com veios de madeira, degraus com sombra, braçadeiras metálicas
    {
      const { tex, ctx } = this.ctxOf('ladder', 32, 32);
      const railL = 4;
      const railR = 23;
      const railW = 5;
      ctx.fillStyle = '#6b431f';
      ctx.fillRect(railL, 0, railW, 32);
      ctx.fillRect(railR, 0, railW, 32);
      // veios de madeira
      ctx.strokeStyle = 'rgba(58,36,16,0.5)';
      ctx.lineWidth = 1;
      for (const rx of [railL, railR]) {
        ctx.beginPath();
        ctx.moveTo(rx + 1.5, 0);
        ctx.lineTo(rx + 1.5, 32);
        ctx.moveTo(rx + 3.5, 0);
        ctx.lineTo(rx + 3.5, 32);
        ctx.stroke();
      }
      // realce claro na borda externa dos montantes
      ctx.fillStyle = 'rgba(214,168,110,0.35)';
      ctx.fillRect(railL, 0, 1, 32);
      ctx.fillRect(railR + railW - 1, 0, 1, 32);
      // degraus com sombra por baixo
      for (let y = 4; y < 32; y += 8) {
        ctx.fillStyle = '#3f2810';
        ctx.fillRect(4, y + 2, 24, 2);
        ctx.fillStyle = '#5b3a1e';
        ctx.fillRect(4, y, 24, 3);
        ctx.fillStyle = 'rgba(214,168,110,0.4)';
        ctx.fillRect(4, y, 24, 1);
      }
      // braçadeiras metálicas a cada 16px
      ctx.fillStyle = '#8890b0';
      ctx.fillRect(railL - 1, 0, railW + 2, 2);
      ctx.fillRect(railR - 1, 0, railW + 2, 2);
      ctx.fillRect(railL - 1, 16, railW + 2, 2);
      ctx.fillRect(railR - 1, 16, railW + 2, 2);
      tex.refresh();
    }
    // pedestal da vela — base e capitel moldurados, fuste caneleado, anel dourado
    {
      const { tex, ctx } = this.ctxOf('pedestal', 48, 36);
      // capitel
      ctx.fillStyle = '#666fa0';
      ctx.fillRect(6, 0, 36, 5);
      ctx.fillStyle = '#454c76';
      ctx.fillRect(9, 5, 30, 3);
      // fuste caneleado
      ctx.fillStyle = '#3d4463';
      ctx.fillRect(14, 8, 20, 20);
      ctx.strokeStyle = 'rgba(20,24,44,0.5)';
      ctx.lineWidth = 1;
      for (let x = 17; x < 32; x += 4) {
        ctx.beginPath();
        ctx.moveTo(x, 9);
        ctx.lineTo(x, 27);
        ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(174,184,232,0.2)';
      for (let x = 15; x < 32; x += 4) {
        ctx.beginPath();
        ctx.moveTo(x, 9);
        ctx.lineTo(x, 27);
        ctx.stroke();
      }
      // anel dourado
      ctx.fillStyle = '#d9a441';
      ctx.fillRect(13, 15, 22, 3);
      ctx.fillStyle = '#fff0b8';
      ctx.fillRect(13, 15, 22, 1);
      // pequeno arco entalhado
      ctx.strokeStyle = 'rgba(217,164,65,0.5)';
      ctx.beginPath();
      ctx.arc(24, 24, 5, Math.PI, 0);
      ctx.stroke();
      // base moldurada
      ctx.fillStyle = '#454c76';
      ctx.fillRect(8, 28, 32, 3);
      ctx.fillStyle = '#666fa0';
      ctx.fillRect(5, 31, 38, 5);
      // sombra própria
      ctx.fillStyle = 'rgba(6,10,22,0.35)';
      ctx.beginPath();
      ctx.ellipse(24, 35, 20, 2.4, 0, 0, Math.PI * 2);
      ctx.fill();
      tex.refresh();
    }
    // tocha de parede
    {
      const draw = (key: string, offset: number) => {
        const { tex, ctx } = this.ctxOf(key, 16, 26);
        ctx.fillStyle = '#454c76';
        ctx.fillRect(6, 16, 4, 8);
        ctx.fillStyle = '#5b3a1e';
        ctx.fillRect(5, 12, 6, 6);
        ctx.fillStyle = '#ff8a3c';
        ctx.beginPath();
        ctx.ellipse(8, 8 - offset, 3.4, 6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffc24d';
        ctx.beginPath();
        ctx.ellipse(8, 9 - offset, 2.2, 4.4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff0b8';
        ctx.beginPath();
        ctx.ellipse(8, 10 - offset, 1.2, 2.6, 0, 0, Math.PI * 2);
        ctx.fill();
        tex.refresh();
      };
      draw('torch-flame-0', 0);
      draw('torch-flame-1', 1.4);
    }
    // vinheta — escurece as bordas da tela
    {
      const { tex, ctx } = this.ctxOf('vignette', GAME_WIDTH, GAME_HEIGHT);
      const g = ctx.createRadialGradient(
        GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_HEIGHT * 0.35,
        GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_HEIGHT * 0.75
      );
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, 'rgba(0,0,0,0.55)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
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
      const core = ctx.createRadialGradient(36, 60, 2, 36, 60, 40);
      core.addColorStop(0, 'rgba(255,240,184,0.55)');
      core.addColorStop(1, 'rgba(255,240,184,0)');
      ctx.fillStyle = core;
      ctx.fillRect(0, 0, 72, 120);
      ctx.strokeStyle = '#ffc24d';
      ctx.lineWidth = 2;
      for (let y = 6; y < 120; y += 14) {
        ctx.beginPath();
        ctx.moveTo(8, y);
        ctx.lineTo(64, y);
        ctx.stroke();
      }
      // runas simples
      ctx.strokeStyle = 'rgba(255,240,184,0.7)';
      ctx.lineWidth = 1;
      for (let y = 12; y < 112; y += 28) {
        ctx.beginPath();
        ctx.moveTo(20, y);
        ctx.lineTo(28, y + 8);
        ctx.moveTo(28, y);
        ctx.lineTo(20, y + 8);
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

  // ------------------------------------------------------------- estrelas
  /**
   * Estrela de conquista em dois estados: `star-on` (dourada, com um brilho
   * fosco no meio) e `star-off` (só o contorno, o lugar vago da vitrine).
   */
  private makeStars() {
    const S = 40;
    const path = (ctx: CanvasRenderingContext2D) => {
      const cx = S / 2;
      const cy = S / 2 + 1;
      const outer = S / 2 - 3;
      const inner = outer * 0.45;
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const r = i % 2 === 0 ? outer : inner;
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        const x = cx + Math.cos(a) * r;
        const y = cy + Math.sin(a) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
    };

    {
      const { tex, ctx } = this.ctxOf('star-on', S, S);
      const grad = ctx.createLinearGradient(0, 0, 0, S);
      grad.addColorStop(0, '#fff0b8');
      grad.addColorStop(0.55, '#ffc24d');
      grad.addColorStop(1, '#d9a441');
      path(ctx);
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.strokeStyle = '#7a5227';
      ctx.lineWidth = 2;
      ctx.stroke();
      tex.refresh();
    }
    {
      const { tex, ctx } = this.ctxOf('star-off', S, S);
      path(ctx);
      ctx.fillStyle = 'rgba(10,13,32,0.55)';
      ctx.fill();
      ctx.strokeStyle = '#3a4472';
      ctx.lineWidth = 2;
      ctx.stroke();
      tex.refresh();
    }
  }

  // ---------------------------------------------------------------- cavaleiro
  private makeKnight() {
    const FW = 20;
    const FH = 28;
    type Rect = [x: number, y: number, w: number, h: number, cor: string];

    const steel = '#aeb8e8';
    const steelD = '#767ea8';
    const plume = '#a53434';
    const gold = '#d9a441';
    const shadow = '#2a2f45';
    const visor = '#1d2136';

    // pluma, elmo, viseira, torso e detalhe dourado — comum a todas as poses
    // (dy = deslocamento vertical do corpo ao ajoelhar)
    const base = (dy: number): Rect[] => [
      [9, 0 + dy, 3, 4, plume],
      [6, 3 + dy, 9, 6, steel],
      [7, 5 + dy, 7, 2, visor],
      [5, 9 + dy, 11, 9, steelD],
      [9, 10 + dy, 3, 7, gold]
    ];
    const arms = (dy: number): Record<string, Rect[]> => ({
      climb0: [[3, 6 + dy, 3, 8, steel], [15, 11 + dy, 3, 8, steel]],
      climb1: [[3, 11 + dy, 3, 8, steel], [15, 6 + dy, 3, 8, steel]],
      jump: [[2, 8, 3, 6, steel], [16, 8, 3, 6, steel]],
      default: [[3, 10 + dy, 3, 8, steel], [15, 10 + dy, 3, 8, steel]]
    });
    const legs: Record<string, Rect[]> = {
      kneel: [[6, 21, 4, 4, steelD], [12, 18, 4, 8, steelD], [4, 25, 8, 3, shadow]],
      walk0: [[6, 18, 4, 10, steelD], [12, 18, 4, 8, steelD]],
      walk1: [[5, 18, 4, 9, steelD], [13, 18, 4, 10, steelD]],
      walk2: [[7, 18, 4, 8, steelD], [11, 18, 4, 10, steelD]],
      walk3: [[6, 18, 4, 10, steelD], [12, 18, 4, 9, steelD]],
      jump: [[6, 18, 4, 7, steelD], [12, 18, 4, 7, steelD]],
      default: [[7, 18, 4, 10, steelD], [11, 18, 4, 10, steelD]]
    };

    const frames = ['idle', 'walk0', 'walk1', 'walk2', 'walk3', 'jump', 'climb0', 'climb1', 'kneel'];
    const { tex, ctx } = this.ctxOf('knight-sheet', FW * frames.length, FH);

    frames.forEach((pose, i) => {
      const ox = i * FW;
      const dy = pose === 'kneel' ? 5 : 0;
      const a = arms(dy);
      const rects = [...base(dy), ...(a[pose] ?? a.default), ...(legs[pose] ?? legs.default)];
      for (const [x, y, w, h, cor] of rects) {
        ctx.fillStyle = cor;
        ctx.fillRect(ox + x, y, w, h);
      }
    });
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

  // ------------------------------------------------------------------ glow
  /** Textura radial branca genérica, para uso com blendMode ADD (tochas, halos, luar). */
  private makeGlow() {
    const { tex, ctx } = this.ctxOf('glow', 64, 64);
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,0.9)');
    g.addColorStop(0.4, 'rgba(255,255,255,0.35)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    tex.refresh();
  }

  // ---------------------------------------------------------------- vitrola
  private makeVitrola() {
    // caixa de madeira com corneta dourada
    {
      const { tex, ctx } = this.ctxOf('vitrola', 56, 44);
      // caixa
      ctx.fillStyle = '#5b3a1e';
      ctx.fillRect(6, 28, 44, 14);
      ctx.fillStyle = '#7a5227';
      ctx.fillRect(6, 26, 44, 4);
      ctx.fillStyle = '#3d2712';
      ctx.fillRect(6, 40, 44, 2);
      // frisos
      ctx.fillStyle = '#d9a441';
      ctx.fillRect(8, 33, 40, 1);
      // corneta (abre para cima e para a esquerda)
      ctx.fillStyle = '#d9a441';
      ctx.beginPath();
      ctx.moveTo(34, 27);
      ctx.quadraticCurveTo(30, 16, 14, 8);
      ctx.lineTo(8, 2);
      ctx.lineTo(28, 2);
      ctx.quadraticCurveTo(36, 12, 38, 26);
      ctx.closePath();
      ctx.fill();
      // boca da corneta
      ctx.fillStyle = '#ffc24d';
      ctx.beginPath();
      ctx.ellipse(18, 5, 11, 4, -0.35, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#7a5227';
      ctx.beginPath();
      ctx.ellipse(18, 5, 6, 2, -0.35, 0, Math.PI * 2);
      ctx.fill();
      // manivela
      ctx.fillStyle = '#aeb8e8';
      ctx.fillRect(50, 31, 4, 2);
      ctx.fillRect(52, 27, 2, 5);
      tex.refresh();
    }
    // disco (gira quando a música toca)
    {
      const { tex, ctx } = this.ctxOf('vitrola-disc', 20, 20);
      ctx.fillStyle = '#1d2136';
      ctx.beginPath();
      ctx.arc(10, 10, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#2a2f45';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(10, 10, 6.5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#d9a441';
      ctx.beginPath();
      ctx.arc(10, 10, 2.6, 0, Math.PI * 2);
      ctx.fill();
      // marcador para a rotação ser perceptível
      ctx.fillStyle = '#f3e6c4';
      ctx.fillRect(15, 9, 2, 2);
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
    this.anims.create({
      key: 'torch-flame',
      frames: [{ key: 'torch-flame-0' }, { key: 'torch-flame-1' }],
      frameRate: 6,
      repeat: -1
    });
  }
}
