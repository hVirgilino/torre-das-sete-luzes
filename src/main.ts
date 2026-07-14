import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from './data/config';
import { BootScene } from './scenes/Boot';
import { MenuScene } from './scenes/Menu';
import { IntroScene } from './scenes/Intro';
import { TutorialScene } from './scenes/Tutorial';
import { TowerScene } from './scenes/Tower';
import { QuizScene } from './scenes/Quiz';
import { FinalScene } from './scenes/Final';

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#0b1026',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
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
