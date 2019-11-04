import Worker from './worker.ws.js';

class WorkerManager {
  _taskId = 0
  _workers = []
  _taskCallbacks = new Map()

  constructor(workerCount = 3) {
    for (let i = 0; i < workerCount; i++) {
      const worker = new Worker();
      worker.addEventListener('message', this._handleMessage)
      this._workers.push(worker);
    }
  }

  runTask = (payload, callback) => {
    // use an sequential number as the task id
    const id = this._taskId++;
    const worker = this._workers[id % this._workers.length];

    this._taskCallbacks.set(id, callback);
    worker.postMessage({ id, type: 'task', payload });
  }

  // remove all pending tasks and requests
  clearTasks = () => {
    for (let worker of this._workers) {
      worker.postMessage({ type: 'clear' });
    }

    for (let res of this._taskCallbacks.values()) {
      res({});
    }
    this._taskCallbacks.clear();
  }

  _handleMessage = (msg) => {
    const { id, payload, finished } = msg.data;

    // check callback in case it has been cleared
    if (this._taskCallbacks.has(id)) {
      // pass results back to the user
      const res = this._taskCallbacks.get(id);
      res(payload);

      // remove callback if tile rendering is finished
      if (finished) {
        this._taskCallbacks.delete(id);
      }
    }
  }
}

export default WorkerManager;
