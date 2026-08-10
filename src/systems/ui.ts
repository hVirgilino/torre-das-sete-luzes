import Phaser from 'phaser';
import {
  DIFFICULTIES, FONTS, GAME_HEIGHT, GAME_WIDTH, MAX_ESTRELAS, type DifficultyId
} from '../data/config';
import { Audio } from './audio';
import { uiPx } from './display';

/**
 * Vitrine de estrelas de conquista: sempre MAX_ESTRELAS lugares, os primeiros
 * `earned` acesos. Os lugares vazios ficam à vista de propósito — é o que
 * mostra ao jogador que ainda há dificuldade por vencer.
 *
 * O container guarda as imagens na ordem, para quem chamou poder animar
 * individualmente as estrelas recém-conquistadas.
 */
export type EstiloEstrela = 'padrao' | 'lenda' | 'platina' | 'bronze';

/** posição no ranking global → estilo da estrela; fora do pódio é o dourado normal */
export function estiloPorPosicao(posicao: number | null | undefined): EstiloEstrela {
  if (posicao === 1) return 'lenda';
  if (posicao === 2) return 'platina';
  if (posicao === 3) return 'bronze';
  return 'padrao';
}

const TEXTURA_PODIO: Record<Exclude<EstiloEstrela, 'padrao'>, string> = {
  lenda: 'star-lenda',
  platina: 'star-platina',
  bronze: 'star-bronze'
};

/**
 * @param estilos brilho de cada posição da vitrine. Cada estrela representa uma
 *   dificuldade, e o estilo dela vem da colocação do jogador **naquela**
 *   dificuldade — três lendárias significam três primeiros lugares distintos.
 */
export function makeStarRow(
  scene: Phaser.Scene,
  x: number,
  y: number,
  earned: number,
  scale = 1,
  estilos: EstiloEstrela[] = [],
  orientacao: 'horizontal' | 'vertical' = 'horizontal'
): { container: Phaser.GameObjects.Container; stars: Phaser.GameObjects.Sprite[] } {
  const gap = 46 * scale;
  const stars: Phaser.GameObjects.Sprite[] = [];
  for (let i = 0; i < MAX_ESTRELAS; i++) {
    const on = i < earned;
    const desloc = (i - (MAX_ESTRELAS - 1) / 2) * gap;
    const sp = scene.add
      .sprite(
        orientacao === 'vertical' ? 0 : desloc,
        orientacao === 'vertical' ? desloc : 0,
        on ? 'star-on' : 'star-off'
      )
      .setScale(scale);
    // o brilho de pódio só vale para estrela já conquistada: o lugar vazio
    // continua apagado, senão a vitrine mentiria sobre o que falta vencer
    const estilo = estilos[i] ?? 'padrao';
    if (on && estilo !== 'padrao') aplicarEstiloEstrela(sp, estilo, i);
    stars.push(sp);
  }
  return { container: scene.add.container(x, y, stars), stars };
}

/**
 * Dificuldade de cada posição da vitrine, deduzida do próprio catálogo: a
 * estrela `i` pertence à dificuldade que concede `i + 1` estrelas. Assim a
 * ordem nunca sai de sincronia com DIFFICULTIES.
 */
export function dificuldadeDaEstrela(indice: number): DifficultyId | undefined {
  return DIFFICULTIES.find((d) => d.estrelas === indice + 1)?.id;
}

/** Troca uma estrela já acesa pelo brilho de pódio, com defasagem entre elas. */
export function aplicarEstiloEstrela(
  sp: Phaser.GameObjects.Sprite,
  estilo: EstiloEstrela,
  indice = 0
) {
  if (estilo === 'padrao') {
    sp.stop();
    sp.setTexture('star-on');
    return;
  }
  const chave = TEXTURA_PODIO[estilo];
  sp.setTexture(chave, '0');
  sp.play({ key: `${chave}-brilho`, delay: indice * 140 }, true);
}

/** Botão de texto medieval com hover/tap */
export function makeButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  label: string,
  onClick: () => void,
  size = 26
): Phaser.GameObjects.Text {
  const btn = scene.add
    .text(x, y, label, {
      fontFamily: FONTS.display,
      fontSize: uiPx(size),
      color: '#f3e6c4',
      stroke: '#2c1c08',
      strokeThickness: 5
    })
    .setOrigin(0.5)
    .setInteractive({ useHandCursor: true });

  btn.on('pointerover', () => {
    btn.setColor('#ffc24d');
    btn.setScale(1.06);
    Audio.select();
  });
  btn.on('pointerout', () => {
    btn.setColor('#f3e6c4');
    btn.setScale(1);
  });
  btn.on('pointerdown', () => {
    Audio.unlock();
    Audio.confirm();
    onClick();
  });
  return btn;
}

