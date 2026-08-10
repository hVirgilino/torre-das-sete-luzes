import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, ResolutionId, isTouchDevice, screenSize } from '../data/config';
import { State } from './state';

/**
 * Resoluções de renderização, todas 16:9. O mundo lógico das cenas continua
 * fixo em 960×540 (GAME_WIDTH/HEIGHT) — `k` só aumenta o backing store do
 * canvas e o zoom da câmera, deixando texto/sprites mais nítidos sem mudar
 * nenhuma coordenada de jogo.
 */
export const RESOLUTIONS: { id: ResolutionId; label: string; k: number }[] = [
  { id: '540', label: '960×540', k: 1 },
  { id: '720', label: '1280×720', k: 4 / 3 },
  { id: '1080', label: '1920×1080', k: 2 },
  { id: '1440', label: '2560×1440', k: 8 / 3 }
];

export function resolutionOf(id: ResolutionId) {
  return RESOLUTIONS.find((r) => r.id === id) ?? RESOLUTIONS[0];
}

/**
 * No celular a resolução de render é deduzida da tela, não da configuração:
 * num display de DPR 3 como o do S24 o canvas de 960px era esticado para
 * ~2340px físicos e o jogo subia borrado. Aqui o backing store nasce com a
 * mesma contagem de pixels que o aparelho realmente mostra.
 *
 * Calculado uma vez só — precisa bater com o tamanho de canvas criado em
 * main.ts e com o zoom que cada cena aplica na câmera.
 */
const autoScale = (() => {
  if (!isTouchDevice()) return null;
  const dpr = window.devicePixelRatio || 1;
  const { w, h } = screenSize();
  const k = (Math.max(w, h) * dpr) / GAME_WIDTH;
  // teto de 3: acima disso é só custo de GPU sem ganho visível
  return Math.min(Math.max(k, 1), 3);
})();

/** Fator de escala do canvas para a resolução escolhida nas configurações. */
export function renderScale(): number {
  return autoScale ?? resolutionOf(State.settings.resolutionId).k;
}

/** true quando a resolução vem da tela e o seletor das opções não vale. */
export function isAutoResolution(): boolean {
  return autoScale !== null;
}

/**
 * Centraliza e aplica o zoom da câmera principal da cena no mundo lógico
 * 960×540. Chamar como primeira linha do create() de cada cena.
 */
export function initSceneView(scene: Phaser.Scene) {
  const k = renderScale();
  scene.cameras.main.setZoom(k).centerOn(GAME_WIDTH / 2, GAME_HEIGHT / 2);
}

/**
 * Faz todo texto criado a partir de agora nascer com a resolução de canvas
 * correta — sem isso, textos ficam borrados quando o backing store é maior
 * que o mundo lógico (960×540).
 */
export function installTextSharpening(k: number) {
  if (k === 1) return;
  const factory = Phaser.GameObjects.GameObjectFactory.prototype as any;
  const originalText = factory.text;
  factory.text = function (this: unknown, ...args: unknown[]) {
    const t = originalText.apply(this, args);
    t.setResolution(k);
    return t;
  };
}

/** Escala atual da interface (um dos degraus de UI_SCALES). */
export function uiScale(): number {
  return State.settings.uiScale;
}

/** Tamanho de fonte em px já escalado pela configuração de interface. */
export function uiPx(base: number): string {
  return `${Math.round(base * uiScale())}px`;
}
