import * as Pixi from 'pixi.js';
import { range } from './utility';
import { tileCoords } from './mandelbrot';
import Worker from './worker.ws.js';

const TILE_SIZE = 50;

class App {
  container = null
  app = null
  tiles = new Map()
  spritePool = []
  loadingTexture = null
  workers = []
  workerCallbacks = new Map()
  state = {
    draggingEventId: null,
    draggingOrigin: null,
    dragged: false,
    mouseUpTs: null,
    tilesRows: null,
    tilesCols: null,
    zoomLevel: 1,
    workerTaskId: 0,
  }

  constructor() {
    this.app = new Pixi.Application({
      autoDensity: true,
      resizeTo: document.body,
    });
    document.body.appendChild(this.app.view);

    this.container = new Pixi.Container();
    this.app.stage.addChild(this.container);
    this.container.x = this.app.renderer.width / 2;
    this.container.y = this.app.renderer.height / 2;
    this.container.interactive = true;
    this.container
        .on('pointerdown', this.onMouseDown)
        .on('pointerup', this.onMouseUp)
        .on('pointerupoutside', this.onMouseUp)
        .on('pointermove', this.onMouseMove);
    window.addEventListener('keydown', this.onKeyDown, false);

    this.workers.push(new Worker());
    this.workers.push(new Worker());
    this.workers.push(new Worker());
    this.workers.forEach(worker => worker.addEventListener('message', this.handleWorkerMessage));

    // create sprites (twice the number that fits on the screen)
    const spriteCount = (this.app.renderer.width/TILE_SIZE) * (this.app.renderer.height/TILE_SIZE) * 2;
    for (let i = 0; i < spriteCount; i++) {
      this.spritePool.push(new Pixi.Sprite());
    }

    this.updateTiles();
  }

  updateTiles = () => {
    const { rows: newRows, cols: newCols } = this.visibleTiles();

    let addRows = [];
    let addCols = [];
    if (this.state.tileRows) {
      const { tileRows: oldRows, tileCols: oldCols } = this.state;
      const changeRows = this.addDelTiles(oldRows, newRows);
      const changeCols = this.addDelTiles(oldCols, newCols);

      // delete old rows and columns
      for (let row of changeRows.del) {
        for (let col = oldCols[0]; col <= oldCols[1]; col++) {
          this.removeSprite(row, col);
        }
      }
      for (let col of changeCols.del) {
        for (let row = newRows[0]; row <= newRows[1]; row++) {
          this.removeSprite(row, col);
        }
      }

      addRows = changeRows.add;
      addCols = changeCols.add;
    } else {
      addRows = range(newRows[0], newRows[1]+1);
      addCols = range(newCols[0], newCols[1]+1);
    }

    // delete old rows and columns
    for (let row of addRows) {
      for (let col = newCols[0]; col <= newCols[1]; col++) {
        this.addSprite(row, col);
      }
    }
    for (let col of addCols) {
      for (let row = newRows[0]; row <= newRows[1]; row++) {
        this.addSprite(row, col);
      }
    }

    this.state.tileRows = newRows;
    this.state.tileCols = newCols;
  }

  redrawTiles = () => {
    const {
      tileRows: [rowMin, rowMax],
      tileCols: [colMin, colMax]
    } = this.state;
    for (let row of range(rowMin, rowMax+1)) {
      for (let col of range(colMin, colMax+1)) {
        const index = this.tileIndex(row, col);
        const sprite = this.tiles.get(index);
        sprite.texture = this.getLoadingTexture();
        this.addTexture(sprite, col, row);
      }
    }
  }

  getLoadingTexture = () => {
    if (!this.loadingTexture) {
      const text = new Pixi.Text('Loading', { fontSize: 10, fill: '#ffffff' });
      this.loadingTexture = new Pixi.RenderTexture.create(TILE_SIZE, TILE_SIZE);
      this.app.renderer.render(text, this.loadingTexture);
    }
    return this.loadingTexture;
  }

  addSprite = (row, col) => {
    const index = this.tileIndex(row, col);
    if (this.tiles.has(index)) return;

    // setup the sprite and set loading texture
    const sprite = this.spritePool.pop();
    sprite.texture = this.getLoadingTexture();
    sprite.x = col * TILE_SIZE;
    sprite.y = row * TILE_SIZE;
    this.container.addChild(sprite);
    this.tiles.set(index, sprite);

    this.addTexture(sprite, col, row);
  }