/** Slider horizontal arrastável (0–1) */
export function makeSlider(
  scene: Phaser.Scene,
  x: number,
  y: number,
  width: number,
  value: number,
  onChange: (v: number) => void
): Phaser.GameObjects.Container {
  const track = scene.add.image(0, 0, 'px').setDisplaySize(width, 6).setTint(0x2c1c08);
  const fill = scene.add
    .image(-width / 2, 0, 'px')
    .setOrigin(0, 0.5)
    .setDisplaySize(width * value, 6)
    .setTint(0xd9a441);
  const knob = scene.add
    .image(-width / 2 + width * value, 0, 'px')
    .setDisplaySize(16, 22)
    .setTint(0xf3e6c4);
  const c = scene.add.container(x, y, [track, fill, knob]);
  c.setSize(width + 20, 30);
  c.setInteractive({ useHandCursor: true, draggable: true });

  const apply = (pointerX: number) => {
    const local = Phaser.Math.Clamp(pointerX - (x - width / 2), 0, width);
    const v = local / width;
    fill.setDisplaySize(Math.max(1, width * v), 6);
    knob.x = -width / 2 + width * v;
    onChange(v);
  };
  // worldX (não x) para continuar correto sob o zoom de câmera das resoluções maiores
  c.on('pointerdown', (p: Phaser.Input.Pointer) => apply(p.worldX));
  c.on('drag', (p: Phaser.Input.Pointer) => apply(p.worldX));
  return c;
}

export interface DialogLine {
  speaker?: string;
  text: string;
}

/**
 * Caixa de diálogo de cutscene com efeito de máquina de escrever.
 * Avança por clique/tap/espaço; resolve a Promise ao terminar todas as falas.
 */
export class Dialog {
  private scene: Phaser.Scene;
  private box!: Phaser.GameObjects.Container;
  private nameText!: Phaser.GameObjects.Text;
  private bodyText!: Phaser.GameObjects.Text;
  private hint!: Phaser.GameObjects.Text;
  private typing = false;
  private full = '';
  private timer?: Phaser.Time.TimerEvent;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    // coordenadas de mundo (960×540) — não do backing store do canvas
    const W = GAME_WIDTH;
    const H = GAME_HEIGHT;
    const bg = scene.add.image(0, 0, 'px').setDisplaySize(W - 80, 120).setTint(0x0b0e20).setAlpha(0.92);
    const border = scene.add
      .image(0, 0, 'px')
      .setDisplaySize(W - 76, 124)
      .setTint(0xd9a441)
      .setAlpha(0.9);
    border.setDepth(-1);
    this.nameText = scene.add.text(-(W - 80) / 2 + 18, -46, '', {
      fontFamily: FONTS.display,
      fontSize: uiPx(18),
      color: '#ffc24d'
    });
    this.bodyText = scene.add.text(-(W - 80) / 2 + 18, -20, '', {
      fontFamily: FONTS.body,
      fontSize: uiPx(20),
      color: '#f3e6c4',
      wordWrap: { width: W - 120 }
    });
    this.hint = scene.add
      .text((W - 80) / 2 - 16, 42, '▼ continuar', {
        fontFamily: FONTS.body,
        fontSize: uiPx(14),
        color: '#aeb8e8'
      })
      .setOrigin(1, 0.5)
      .setAlpha(0);
    this.box = scene.add.container(W / 2, H - 80, [border, bg, this.nameText, this.bodyText, this.hint]);
    this.box.setDepth(1000).setVisible(false);
  }

  async play(lines: DialogLine[]): Promise<void> {
    this.box.setVisible(true);
    for (const line of lines) {
      await this.showLine(line);
    }
    this.box.setVisible(false);
  }

  private showLine(line: DialogLine): Promise<void> {
    return new Promise((resolve) => {
      this.nameText.setText(line.speaker ?? '');
      this.bodyText.setText('');
      this.hint.setAlpha(0);
      this.full = line.text;
      this.typing = true;
      let i = 0;
      this.timer?.remove();
      this.timer = this.scene.time.addEvent({
        delay: 24,
        repeat: this.full.length - 1,
        callback: () => {
          i++;
          this.bodyText.setText(this.full.slice(0, i));
          if (i >= this.full.length) {
            this.typing = false;
            this.hint.setAlpha(1);
          }
        }
      });

      const advance = () => {
        if (this.typing) {
          // completa a linha instantaneamente
          this.timer?.remove();
          this.bodyText.setText(this.full);
          this.typing = false;
          this.hint.setAlpha(1);
        } else {
          cleanup();
          resolve();
        }
      };
      const onKey = (e: KeyboardEvent) => {
        if (e.code === 'Space' || e.code === 'Enter') advance();
      };
      const cleanup = () => {
        this.scene.input.off('pointerdown', advance);
        this.scene.input.keyboard?.off('keydown', onKey as any);
      };
      this.scene.input.on('pointerdown', advance);
      this.scene.input.keyboard?.on('keydown', onKey as any);
    });
  }

  destroy() {
    this.timer?.remove();
    this.box.destroy();
  }
}

/** utilitário: fade helper que resolve Promise */
export function fadeOut(scene: Phaser.Scene, ms = 600): Promise<void> {
  return new Promise((r) => {
    scene.cameras.main.fadeOut(ms, 4, 6, 18);
    scene.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => r());
  });
}
export function fadeIn(scene: Phaser.Scene, ms = 600) {
  scene.cameras.main.fadeIn(ms, 4, 6, 18);
}
export function wait(scene: Phaser.Scene, ms: number): Promise<void> {
  return new Promise((r) => scene.time.delayedCall(ms, r));
}
