import { getTextureBuffer } from './mandelbrot';

self.onmessage = (msg) => {
  const { id, minX, minY, pixelSize, tileSize } = msg.data;
  const buffer = getTextureBuffer(minX, minY, pixelSize, tileSize);
  self.postMessage({ id, buffer }, [buffer.buffer]);
};