  addTexture = async (sprite, col, row) => {
    // generate mandelbrot texture
    const index = this.tileIndex(row, col);
    const { minX, minY, pixelSize } = tileCoords(row, col, this.state.zoomLevel, TILE_SIZE);
    const buffer = await new Promise((res) => {
      const msg = { minX, minY, pixelSize, tileSize: TILE_SIZE };
      const callback = ({ buffer }) => res(buffer);
      this.queueTask(msg, callback);
    });

    // check if sprite is still in the same position before adding texture
    if (this.tiles.get(index) == sprite) {
      sprite.texture = Pixi.Texture.fromBuffer(buffer, TILE_SIZE, TILE_SIZE);
    }
  }

  queueTask = (msg, callback) => {
    // use an incremental number as the task id
    const id = this.state.workerTaskId;
    this.state.workerTaskId++;
    // use the id to decide which worker to assign the task to
    const workerId = id % this.workers.length;

    this.workerCallbacks.set(id, callback);
    this.workers[workerId].postMessage({ id, ...msg });
  }

  handleWorkerMessage = (msg) => {
    const { id, ...data } = msg.data;
    if (this.workerCallbacks.has(id)) {
      const fn = this.workerCallbacks.get(id);
      fn(data);
      this.workerCallbacks.delete(id);
    }
  }

  removeSprite = (row, col) => {
    const index = this.tileIndex(row, col);
    if (!this.tiles.has(index)) return;

    const sprite = this.tiles.get(this.tileIndex(row, col));
    this.tiles.delete(this.tileIndex(row, col));
    this.container.removeChild(sprite);
    this.spritePool.push(sprite);
  }

  tileIndex = (row, col) => `${row}-${col}`

  addDelTiles = ([oldMin, oldMax], [newMin, newMax]) => {
    const add = [];
    const del = [];

    const maxMax = Math.max(oldMax, newMax);
    for (let i = Math.min(oldMin, newMin); i <= maxMax; i++) {
      if (newMin <= i && i <= newMax) {
        if (!(oldMin <= i && i <= oldMax)) {
          // inside new range but wasn't in the old range
          add.push(i);
        }
      } else {
        // not inside new range
        del.push(i);
      }
    }

    return { add, del };
  }

  visibleTiles = () => {
    const topleftX = -this.container.x;
    const topleftY = -this.container.y;
    const bottomrightX = topleftX + this.app.renderer.width;
    const bottomrightY = topleftY + this.app.renderer.height;

    const minCol = Math.floor(topleftX/TILE_SIZE);
    const maxCol = Math.ceil(bottomrightX/TILE_SIZE);
    const minRow = Math.floor(topleftY/TILE_SIZE);
    const maxRow = Math.ceil(bottomrightY/TILE_SIZE);

    return { rows: [minRow, maxRow], cols: [minCol, maxCol] };
  }

  scaleContainerPosition = (multiplier, width = null, height = null) => {
    if (!width || !height) {
      width = this.app.renderer.width / 2;
      height = this.app.renderer.height / 2;
    }
    // normalise position before scaling the position
    this.container.x -= width;
    this.container.y -= height;

    this.container.x *= multiplier;
    this.container.y *= multiplier;

    // return back to the position before normalisation
    this.container.x += width;
    this.container.y += height;
  }

  onKeyDown = (event) => {
    if (event.key == '+') {
      this.state.zoomLevel *= 2;
      this.scaleContainerPosition(2);
      this.updateTiles();
      this.redrawTiles();
    } else if (event.key == '-' && this.state.zoomLevel > 1) {
      this.state.zoomLevel = this.state.zoomLevel/2;
      this.scaleContainerPosition(1/2);
      this.updateTiles();
      this.redrawTiles();
    }
  }

  onMouseDown = (event) => {
    this.state.draggingEventId = event.data.identifier;
    this.state.draggingOrigin = event.data.getLocalPosition(this.container);
    this.state.dragged = false;
  }

  onMouseUp = (event) => {
    // hack to register double clicks in Pixi.js
    if (!this.state.dragged && Date.now() - this.state.mouseUpTs < 300) {
      this.state.zoomLevel *= 2;
      const { x, y } = event.data.global;
      this.scaleContainerPosition(2, x, y);
      this.updateTiles();
      this.redrawTiles();
    }

    this.state.mouseUpTs = Date.now();
    this.state.draggingEventId = null;
    this.state.draggingOrigin = null;
  }

  onMouseMove = (event) => {
    const { draggingEventId, draggingOrigin } = this.state;

    if (draggingEventId == event.data.identifier) {
      this.state.dragged = true;
      const newPosition = event.data.getLocalPosition(this.container.parent);
      this.container.x = newPosition.x - draggingOrigin.x;
      this.container.y = newPosition.y - draggingOrigin.y;
      this.updateTiles();
    }
  }
};

export default App;
