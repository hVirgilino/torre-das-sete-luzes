import Phaser from 'phaser';
import { FONTS, GAME_HEIGHT, GAME_WIDTH } from '../data/config';
import { Audio } from '../systems/audio';
import { initSceneView, uiPx } from '../systems/display';

/** marca de que este navegador já atravessou a manutenção */
export const CHAVE_LIBERADO = 'cerimonia-da-luz:manutencao-liberada:v1';

/** Dígitos do código do cofre. Ao completar, a conferência dispara sozinha. */
const TAMANHO_CODIGO = 3;

// ------------------------------------------------------- medidas do cofre
/**
 * Meio da faixa livre entre o piso e a borda de baixo da tela: com o chão em
 * GAME_HEIGHT - 220 o piso acaba em 344 e o painel ocupa 356–532, sobrando ~12
 * de respiro dos dois lados. Centralizado em GAME_WIDTH / 2, nunca em 480: a
 * largura lógica varia com a proporção da tela (ver data/config).
 */
const COFRE_Y = 444;
const COFRE_LARG = 320;
const COFRE_ALT = 168;
/** Bloco da esquerda (título + visor + recado), em coordenadas do painel. */
const VISOR_LARG = 140;
const VISOR_X = -COFRE_LARG / 2 + 14 + VISOR_LARG / 2;
/** Teclado 3×4 à direita — passo maior que a tecla para sobrar respiro. */
const TECLA_LARG = 40;
const TECLA_ALT = 32;
const PASSO_X = 46;
const PASSO_Y = 36;
const TECLADO_X = COFRE_LARG / 2 - 16 - (TECLA_LARG + 2 * PASSO_X) / 2;

/** Cor de repouso e de destaque de cada família de tecla. */
const TECLA_NUM = { base: 0x7a5227, hover: 0x9c6c33 };
const TECLA_LIMPAR = { base: 0x7a1f1f, hover: 0xa53434 };
const TECLA_ENVIAR = { base: 0x27408b, hover: 0x3a5cbf };

/** Texto do visor fora de qualquer pedido — serve de instrução. */
const RECADO_REPOUSO = 'toque ou digite o código';

const VISOR_REPOUSO = 0x2c1c08;
const VISOR_CERTO = 0x8fbf6f;
const VISOR_ERRO = 0xa53434;

