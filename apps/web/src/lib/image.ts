type Drawable = HTMLVideoElement | HTMLImageElement | ImageBitmap | HTMLCanvasElement;

function sizeOf(src: Drawable): { w: number; h: number } {
  if (src instanceof HTMLVideoElement) return { w: src.videoWidth, h: src.videoHeight };
  if (src instanceof HTMLImageElement) return { w: src.naturalWidth, h: src.naturalHeight };
  return { w: src.width, h: src.height };
}

export function drawToCanvas(src: Drawable, maxPx: number): HTMLCanvasElement {
  const { w, h } = sizeOf(src);
  const k = Math.min(1, maxPx / Math.max(w, h, 1));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(w * k));
  canvas.height = Math.max(1, Math.round(h * k));
  canvas.getContext('2d')!.drawImage(src, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/** Encode en WebP ; repli en JPEG si le navigateur ne sait pas encoder le WebP (Safari). */
export async function encode(canvas: HTMLCanvasElement, quality = 0.8): Promise<Blob> {
  const webp = await toBlob(canvas, 'image/webp', quality);
  if (webp && webp.type === 'image/webp') return webp;
  const jpeg = await toBlob(canvas, 'image/jpeg', quality);
  if (!jpeg) throw new Error("Impossible d'encoder l'image.");
  return jpeg;
}

export async function loadDrawable(file: Blob): Promise<ImageBitmap | HTMLImageElement> {
  if ('createImageBitmap' in window) {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      /* repli <img> ci-dessous */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Compression avant envoi : max 1280 px, qualité 0.8 (spec section 3). */
export async function compressForUpload(src: Drawable | Blob): Promise<Blob> {
  const drawable = src instanceof Blob ? await loadDrawable(src) : src;
  return encode(drawToCanvas(drawable, 1280), 0.8);
}

/** Miniature locale, max 320 px. */
export async function makeThumb(photo: Blob): Promise<Blob> {
  return encode(drawToCanvas(await loadDrawable(photo), 320), 0.7);
}
