const CX_BASE = -2.5;
const CY_BASE = -1.1;

const BASE_PIXEL_SIZE = 1/500;
const ESCAPE_RADIUS_SQUARED = 400 * 400;
const MAX_COLOR_COMPONENT_VALUE = 255;

export const tileCoords = (row, col, zoomLevel, tileSize) => {
  const pixelSize = BASE_PIXEL_SIZE / zoomLevel;

  const minX = (col * tileSize * pixelSize);
  const minY = (row * tileSize * pixelSize);

  return { minX, minY, pixelSize };
};

const iterateZ = (Cx, Cy, maxIterations) => {
  // Z = Zx + Zy*i
  // start with Z(0) = 0
  let Zx = 0.0;
  let Zy = 0.0;
  let Zx2 = 0.0;
  let Zy2 = 0.0;

  let i;
  for (i = 0; i < maxIterations && (Zx2 + Zy2) < ESCAPE_RADIUS_SQUARED; i++) {
    // Z(n+1) = Z(n)^2 + C
    // Z(n+1) = Zx(n-1)^2 + 2*Zx(n-1)*Zy(n-1)*i + Zy(n-1)^2*-1 + Cx + Cy*i
    // Z(n+1) = (Zx(n-1)^2 - Zy(n-1)^2 + Cx) + (2*Zx(n-1)*Zy(n-1) + Cy)*i
    Zy = (2 * Zx * Zy) + Cy;
    Zx = Zx2 - Zy2 + Cx;

    // Zx2 = Zx*Zx
    // Zy2 = Zy*Zy
    Zx2 = Zx * Zx;
    Zy2 = Zy * Zy;
  };

  return i;
};

const mandelbrotColor = (buffer, address, iterations, maxIterations) => {
  if (iterations == maxIterations) {
    // black pixel when the point is within the mandelbrot set
    buffer[address + 0] = 0;
    buffer[address + 1] = 0;
    buffer[address + 2] = 0;
    buffer[address + 3] = 0;
  } else {
    // assign colour value for points outside the set based on
    // how fast they became divergent (went outside the escape radius)
    const c = 3 * Math.log(iterations) / Math.log((maxIterations) - 1.0);
    if (c < 1) {
      buffer[address + 0] = 0;
      buffer[address + 1] = 0;
      buffer[address + 2] = MAX_COLOR_COMPONENT_VALUE*c;
      buffer[address + 3] = MAX_COLOR_COMPONENT_VALUE;
    } else if (c < 2) {
      buffer[address + 0] = 0;
      buffer[address + 1] = MAX_COLOR_COMPONENT_VALUE*(c-1);
      buffer[address + 2] = MAX_COLOR_COMPONENT_VALUE;
      buffer[address + 3] = MAX_COLOR_COMPONENT_VALUE;
    } else {
      buffer[address + 0] = MAX_COLOR_COMPONENT_VALUE*(c-2);
      buffer[address + 1] = MAX_COLOR_COMPONENT_VALUE;
      buffer[address + 2] = MAX_COLOR_COMPONENT_VALUE;
      buffer[address + 3] = MAX_COLOR_COMPONENT_VALUE;
    }
  }
}


export const getTextureBuffer = (minX, minY, pixelSize, tileSize, maxIterations) => {
  const buffer = new Uint8Array(tileSize * tileSize * 4);
  for (let col = 0; col < tileSize; col++) {
    const Cy = minY + (col * pixelSize);
    const colIndex = col * tileSize * 4;

    for (let row = 0; row < tileSize; row++) {
      const Cx = minX + (row * pixelSize);
      const iterations = iterateZ(Cx, Cy, maxIterations);

      const index = ((col * tileSize) + row) * 4;
      mandelbrotColor(buffer, index, iterations, maxIterations);
    }
  }
  return buffer;
};
