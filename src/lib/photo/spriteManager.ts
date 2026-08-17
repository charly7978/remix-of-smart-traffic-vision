/**
 * Gestor de Sprites Fotorrealistas con Chroma Keying en Tiempo Real.
 * Carga imágenes generadas por IA, elimina el fondo blanco puro y las cachea
 * como ImageBitmaps o HTMLCanvasElements listos para renderizar a 60 FPS.
 */

export type SpriteKind = "car" | "bus" | "ambulance" | "motorcycle";

const spriteCache: Partial<Record<SpriteKind, HTMLCanvasElement>> = {};
let loaded = false;

/**
 * Aplica Chroma Keying a una imagen para hacer transparente el fondo blanco.
 */
function createTransparentSprite(img: HTMLImageElement, tolerance = 240): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return canvas;

  // Dibujar imagen original
  ctx.drawImage(img, 0, 0);

  // Leer píxeles
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  // Chroma Key: Fondo blanco a transparente
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]!;
    const g = data[i + 1]!;
    const b = data[i + 2]!;

    // Si el pixel es muy cercano al blanco puro (fondo de la IA)
    if (r > tolerance && g > tolerance && b > tolerance) {
      data[i + 3] = 0; // Alpha = 0 (Transparente)
    }
  }

  // Escribir píxeles de vuelta con el fondo transparente
  ctx.putImageData(imageData, 0, 0);

  // Recortar espacio en blanco sobrante para ajustar el "hitbox" visual
  const bounds = { minX: canvas.width, minY: canvas.height, maxX: 0, maxY: 0 };
  const d2 = imageData.data;
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      const alpha = d2[(y * canvas.width + x) * 4 + 3];
      if (alpha && alpha > 0) {
        if (x < bounds.minX) bounds.minX = x;
        if (x > bounds.maxX) bounds.maxX = x;
        if (y < bounds.minY) bounds.minY = y;
        if (y > bounds.maxY) bounds.maxY = y;
      }
    }
  }

  const w = bounds.maxX - bounds.minX + 1;
  const h = bounds.maxY - bounds.minY + 1;

  if (w > 0 && h > 0) {
    const cropped = document.createElement("canvas");
    cropped.width = w;
    cropped.height = h;
    const cctx = cropped.getContext("2d");
    if (cctx) {
      cctx.drawImage(canvas, bounds.minX, bounds.minY, w, h, 0, 0, w, h);
      return cropped;
    }
  }

  return canvas;
}

/**
 * Precarga y procesa todos los sprites al inicializar la app.
 */
export async function loadSprites(): Promise<void> {
  if (typeof window === "undefined" || loaded) return;

  const loadImg = (src: string) => {
    return new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  };

  try {
    const [carImg, busImg, ambImg, motoImg] = await Promise.all([
      loadImg("/images/sprites/car.jpg"),
      loadImg("/images/sprites/bus.jpg"),
      loadImg("/images/sprites/ambulance.jpg"),
      loadImg("/images/sprites/motorcycle.jpg"),
    ]);

    spriteCache.car = createTransparentSprite(carImg, 230); // Ligeramente más tolerante
    spriteCache.bus = createTransparentSprite(busImg, 230);
    spriteCache.ambulance = createTransparentSprite(ambImg, 230);
    spriteCache.motorcycle = createTransparentSprite(motoImg, 230);
    loaded = true;
  } catch (error) {
    console.error("Error loading sprites:", error);
  }
}

/**
 * Obtiene el sprite procesado de la memoria caché.
 */
export function getSprite(kind: SpriteKind): HTMLCanvasElement | null {
  return spriteCache[kind] || null;
}
