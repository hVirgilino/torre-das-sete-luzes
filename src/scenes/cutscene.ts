import Phaser from 'phaser';
import { Audio } from '../systems/audio';
import { wait } from '../systems/ui';

/** Corte real posicionada na sala do trono (usada na Intro e no Final). */
export interface Court {
  king: Phaser.GameObjects.Sprite;
  knight: Phaser.GameObjects.Sprite;
  sword: Phaser.GameObjects.Sprite;
  merlin?: Phaser.GameObjects.Sprite;
}

/**
 * Posiciona rei, cavaleiro ajoelhado e a espada (oculta) diante do trono.
 * `withMerlin` já coloca Merlin ao lado; senão ele pode entrar depois.
 */
export function placeCourt(
  scene: Phaser.Scene,
  opts: { withMerlin?: boolean; floorY?: number } = {}
): Court {
  const floorY = opts.floorY ?? 430;
  const king = scene.add.sprite(510, floorY - 34, 'king').setScale(2.4).setOrigin(0.5, 1);
  const knight = scene.add.sprite(430, floorY, 'knight-sheet', 'kneel').setScale(2.4).setOrigin(0.5, 1);
  const sword = scene.add
    .sprite(480, floorY - 90, 'sword')
    .setScale(2)
    .setOrigin(0.5, 1)
    .setAngle(-40)
    .setVisible(false);
  const merlin = opts.withMerlin
    ? scene.add.sprite(320, floorY, 'merlin').setScale(2.4).setOrigin(0.5, 1)
    : undefined;
  return { king, knight, sword, merlin };
}

/**
 * Balanços da espada do Rei. Com `flash`, cada movimento é um toque cerimonial
 * (clarão + tinido); sem flash é só o gesto no ar.
 */
export async function swordSwings(
  scene: Phaser.Scene,
  sword: Phaser.GameObjects.Sprite,
  count: number,
  opts: { flash?: boolean; sfx?: boolean } = { flash: true, sfx: true }
): Promise<void> {
  sword.setVisible(true);
  for (let i = 0; i < count; i++) {
    scene.tweens.add({ targets: sword, angle: -70, duration: 260, ease: 'sine.out', yoyo: true });
    await wait(scene, 280);
    if (opts.sfx !== false) Audio.sword();
    if (opts.flash !== false) scene.cameras.main.flash(120, 255, 240, 184);
    await wait(scene, 520);
  }
  sword.setVisible(false);
}
