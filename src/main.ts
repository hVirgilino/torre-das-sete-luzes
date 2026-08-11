// fontes embutidas no bundle — nada é buscado de terceiros em runtime
import '@fontsource/cinzel/500.css';
import '@fontsource/cinzel/700.css';
import '@fontsource/cinzel/900.css';
import '@fontsource/im-fell-english/400.css';
import '@fontsource/im-fell-english/400-italic.css';

import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, isTouchDevice, viewportSize } from './data/config';
import { renderScale, installTextSharpening } from './systems/display';
import { BootScene } from './scenes/Boot';
import { MenuScene } from './scenes/Menu';
import { IntroScene } from './scenes/Intro';
import { TutorialScene } from './scenes/Tutorial';
import { TowerScene } from './scenes/Tower';
import { QuizScene } from './scenes/Quiz';
import { FinalScene } from './scenes/Final';
import { RankingScene } from './scenes/Ranking';
import { ManutencaoScene } from './scenes/Manutencao';

/**
 * Mantém o canvas colado no tamanho visível do navegador.
 *
 * No Android o Brave/Chrome esconde e mostra a barra de endereço enquanto se
 * joga, e `100%` de altura em CSS resolve para o viewport grande — o rodapé do
 * jogo (justo onde ficam os controles de toque) ficava cortado. `visualViewport`
 * é o único que reporta a área realmente visível nesse momento.
 *
 * A div recebe largura e altura **em pixels**, e o mesmo par vai para o Phaser
 * por `setParentSize`. Parece redundante — o Phaser mede a div sozinho — mas é
 * a correção do bug que deixou o jogo do tamanho de um selo no Safari do
 * iPhone: lá a medição da div voltou uma tira de poucos pixels, o FIT encolheu
 * o canvas até aquilo e nunca mais cresceu, porque a medida seguinte continuava
 * batendo com a anterior. Dizendo o tamanho na mão, o valor errado não tem por
 * onde entrar. `refresh()` reposiciona canvas e área de toque.
 *
 * O reaplique em cascata existe pelo mesmo motivo: no iOS a altura só assenta
 * depois que a barra do navegador termina de se acomodar, e o primeiro valor
 * costuma ser provisório.
 */
function trackViewport(game: Phaser.Game) {
  const host = document.getElementById('game');
  const apply = () => {
    const { w, h } = viewportSize();
    if (!w || !h) return;
    if (host) {
      host.style.width = `${w}px`;
      host.style.height = `${h}px`;
    }
    game.scale.setParentSize(w, h);
    game.scale.refresh();
  };
  window.addEventListener('resize', apply);
  window.addEventListener('orientationchange', () => setTimeout(apply, 120));
  window.visualViewport?.addEventListener('resize', apply);
  window.visualViewport?.addEventListener('scroll', apply);
  apply();
  for (const atraso of [150, 500, 1200]) setTimeout(apply, atraso);
}

/** Pede para girar o aparelho: 16:9 deitado em pé vira uma tira ilegível. */
function trackOrientation() {
  if (!isTouchDevice()) return;
  const overlay = document.getElementById('rotate-overlay');
  if (!overlay) return;
  const apply = () =>
    overlay.classList.toggle('visible', window.innerHeight > window.innerWidth);
  window.addEventListener('resize', apply);
  window.addEventListener('orientationchange', () => setTimeout(apply, 120));
  apply();
}

function startGame() {
  const k = renderScale();
  installTextSharpening(k);
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    backgroundColor: '#0b1026',
    width: GAME_WIDTH * k,
    height: GAME_HEIGHT * k,
    pixelArt: true,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      autoRound: true // sem meio pixel de CSS, que borra o pixel art
    },
    physics: {
      default: 'arcade',
      arcade: {
        gravity: { x: 0, y: 820 },
        debug: false
      }
    },
    scene: [
      BootScene, MenuScene, IntroScene, TutorialScene, TowerScene,
      QuizScene, FinalScene, RankingScene, ManutencaoScene
    ]
  });

  // a varredura própria do Phaser é de 500ms — lenta demais para acompanhar a
  // barra de endereço deslizando
  game.scale.resizeInterval = 200;
  trackViewport(game);
  trackOrientation();
}

// espera as fontes para o Phaser não medir textos com a fonte reserva;
// o timeout garante que o jogo abre mesmo se a API atrasar
Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 800))]).then(startGame);
