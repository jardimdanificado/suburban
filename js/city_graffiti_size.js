// Medidas compartilhadas entre a geração do texto e o desenho da pichação.
// O texto não pode prometer mais palavras do que a superfície consegue mostrar,
// e o canvas precisa crescer junto com a peça multi-tile.
export const GRAFFITI_TILE_WIDTH = .86;
export const GRAFFITI_WALL_TILE_HEIGHT = 1.64;

const GROUND_REFERENCE_AREA = GRAFFITI_TILE_WIDTH * GRAFFITI_TILE_WIDTH;
const WALL_REFERENCE_AREA = GRAFFITI_TILE_WIDTH * GRAFFITI_WALL_TILE_HEIGHT;

const larguraDe = support => Math.max(.1, Number(support?.width) || GRAFFITI_TILE_WIDTH);
const alturaDe = support => Math.max(.1, Number(support?.height) || (support?.surface === 'wall' ? GRAFFITI_WALL_TILE_HEIGHT : GRAFFITI_TILE_WIDTH));

export function graffitiTileSpan(support) {
  const width = larguraDe(support);
  const height = alturaDe(support);
  const wall = support?.surface === 'wall';
  return {
    width,
    height,
    tilesX: Math.max(1, Math.round(Number(support?.tileWidth)) || Math.round(width / GRAFFITI_TILE_WIDTH)),
    tilesY: Math.max(1, Math.round(Number(support?.tileHeight)) || Math.round(height / (wall ? GRAFFITI_WALL_TILE_HEIGHT : GRAFFITI_TILE_WIDTH))),
  };
}

// Quantidade de caracteres que o desenho consegue distribuir sem encolher a
// fonte até ficar ilegível. Cresce com a área física, não com o número bruto de
// tiles, para que uma parede alta e estreita não receba texto de mural.
export function graffitiTextCapacity(support) {
  if (!support) return 34;
  const { width, height } = graffitiTileSpan(support);
  const reference = support.surface === 'wall' ? WALL_REFERENCE_AREA : GROUND_REFERENCE_AREA;
  const area = Math.max(reference, width * height);
  return Math.max(34, Math.min(300, Math.round(34 * Math.sqrt(area / reference))));
}

// Limite persistido da mensagem. A folga cobre o alvo e a pontuação sem
// permitir que uma peça enorme guarde um texto que nunca será desenhado.
export function graffitiTextLimit(support) {
  if (!support) return 180;
  return Math.max(180, Math.min(640, Math.round(graffitiTextCapacity(support) * 1.8)));
}

// Resolução do canvas. A textura acompanha a proporção física da peça para o
// texto não esticar: 128 px por tile, com piso de 256 px por eixo e teto de
// 2048 px. Um mural 7x9 vira 896x1152; uma faixa de 12 tiles, 1536x256.
export function graffitiCanvasSize(support) {
  if (!support) return { width: 256, height: 256 };
  const { tilesX, tilesY } = graffitiTileSpan(support);
  const axis = tiles => Math.max(256, Math.min(2048, Math.round(128 * tiles)));
  return { width: axis(tilesX), height: axis(tilesY) };
}
