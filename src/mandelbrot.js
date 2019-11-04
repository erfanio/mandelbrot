const BASE_PIXEL_SIZE = 1/500;
const ESCAPE_RADIUS_SQUARED = 4;
const MAX_COLOR_COMPONENT_VALUE = 255;

export const tileCoords = (row, col, zoomLevel, tileSize) => {
  const pixelSize = BASE_PIXEL_SIZE / zoomLevel;

  const minX = (col * tileSize * pixelSize);
  const minY = (row * tileSize * pixelSize);

  return { minX, minY, pixelSize };
};

const iterateZ = (Cx, Cy, maxN) => {
  // Z = Zx + Zy*i
  // start with Z(0) = 0
  let Zx = 0;
  let Zy = 0;
  let Zx2 = 0;
  let Zy2 = 0;

  let orbitZy = 0;
  let orbitZx = 0;
  let nextPeriod = 8;

  for (let n = 0; n < maxN; n++) {
    // Z(n) = Z(n-1)^2 + C
    // Z(n) = Zx(n-1)^2 + 2*Zx(n-1)*Zy(n-1)*i + Zy(n-1)^2*-1 + Cx + Cy*i
    // Z(n) = (2*Zx(n-1)*Zy(n-1) + Cy)*i + (Zx(n-1)^2 - Zy(n-1)^2 + Cx)
    Zy = (2 * Zx * Zy) + Cy;
    Zx = Zx2 - Zy2 + Cx;

    // Zx2 = Zx*Zx
    // Zy2 = Zy*Zy
    Zx2 = Zx * Zx;
    Zy2 = Zy * Zy;

    // detect divergence by checking if Z has a moved further than a certain radius
    if (Zx2 + Zy2 > ESCAPE_RADIUS_SQUARED) return n;

    // fast track detecting divergence by checking if Z has entered an orbit
    if (Zx == orbitZx && Zy == orbitZy) return maxN;
    // double the period after not detecting an orbit
    if (n == nextPeriod) {
      orbitZx = Zx;
      orbitZy = Zy;
      nextPeriod += nextPeriod;
    }
  };

  return maxN;
};

const mandelbrotColor = (buffer, address, n, maxN) => {
  if (n == maxN) {
    // black pixel when the point is within the mandelbrot set
    buffer[address + 0] = 0;
    buffer[address + 1] = 0;
    buffer[address + 2] = 0;
    buffer[address + 3] = 0;
  } else {
    // assign colour value for points outside the set based on
    // how fast they became divergent (went outside the escape radius)
    const c = 3 * Math.log(n) / Math.log((maxN) - 1.0);
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


export const getTextureBuffer = (minX, minY, pixelSize, tileSize, maxN) => {
  const buffer = new Uint8Array(tileSize * tileSize * 4);
  for (let col = 0; col < tileSize; col++) {
    const Cy = minY + (col * pixelSize);
    const colIndex = col * tileSize * 4;

    for (let row = 0; row < tileSize; row++) {
      const Cx = minX + (row * pixelSize);
      const n = iterateZ(Cx, Cy, maxN);

      const index = ((col * tileSize) + row) * 4;
      mandelbrotColor(buffer, index, n, maxN);
    }
  }
  return buffer;
};
