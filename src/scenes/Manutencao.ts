import Phaser from 'phaser';
import { FONTS, GAME_HEIGHT, GAME_WIDTH } from '../data/config';
import { initSceneView, uiPx } from '../systems/display';

/** marca de que este navegador já atravessou a manutenção */
export const CHAVE_LIBERADO = 'cerimonia-da-luz:manutencao-liberada:v1';

/** Tamanho da sequência que dispara a conferência automática. */
const TAMANHO_SEQUENCIA = 12;

/** true se o jogador já digitou a sequência alguma vez neste navegador */
export function manutencaoLiberada(): boolean {
  try {
    return localStorage.getItem(CHAVE_LIBERADO) === '1';
  } catch {
    return false;
  }
}

/**
 * Tela de manutenção — substitui o menu enquanto o jogo está fora do ar.
 *
 * Não altera regra nenhuma do jogo: só troca a cena que o Boot abre no fim.
 * Para devolver o jogo ao ar para todos, o Boot volta a abrir 'Menu'.
 *
 * O cavaleiro anda e salta em laço, sem física: uma travessia por tween e dois
 * arcos de salto por volta. Arcade Physics aqui só traria corpo, colisão e
 * gravidade para nada.
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
    this.escutarSequencia();
  }

  /**
   * Sequência secreta para atravessar a manutenção.
   *
   * As teclas vão para um buffer invisível. Quando ele chega ao tamanho
   * esperado, a sequência é enviada ao servidor — que tem o scrypt e o rate
   * limit. Enter envia antes da hora, para senha de outro tamanho.
   *
   * Isto é uma tranca social, não uma fronteira de segurança: quem abre o
   * devtools passa de qualquer jeito. O que importa é que a senha nunca está
   * no bundle para ser lida.
   */
  private escutarSequencia() {
    const TAMANHO = TAMANHO_SEQUENCIA;
    let buffer = '';
    let verificando = false;

    const pista = this.add
      .text(GAME_WIDTH - 16, GAME_HEIGHT - 14, '', {
        fontFamily: FONTS.body,
        fontSize: uiPx(13),
        color: '#3a4472'
      })
      .setOrigin(1, 1);

    const enviar = async () => {
      if (verificando || !buffer) return;
      verificando = true;
      const tentativa = buffer;
      buffer = '';
      pista.setText('conferindo...');
      try {
        const resp = await fetch('/api/manutencao', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ senha: tentativa })
        });
        if (resp.ok) {
          try {
            localStorage.setItem(CHAVE_LIBERADO, '1');
          } catch {
            /* sem storage: libera só esta sessão */
          }
          pista.setText('');
          this.cameras.main.fadeOut(500, 4, 6, 18);
          this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Menu'));
          return;
        }
        pista.setText(resp.status === 429 ? 'aguarde um pouco' : '✕');
      } catch {
        pista.setText('sem conexão');
      } finally {
        verificando = false;
        this.time.delayedCall(1600, () => pista.setText(''));
      }
    };

    this.input.keyboard?.on('keydown', (e: KeyboardEvent) => {
      if (verificando) return;
      if (e.key === 'Enter') return void enviar();
      if (e.key === 'Backspace') {
        buffer = buffer.slice(0, -1);
      } else if (e.key.length === 1) {
        buffer += e.key;
      } else {
        return;
      }
      // um ponto por tecla: dá retorno de que está registrando, sem mostrar nada
      pista.setText('·'.repeat(Math.min(buffer.length, TAMANHO)));
      if (buffer.length >= TAMANHO) void enviar();
    });
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
