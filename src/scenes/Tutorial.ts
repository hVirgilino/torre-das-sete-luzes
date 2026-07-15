import Phaser from 'phaser';
import { FONTS, GAME_HEIGHT, GAME_WIDTH, LOCKS_PER_FLOOR } from '../data/config';
import { State } from '../systems/state';
import { makeButton, fadeIn, fadeOut } from '../systems/ui';
import { initSceneView, uiPx } from '../systems/display';

const isTouch = () => window.matchMedia('(pointer: coarse)').matches;

export class TutorialScene extends Phaser.Scene {
  private page = 0;
  private title!: Phaser.GameObjects.Text;
  private body!: Phaser.GameObjects.Text;
  private nextBtn!: Phaser.GameObjects.Text;

  constructor() {
    super('Tutorial');
  }

  private pages(): Array<{ t: string; b: string }> {
    const move = isTouch()
      ? 'Use os botões ◀ ▶ para andar, ⬆ para pular e subir escadas, e toque em ✦ para interagir.'
      : 'Use as SETAS ou WASD para andar e subir escadas, ESPAÇO para pular e E para interagir.';
    return [
      {
        t: 'A Queda',
        b:
          'A explosão o lançou à base da Torre das Sete Luzes. Este é o último teste de Merlin: ' +
          'provar que os ensinamentos da Ordem vivem em você.\n\nSuba os sete andares da torre. ' +
          'Em cada andar repousa uma vela apagada, protegida por trancas místicas.'
      },
      {
        t: 'Movimentação',
        b:
          move +
          '\n\nOs andares são livres: você pode enfrentar as velas em qualquer ordem. ' +
          'Mas o 8º andar, onde o Rei aguarda, só se abre com as sete velas acesas.'
      },
      {
        t: 'O Combate',
        b:
          'Aproxime-se de uma vela e interaja para enfrentar suas trancas.\n\n' +
          'Trechos da Cerimônia da Luz surgirão com palavras faltando. Escolha a alternativa que ' +
          'preenche a lacuna corretamente.\n\nCada acerto quebra uma tranca. ' +
          `Errar — ou deixar o tempo acabar — restaura TODAS as trancas daquela vela. ` +
          `As velas têm de ${Math.min(...LOCKS_PER_FLOOR)} a ${Math.max(...LOCKS_PER_FLOOR)} trancas — quanto mais alto o andar, mais trancas.`
      },
      {
        t: 'As Habilidades',
        b:
          'Cada vela acesa concede uma habilidade, usada durante o combate ' +
          (isTouch() ? 'tocando no ícone da vela.' : 'pressionando as teclas 1 a 7.') +
          '\n\nMas toda luz tem um preço: usar a habilidade de uma vela a apaga e devolve uma tranca. ' +
          'Você precisará voltar e enfrentá-la de novo.\n\nQuanto mais alta a vela, maior o poder.'
      },
      {
        t: 'Prove-se',
        b: 'Antes de subir, Merlin propõe uma questão de treino. Ela não tem consequências.\n\nBoa sorte, ' +
          `Sir ${State.save?.playerName ?? ''}. Que as sete luzes iluminem seu caminho.`
      }
    ];
  }

  create() {
    initSceneView(this);
    this.cameras.main.setBackgroundColor(0x060a1c);
    fadeIn(this, 500);

    // vela solitária iluminando o tutorial
    const candle = this.add.sprite(GAME_WIDTH / 2, 96, 'candle-lit-0').setScale(2.2);
    candle.play('candle-flame');

    this.title = this.add
      .text(GAME_WIDTH / 2, 150, '', { fontFamily: FONTS.display, fontSize: uiPx(30), color: '#ffc24d' })
      .setOrigin(0.5);
    this.body = this.add
      .text(GAME_WIDTH / 2, 300, '', {
        fontFamily: FONTS.body,
        fontSize: uiPx(21),
        color: '#f3e6c4',
        align: 'center',
        wordWrap: { width: 700 },
        lineSpacing: 6
      })
      .setOrigin(0.5);

    this.nextBtn = makeButton(this, GAME_WIDTH / 2, GAME_HEIGHT - 56, 'Continuar ›', () => this.next(), 22);
    this.render();
  }

  private render() {
    const p = this.pages()[this.page];
    this.title.setText(p.t);
    this.body.setText(p.b);
    this.nextBtn.setText(this.page === this.pages().length - 1 ? 'Treinar ✦' : 'Continuar ›');
  }

  private async next() {
    this.page++;
    if (this.page < this.pages().length) {
      this.render();
      return;
    }
    await fadeOut(this, 400);
    this.scene.start('Tower', { practiceFirst: true });
  }
}