/** true se o jogador já abriu o cofre alguma vez neste navegador */
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
  /** dígitos já digitados no cofre; nunca passa de TAMANHO_CODIGO */
  private codigo = '';
  /** true enquanto um pedido está no ar — barra digitação e envio duplicado */
  private verificando = false;
  private visorFundo!: Phaser.GameObjects.Image;
  private visorTexto!: Phaser.GameObjects.Text;
  private recadoCofre!: Phaser.GameObjects.Text;
  /**
   * Teclas por rótulo. O teclado físico acende a mesma tecla que o dedo
   * acenderia — sem isso, quem digita no notebook não vê o cofre reagir.
   */
  private teclas = new Map<string, { fundo: Phaser.GameObjects.Image; base: number }>();

  constructor() {
    super('Manutencao');
  }

  create() {
    initSceneView(this);
    this.cameras.main.setBackgroundColor(0x0b1026);
    this.cameras.main.fadeIn(600, 4, 6, 18);

    // a cena pode ser reaberta (voltar do Menu): o estado é de instância, então
    // precisa nascer limpo aqui, e não só na declaração do campo
    this.codigo = '';
    this.verificando = false;
    this.teclas.clear();

    /**
     * O piso sobe bem acima do meio da tela para abrir a faixa de baixo: é ali
     * que o cofre mora, e ele pede ~170px livres entre o piso e a borda. Com o
     * chão no lugar antigo (GAME_HEIGHT - 120) o painel não caberia.
     */
    const chaoY = GAME_HEIGHT - 220;

    this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'bg-castle').setAlpha(0.35);
    this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'vignette').setAlpha(0.5);

    // piso onde o cavaleiro caminha
    this.add.tileSprite(GAME_WIDTH / 2, chaoY + 12, GAME_WIDTH, 24, 'floor');

    // tochas nas pontas, para a cena não ficar morta
    for (const x of [140, GAME_WIDTH - 140]) {
      const tocha = this.add.sprite(x, chaoY - 110, 'torch-flame-0').setScale(1.6);
      tocha.play({ key: 'torch-flame', delay: x % 300 });
      const halo = this.add
        .image(x, chaoY - 114, 'glow')
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
    // título e recado subiram junto com o chão: o ápice do salto do cavaleiro
    // fica em chaoY - 72 (topo do sprite ~175) e não pode encostar neles
    this.add
      .text(GAME_WIDTH / 2, 98, 'Jogo em manutenção', {
        fontFamily: FONTS.display,
        fontSize: uiPx(44),
        fontStyle: 'bold',
        color: '#ffc24d',
        stroke: '#2c1c08',
        strokeThickness: 9
      })
      .setOrigin(0.5);

    const recado = this.add
      .text(GAME_WIDTH / 2, 148, 'A Torre está sendo reerguida. Voltai em breve, Sir.', {
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
    this.montarCofre();
    this.escutarTeclado();
  }

  // ------------------------------------------------------------- o cofre
  /**
   * Fechadura digital que atravessa a manutenção.
   *
   * O código não é conferido aqui: vai para /api/manutencao, que tem o rate
   * limit. Isto é uma tranca social, não uma fronteira de segurança — quem abre
   * o devtools passa de qualquer jeito. O que importa é que o segredo nunca
   * está no bundle para ser lido.
   *
   * Tudo é desenhado com a textura 'px' de 1 pixel esticada e tingida, como o
   * pergaminho do Quiz: nenhum asset novo entra no jogo por causa desta tela.
   */
  private montarCofre() {
    const painel = this.add.container(GAME_WIDTH / 2, COFRE_Y);

    // moldura metálica: sombra, chapa externa e chapa interna rebaixada
    painel.add(
      this.add.image(0, 0, 'px').setDisplaySize(COFRE_LARG + 8, COFRE_ALT + 8).setTint(0x2a2f45)
    );
    painel.add(this.add.image(0, 0, 'px').setDisplaySize(COFRE_LARG, COFRE_ALT).setTint(0x565e85));
    painel.add(
      this.add.image(0, 0, 'px').setDisplaySize(COFRE_LARG - 16, COFRE_ALT - 16).setTint(0x3d4463)
    );
    // rebites dourados nos quatro cantos — o que faz a chapa parecer parafusada
    for (const sx of [-1, 1]) {
      for (const sy of [-1, 1]) {
        painel.add(
          this.add
            .image(sx * (COFRE_LARG / 2 - 10), sy * (COFRE_ALT / 2 - 10), 'px')
            .setDisplaySize(6, 6)
            .setTint(0xd9a441)
        );
      }
    }

    painel.add(
      this.add
        .text(VISOR_X, -62, 'COFRE DA TORRE', {
          fontFamily: FONTS.display,
          fontSize: uiPx(14),
          color: '#ffc24d'
        })
        .setOrigin(0.5)
    );

    // visor: moldura escura e um fundo que troca de cor no acerto/erro
    painel.add(
      this.add.image(VISOR_X, -26, 'px').setDisplaySize(VISOR_LARG + 6, 50).setTint(0x1a1f38)
    );
    this.visorFundo = this.add
      .image(VISOR_X, -26, 'px')
      .setDisplaySize(VISOR_LARG, 44)
      .setTint(VISOR_REPOUSO);
    painel.add(this.visorFundo);
    this.visorTexto = this.add
      .text(VISOR_X, -26, '', {
        fontFamily: FONTS.display,
        fontSize: uiPx(24),
        color: '#ffc24d'
      })
      .setOrigin(0.5);
    painel.add(this.visorTexto);

    /**
     * Uma linha só faz os dois papéis — instrução em repouso e status durante o
     * pedido ('conferindo...', 'aguarde um pouco', 'sem conexão'). Duas linhas
     * empilhadas brigariam por espaço quando a escala de interface é 1,3 e o
     * texto quebra em duas.
     */
    this.recadoCofre = this.add
      .text(VISOR_X, 14, RECADO_REPOUSO, {
        fontFamily: FONTS.body,
        fontSize: uiPx(13),
        color: '#aeb8e8',
        align: 'center',
        wordWrap: { width: VISOR_LARG }
      })
      .setOrigin(0.5, 0);
    painel.add(this.recadoCofre);

    // teclado 3×4 — os três dígitos e as duas teclas de comando
    const teclado: { rotulo: string; cores: typeof TECLA_NUM; acao: () => void }[] = [
      ...['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => ({
        rotulo: d,
        cores: TECLA_NUM,
        acao: () => this.digitar(d)
      })),
      { rotulo: '✕', cores: TECLA_LIMPAR, acao: () => this.limpar() },
      { rotulo: '0', cores: TECLA_NUM, acao: () => this.digitar('0') },
      { rotulo: '⏎', cores: TECLA_ENVIAR, acao: () => void this.enviar() }
    ];

    teclado.forEach((tecla, i) => {
      const col = i % 3;
      const lin = Math.floor(i / 3);
      const x = TECLADO_X + (col - 1) * PASSO_X;
      const y = -1.5 * PASSO_Y + lin * PASSO_Y;

      const borda = this.add
        .image(0, 0, 'px')
        .setDisplaySize(TECLA_LARG + 4, TECLA_ALT + 4)
        .setTint(0x2c1c08);
      const fundo = this.add
        .image(0, 0, 'px')
        .setDisplaySize(TECLA_LARG, TECLA_ALT)
        .setTint(tecla.cores.base);
      const texto = this.add
        .text(0, 0, tecla.rotulo, {
          fontFamily: FONTS.display,
          fontSize: uiPx(19),
          color: '#f3e6c4'
        })
        .setOrigin(0.5);

      const botao = this.add
        .container(x, y, [borda, fundo, texto])
        .setSize(TECLA_LARG, TECLA_ALT)
        .setInteractive({ useHandCursor: true });
      botao.on('pointerover', () => fundo.setTint(tecla.cores.hover));
      botao.on('pointerout', () => fundo.setTint(tecla.cores.base));
      botao.on('pointerdown', () => {
        // primeiro toque da página: sem isto o navegador mantém o áudio suspenso
        Audio.unlock();
        this.piscarTecla(tecla.rotulo);
        tecla.acao();
      });
      this.teclas.set(tecla.rotulo, { fundo, base: tecla.cores.base });
      painel.add(botao);
    });

    this.atualizarVisor();
  }

  /**
   * Teclado físico: os mesmos comandos do painel.
   *
   * Backspace apaga um dígito (⏎ e ✕ têm equivalente exato; o retrocesso não,
   * mas piscar o ✕ é o retorno visual mais próximo do que aconteceu).
   */
  private escutarTeclado() {
    this.input.keyboard?.on('keydown', (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        this.piscarTecla(e.key);
        this.digitar(e.key);
      } else if (e.key === 'Backspace') {
        this.piscarTecla('✕');
        this.apagar();
      } else if (e.key === 'Enter') {
        this.piscarTecla('⏎');
        void this.enviar();
      }
    });
  }

  private piscarTecla(rotulo: string) {
    const tecla = this.teclas.get(rotulo);
    if (!tecla) return;
    tecla.fundo.setTint(0xd9a441);
    this.time.delayedCall(110, () => tecla.fundo.setTint(tecla.base));
  }

  private digitar(digito: string) {
    if (this.verificando || this.codigo.length >= TAMANHO_CODIGO) return;
    this.codigo += digito;
    Audio.select();
    this.atualizarVisor();
    // o código tem tamanho fixo: completar já é o pedido. O respiro deixa o
    // último ● aparecer antes de o visor virar 'conferindo...'
    if (this.codigo.length === TAMANHO_CODIGO) this.time.delayedCall(180, () => void this.enviar());
  }

  private apagar() {
    if (this.verificando || !this.codigo) return;
    this.codigo = this.codigo.slice(0, -1);
    this.atualizarVisor();
  }

  private limpar() {
    if (this.verificando) return;
    this.codigo = '';
    this.recadoCofre.setText(RECADO_REPOUSO);
    this.atualizarVisor();
  }

  /** Dígito digitado vira ●; o que falta fica como traço, mostrando o tamanho. */
  private atualizarVisor(cor = VISOR_REPOUSO, corTexto = '#ffc24d') {
    const marcas = Array.from({ length: TAMANHO_CODIGO }, (_, i) =>
      i < this.codigo.length ? '●' : '–'
    );
    this.visorFundo.setTint(cor);
    this.visorTexto.setText(marcas.join('  ')).setColor(corTexto);
  }

  /**
   * Conferência no servidor. Nunca dois pedidos no ar: `verificando` barra a
   * digitação inteira enquanto o fetch corre.
   *
   * Quem destrava é sempre `recusar`, e só no fim da pausa vermelha — sem isso
   * dava para digitar por cima do visor de erro. No acerto ninguém destrava, de
   * propósito: a cena já está saindo em fade.
   */
  private async enviar() {
    if (this.verificando || !this.codigo) return;
    this.verificando = true;
    const tentativa = this.codigo;
    this.recadoCofre.setText('conferindo...');
    Audio.confirm();

    try {
      const resp = await fetch('/api/manutencao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ senha: tentativa })
      });
      if (resp.ok) return void this.abrirCofre();
      this.recusar(resp.status === 429 ? 'aguarde um pouco' : 'código incorreto');
    } catch {
      this.recusar('sem conexão');
    }
  }

  private abrirCofre() {
    try {
      localStorage.setItem(CHAVE_LIBERADO, '1');
    } catch {
      /* sem storage: libera só esta sessão */
    }
    this.atualizarVisor(VISOR_CERTO, '#153409');
    this.recadoCofre.setText('cofre aberto');
    Audio.correct();
    this.cameras.main.flash(260, 143, 191, 111);
    // atraso curto para o visor verde ser visto antes de a tela apagar
    this.time.delayedCall(520, () => {
      this.cameras.main.fadeOut(500, 4, 6, 18);
      this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Menu'));
    });
  }

  private recusar(motivo: string) {
    this.atualizarVisor(VISOR_ERRO, '#f3e6c4');
    this.recadoCofre.setText(motivo);
    Audio.wrong();
    this.cameras.main.shake(220, 0.006);
    this.time.delayedCall(1100, () => {
      this.codigo = '';
      this.recadoCofre.setText(RECADO_REPOUSO);
      this.atualizarVisor();
      this.verificando = false; // só agora o cofre volta a aceitar dígitos
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
            // 72 e não 90: o cavaleiro tem 28px × 2.6 de altura e com o chão
            // mais alto o ápice do salto passava por cima do recado
            y: chaoY - 72,
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
