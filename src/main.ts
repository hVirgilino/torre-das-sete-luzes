// fontes embutidas no bundle — nada é buscado de terceiros em runtime
import '@fontsource/cinzel/500.css';
import '@fontsource/cinzel/700.css';
import '@fontsource/cinzel/900.css';
import '@fontsource/im-fell-english/400.css';
import '@fontsource/im-fell-english/400-italic.css';

import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from './data/config';
import { renderScale, installTextSharpening } from './systems/display';
import { BootScene } from './scenes/Boot';
import { MenuScene } from './scenes/Menu';
import { IntroScene } from './scenes/Intro';
import { TutorialScene } from './scenes/Tutorial';
import { TowerScene } from './scenes/Tower';
import { QuizScene } from './scenes/Quiz';
import { FinalScene } from './scenes/Final';

function startGame() {
  const k = renderScale();
  installTextSharpening(k);
  new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    backgroundColor: '#0b1026',
    width: GAME_WIDTH * k,
    height: GAME_HEIGHT * k,
    pixelArt: true,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH
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
}

// espera as fontes para o Phaser não medir textos com a fonte reserva;
// o timeout garante que o jogo abre mesmo se a API atrasar
Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 800))]).then(startGame);
