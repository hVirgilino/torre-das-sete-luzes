import Phaser from 'phaser';
import { FONTS, GAME_HEIGHT, GAME_WIDTH, dificuldadePorId } from '../data/config';
import {
  Api, DIFICULDADES_RANQUEAVEIS, entradasPublicadas, type EntradaRanking
} from '../systems/api';
import { formatClock } from '../systems/state';
import { fadeOut, makeButton } from '../systems/ui';
import { initSceneView, uiPx } from '../systems/display';

/** Escudeiro fica de fora: é o modo de aprendizado, não de disputa. */
const ABAS = DIFICULDADES_RANQUEAVEIS.map((id) => dificuldadePorId(id)!);

/** cor da linha por colocação — combina com as estrelas de pódio */
const COR_POSICAO = ['#ffe9a8', '#dfe7ff', '#ffbf7a'];

export class RankingScene extends Phaser.Scene {
  private dificuldadeAtual = 0;
  private corpo: Phaser.GameObjects.GameObject[] = [];
  private aviso!: Phaser.GameObjects.Text;
  private meusIds = new Set<string>();

  constructor() {
    super('Ranking');
  }

  create() {
    initSceneView(this);
    this.cameras.main.setBackgroundColor(0x060a1c);
    this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'bg-throne').setAlpha(0.28);
    this.cameras.main.fadeIn(400, 4, 6, 18);
    this.corpo = [];
    this.meusIds = new Set(entradasPublicadas().map((e) => e.id));

    this.add
      .text(GAME_WIDTH / 2, 46, 'RANKING GLOBAL', {
        fontFamily: FONTS.display, fontSize: uiPx(30), fontStyle: 'bold',
        color: '#ffc24d', stroke: '#2c1c08', strokeThickness: 8
      })
      .setOrigin(0.5);

    // abas de dificuldade
    ABAS.forEach((d, i) => {
      const x = GAME_WIDTH / 2 + (i - (ABAS.length - 1) / 2) * 170;
      const aba = this.add
        .text(x, 92, d.nome, {
          fontFamily: FONTS.display, fontSize: uiPx(17), color: '#aeb8e8'
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => {
          this.dificuldadeAtual = i;
          this.pintarAbas();
          this.carregar();
        });
      aba.setData('indice', i);
      this.corpo.push(aba);
    });

    this.aviso = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'Consultando os arautos...', {
        fontFamily: FONTS.body, fontSize: uiPx(18), color: '#aeb8e8', align: 'center'
      })
      .setOrigin(0.5);

    makeButton(this, GAME_WIDTH / 2, GAME_HEIGHT - 40, 'Voltar', async () => {
      await fadeOut(this, 350);
      this.scene.start('Menu');
    }, 20);

    this.pintarAbas();
    this.carregar();
  }

  private pintarAbas() {
    for (const obj of this.corpo) {
      const texto = obj as Phaser.GameObjects.Text;
      if (texto.getData?.('indice') === undefined) continue;
      const ativo = texto.getData('indice') === this.dificuldadeAtual;
      texto.setColor(ativo ? '#ffc24d' : '#aeb8e8').setScale(ativo ? 1.1 : 1);
    }
  }

  private limparLinhas() {
    for (const obj of [...this.corpo]) {
      if ((obj as Phaser.GameObjects.Text).getData?.('linha')) {
        obj.destroy();
        this.corpo.splice(this.corpo.indexOf(obj), 1);
      }
    }
  }

  private async carregar() {
    const dif = ABAS[this.dificuldadeAtual];
    this.limparLinhas();
    this.aviso.setText('Consultando os arautos...').setVisible(true);

    try {
      const { ranking } = await Api.ranking(dif.id, 12);
      if (!this.scene.isActive()) return;
      const linhas = ranking[dif.id] ?? [];
      if (!linhas.length) {
        this.aviso.setText(`Ninguém venceu a Torre no modo ${dif.nome} ainda.\nSede o primeiro.`);
        return;
      }
      this.aviso.setVisible(false);
      linhas.forEach((linha, i) => this.desenharLinha(linha, i));
    } catch {
      if (!this.scene.isActive()) return;
      // sem API (rodando local sem `vercel dev`, ou fora do ar) a tela explica
      // em vez de ficar girando para sempre
      this.aviso.setText(
        'Não foi possível falar com o servidor do ranking.\nO jogo segue normal — só a classificação está fora de alcance.'
      );
    }
  }

  private desenharLinha(linha: EntradaRanking, i: number) {
    const y = 138 + i * 30;
    const meu = this.meusIds.has(linha.id);
    const cor = COR_POSICAO[linha.posicao - 1] ?? (meu ? '#ffc24d' : '#f3e6c4');

    const fundo = this.add
      .image(GAME_WIDTH / 2, y, 'px')
      .setDisplaySize(680, 26)
      .setTint(meu ? 0x2a2f45 : 0x14182e)
      .setAlpha(meu ? 0.9 : 0.45);
    fundo.setData('linha', true);
    this.corpo.push(fundo);

    const campo = (x: number, texto: string, origem: number, tamanho: number, corTexto: string) => {
      const t = this.add
        .text(x, y, texto, { fontFamily: FONTS.body, fontSize: uiPx(tamanho), color: corTexto })
        .setOrigin(origem, 0.5);
      t.setData('linha', true);
      this.corpo.push(t);
      return t;
    };

    const esq = GAME_WIDTH / 2 - 330;
    campo(esq + 6, `${linha.posicao}º`, 0, 15, cor);
    campo(esq + 52, linha.nome, 0, 16, cor);
    if (linha.capitulo) campo(esq + 230, linha.capitulo, 0, 13, '#8890b8');
    campo(GAME_WIDTH / 2 + 330 - 6, formatClock(linha.duracaoMs), 1, 16, cor);
  }
}
