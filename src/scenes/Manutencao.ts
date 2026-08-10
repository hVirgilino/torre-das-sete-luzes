import Phaser from 'phaser';
import { FONTS, GAME_HEIGHT, GAME_WIDTH } from '../data/config';
import { initSceneView, uiPx } from '../systems/display';

/**
 * Tela de manutenção — substitui o menu enquanto o jogo está fora do ar.
 *
 * Para voltar ao normal basta reverter o commit que a introduziu: ela não
 * altera regra nenhuma do jogo, só troca a cena que o Boot abre no fim.
 *
 * O cavaleiro anda e salta em laço, sem física: uma travessia por tween e um
 * arco de salto disparado a cada volta. Arcade Physics aqui só traria corpo,
 * colisão e gravidade para nada.
 */
export class ManutencaoScene extends Phaser.Scene {
  constructor() {
    super('Manutencao');
  }

  create() {
    initSceneView(this);
    this.cameras.main.setBackgroundColor(0x0b1026);
    this.cameras.main.fadeIn(600, 4, 6, 18);

    const chaoY = GAME_HEIGHT - 120;

    this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'bg-castle').setAlpha(0.35);
    this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'vignette').setAlpha(0.5);

    // piso onde o cavaleiro caminha
    this.add.tileSprite(GAME_WIDTH / 2, chaoY + 12, GAME_WIDTH, 24, 'floor');

    // tochas nas pontas, para a cena não ficar morta
    for (const x of [140, GAME_WIDTH - 140]) {
      const tocha = this.add.sprite(x, chaoY - 120, 'torch-flame-0').setScale(1.6);
      tocha.play({ key: 'torch-flame', delay: x % 300 });
      const halo = this.add
        .image(x, chaoY - 124, 'glow')
        .setBlendMode(Phaser.BlendModes.ADD)
        .setTint(0xff8a3c)
        .setScale(0.7)
        .setAlpha(0.5);
      this.tweens.add({
        targets: halo,
        alpha: { from: 0.35, to: 0.7 },
        scale: { from: 0.6, to: 0.85 },
        duration: 600 + Math.random() * 400,
        yoyo: true,
        repeat: -1,
        ease: 'sine.inout'
      });
    }

    this.add.particles(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'spark', {
      x: { min: 0, max: GAME_WIDTH },
      y: { min: 0, max: GAME_HEIGHT },
      speedY: { min: -6, max: -2 },
      lifespan: 6000,
      frequency: 300,
      alpha: { start: 0.12, end: 0 },
      scale: { start: 0.6, end: 1.2 },
      tint: 0x8890b8
    });

    // ------------------------------------------------------------- recado
    this.add
      .text(GAME_WIDTH / 2, 150, 'Jogo em manutenção', {
        fontFamily: FONTS.display,
        fontSize: uiPx(44),
        fontStyle: 'bold',
        color: '#ffc24d',
        stroke: '#2c1c08',
        strokeThickness: 9
      })
      .setOrigin(0.5);

    const recado = this.add
      .text(GAME_WIDTH / 2, 208, 'A Torre está sendo reerguida. Voltai em breve, Sir.', {
        fontFamily: FONTS.body,
        fontSize: uiPx(20),
        fontStyle: 'italic',
        color: '#dcc494'
      })
      .setOrigin(0.5);
    this.tweens.add({
      targets: recado,
      alpha: { from: 0.55, to: 1 },
      duration: 1800,
      yoyo: true,
      repeat: -1,
      ease: 'sine.inout'
    });

    this.animarCavaleiro(chaoY);
  }

  /** Travessia contínua com um salto no meio do caminho, em laço infinito. */
  private animarCavaleiro(chaoY: number) {
    const cavaleiro = this.add.sprite(-60, chaoY, 'knight-sheet', 'idle').setScale(2.6).setOrigin(0.5, 1);
    cavaleiro.play('knight-walk');

    const inicio = -60;
    const fim = GAME_WIDTH + 60;
    const duracao = 7000;

    const travessia = () => {
      cavaleiro.setPosition(inicio, chaoY);
      cavaleiro.play('knight-walk', true);

      this.tweens.add({
        targets: cavaleiro,
        x: fim,
        duration: duracao,
        ease: 'linear',
        onComplete: travessia
      });

      // dois saltos por travessia, em pontos fixos do percurso
      for (const momento of [0.3, 0.68]) {
        this.time.delayedCall(duracao * momento, () => {
          if (!cavaleiro.active) return;
          cavaleiro.play('knight-jump', true);
          this.tweens.add({
            targets: cavaleiro,
            y: chaoY - 90,
            duration: 380,
            ease: 'quad.out',
            yoyo: true,
            onComplete: () => {
              if (!cavaleiro.active) return;
              cavaleiro.setY(chaoY);
              cavaleiro.play('knight-walk', true);
            }
          });
        });
      }
    };

    travessia();
  }
}
