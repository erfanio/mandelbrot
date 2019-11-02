import * as Pixi from 'pixi.js';
import { range } from './utility';
import { getTexture, tileCoords } from './mandelbrot';

const TILE_SIZE = 50;

class App {
  container = null
  app = null
  tiles = new Map()
  spritePool = []
  loadingTexture = null;
  state = {
    draggingEventId: null,
    draggingOrigin: null,
    tilesRows: null,
    tilesCols: null,
    zoomLevel: 1,
  }

  constructor() {
    this.app = new Pixi.Application({
      autoDensity: true,
      resizeTo: document.body,
    });
    document.body.appendChild(this.app.view);

    this.container = new Pixi.Container();
    this.app.stage.addChild(this.container);
    this.container.interactive = true;
    this.container.buttonMode = true;
    this.container
        .on('pointerdown', this.onDragStart)
        .on('pointerup', this.onDragEnd)
        .on('pointerupoutside', this.onDragEnd)
        .on('pointermove', this.onDragMove);
    window.addEventListener('keydown', this.onKeyDown, false);

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

      }
    }

    requestAnimationFrame(() => {
      for (let row of range(rowMin, rowMax+1)) {
        for (let col of range(colMin, colMax+1)) {
          const index = this.tileIndex(row, col);
          const sprite = this.tiles.get(index);
          const { minX, minY, pixelSize } = tileCoords(row, col, this.state.zoomLevel, TILE_SIZE);
          getTexture(sprite, minX, minY, pixelSize, TILE_SIZE).then((texture) => {
              // check if sprite is still in the same position before adding texture
              if (this.tiles.get(index) == sprite) {
                sprite.texture = texture;
              }
            });
        }
      }
    });
  }

  getLoadingTexture = () => {
    if (!this.loadingTexture) {
      const text = new Pixi.Text('Loading', { fontSize: 10, fill: '#ffffff' });
      this.loadingTexture = new Pixi.RenderTexture.create(TILE_SIZE, TILE_SIZE);
      this.app.renderer.render(text, this.loadingTexture);
    }
    return this.loadingTexture;
  }

  addSprite = async (row, col) => {
    const index = this.tileIndex(row, col);
    if (this.tiles.has(index)) return;

    // setup the sprite and set loading texture
    const sprite = this.spritePool.pop();
    sprite.texture = this.getLoadingTexture();
    sprite.x = col * TILE_SIZE;
    sprite.y = row * TILE_SIZE;
    this.container.addChild(sprite);
    this.tiles.set(index, sprite);

    // generate mandelbrot texture
    const { minX, minY, pixelSize } = tileCoords(row, col, this.state.zoomLevel, TILE_SIZE);
    const texture = await getTexture(sprite, minX, minY, pixelSize, TILE_SIZE);
    // check if sprite is still in the same position before adding texture
    if (this.tiles.get(index) == sprite) {
      sprite.texture = texture;
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

  onKeyDown = (event) => {
    if (event.key == '+') {
      this.state.zoomLevel++;
      this.redrawTiles();
    } else if (event.key == '-') {
      this.state.zoomLevel--;
      this.redrawTiles();
    }
  }

  onDragStart = (event) => {
    this.state.draggingEventId = event.data.identifier;
    this.state.draggingOrigin = event.data.getLocalPosition(this.container);
  }

  onDragEnd = () => {
    this.state.draggingEventId = null;
    this.state.draggingOrigin = null;
  }

  onDragMove = (event) => {
    const { draggingEventId, draggingOrigin } = this.state;

    if (draggingEventId == event.data.identifier) {
      const newPosition = event.data.getLocalPosition(this.container.parent);
      this.container.x = newPosition.x - draggingOrigin.x;
      this.container.y = newPosition.y - draggingOrigin.y;
      this.updateTiles();
    }
  }
};

export default App;
