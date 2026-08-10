// fontes embutidas no bundle — nada é buscado de terceiros em runtime
import '@fontsource/cinzel/500.css';
import '@fontsource/cinzel/700.css';
import '@fontsource/cinzel/900.css';
import '@fontsource/im-fell-english/400.css';
import '@fontsource/im-fell-english/400-italic.css';

import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, isTouchDevice } from './data/config';
import { renderScale, installTextSharpening } from './systems/display';
import { BootScene } from './scenes/Boot';
import { MenuScene } from './scenes/Menu';
import { IntroScene } from './scenes/Intro';
import { TutorialScene } from './scenes/Tutorial';
import { TowerScene } from './scenes/Tower';
import { QuizScene } from './scenes/Quiz';
import { FinalScene } from './scenes/Final';

/**
 * Mantém o canvas colado no tamanho visível do navegador.
 *
 * No Android o Brave/Chrome esconde e mostra a barra de endereço enquanto se
 * joga, e `100%` de altura em CSS resolve para o viewport grande — o rodapé do
 * jogo (justo onde ficam os controles de toque) ficava cortado. `visualViewport`
 * é o único que reporta a área realmente visível nesse momento.
 */
function trackViewport(game: Phaser.Game) {
  const apply = () => {
    const vv = window.visualViewport;
    const host = document.getElementById('game');
    if (host && vv) host.style.height = `${vv.height}px`;
    game.scale.refresh();
  };
  window.addEventListener('resize', apply);
  window.addEventListener('orientationchange', () => setTimeout(apply, 120));
  window.visualViewport?.addEventListener('resize', apply);
  apply();
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
    scene: [BootScene, MenuScene, IntroScene, TutorialScene, TowerScene, QuizScene, FinalScene]
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
