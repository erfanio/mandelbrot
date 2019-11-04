import { getTextureBuffer } from './mandelbrot';

const textureWorker = (id, { minX, minY, pixelSize, tileSize, maxN }, scale) => {
  const start = performance.now();
  const buffer = getTextureBuffer(minX, minY, pixelSize, tileSize, maxN, scale);
  const duration = performance.now() - start;

  const payload = { buffer };
  self.postMessage({ id, payload }, [buffer.buffer]);

  return duration;
};

class TaskQueue {
  // Multiple queue are used as a pipeline for tiles, each step producing
  // higher quality tiles until the last step which outputs in full resolution
  _pipeline = [[], [], [], []]
  _timeout = null
  _totalTileDuration = 0
  _tileCount = 0

  handleMessage = (msg) => {
    const { id, type, payload } = msg.data;

    if (type === 'task') {
      // push task to the first step in the pipelines
      this._pipeline[0].push({ id, payload });
    } else if (type === 'clear') {
      this._pipeline = [[], [], [], []];
    }

    if (!this._timeout) {
      this._timeout = setTimeout(this._worker, 0);
    }
  }

  _getTask = () => {
    for (let [index, queue] of this._pipeline.entries()) {
      if (queue.length > 0) {
        const task = queue.shift();
        return { index, task };
      }
    }

    return { index: -1 };
  }

  _worker = () => {
    this._timeout = null;
    const { index, task } = this._getTask();
    if (index === -1) return; // no tasks

    // move to next queue (next step in pipeline)
    if (index < this._pipeline.length-1) {
      this._pipeline[index+1].push(task);
    }

    const { id, payload } = task;
    // first pass is 1:2^nq scale, second pass is 1:2^(nq-1) and on and on... until 1:1
    // nq is the number of queues in our pipeline
    const scale = Math.pow(2, this._pipeline.length-index-1);
    this._totalTileDuration += textureWorker(id, payload, scale);
    this._tileCount++;


    // Show average duration after the last tile in each queue
    if (this._pipeline[index].length === 0) {
      const avgPerf = this._totalTileDuration / this._tileCount;
      console.log(`1/${scale} scale tiles average: ${avgPerf}ms`);
      this._totalTileDuration = 0
      this._tileCount = 0
    }

    // allow other tasks to run before proceeding to the next task
    this._timeout = setTimeout(this._worker, 0);
  }
}

const queue = new TaskQueue();
addEventListener('message', queue.handleMessage);
