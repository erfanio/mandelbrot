import { getTextureBuffer } from './mandelbrot';

const textureWorker = (id, { minX, minY, pixelSize, tileSize, maxIterations }) => {
  const buffer = getTextureBuffer(minX, minY, pixelSize, tileSize, maxIterations);
  const payload = { buffer };
  self.postMessage({ id, payload }, [buffer.buffer]);
};

class TaskQueue {
  _queue = [];
  _timeout = null

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
      textureWorker(id, payload);

      this._timeout = setTimeout(this._worker, 0);
    } else {
      this._timeout = null;
    }
  }
}

const queue = new TaskQueue();
addEventListener('message', queue.handleMessage);
