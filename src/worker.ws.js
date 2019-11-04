import { getTextureBuffer } from './mandelbrot';

const textureWorker = (id, { minX, minY, pixelSize, tileSize, maxN }) => {
  const start = performance.now();
  const buffer = getTextureBuffer(minX, minY, pixelSize, tileSize, maxN);
  const duration = performance.now() - start;

  const payload = { buffer };
  self.postMessage({ id, payload }, [buffer.buffer]);

  return duration;
};

class TaskQueue {
  _queue = [];
  _timeout = null
  _totalTileDuration = 0
  _tileCount = 0

  handleMessage = (msg) => {
    const { id, type, payload } = msg.data;
    if (type === 'task') {
      this._queue.push({ id, payload });
    } else if (type === 'clear') {
      this._queue = [];
    }

    if (!this._timeout) {
      this._timeout = setTimeout(this._worker, 0);
    }
  }

  _worker = () => {
    if (this._queue.length > 0) {
      const { id, payload } = this._queue.shift();
      this._totalTileDuration += textureWorker(id, payload);
      this._tileCount++;

      this._timeout = setTimeout(this._worker, 0);
    } else {
      this._timeout = null;

      const avgPerf = this._totalTileDuration / this._tileCount;
      console.log(`Average tile generation duration ${avgPerf}ms`);
      this._totalTileDuration = 0
      this._tileCount = 0
    }
  }
}

const queue = new TaskQueue();
addEventListener('message', queue.handleMessage);
