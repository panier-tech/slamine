export class Minesweeper {
  constructor(width, height, mineCount) {
    if (width <= 0 || height <= 0) {
      throw new Error("Invalid board size");
    }

    if (mineCount < 0 || mineCount >= width * height) {
      throw new Error("Invalid mine count");
    }

    this.width = width;
    this.height = height;
    this.mineCount = mineCount;
    this.state = "playing";

    this.board = Array.from({ length: height }, () =>
      Array.from({ length: width }, () => ({
        mine: false,
        opened: false,
        flagged: false,
        adjacentMines: 0,
      })),
    );

    this.#placeMines();
    this.#calculateNumbers();
  }

  static fromState(state) {
    const game = new Minesweeper(
      state.width,
      state.height,
      state.mineCount,
    );

    game.state = state.state;
    game.board = state.board;

    return game;
  }


  open(x, y) {
    if (!this.#inside(x, y) || this.state !== "playing") {
      return false;
    }

    const cell = this.board[y][x];

    if (cell.opened || cell.flagged) {
      return false;
    }

    if (cell.mine) {
      cell.opened = true;
      this.state = "lost";
      this.#openMines();
      return true;
    }

    this.#open(x, y);
    this.#checkWin();

    return true;
  }

  flag(x, y) {
    if (!this.#inside(x, y) || this.state !== "playing") {
      return false;
    }

    const cell = this.board[y][x];

    if (cell.opened) {
      return false;
    }

    cell.flagged = !cell.flagged;

    return true;
  }

  getState() {
    return {
      width: this.width,
      height: this.height,
      mineCount: this.mineCount,
      state: this.state,
      board: this.board.map((row) =>
        row.map((cell) => ({
          mine: cell.mine,
          opened: cell.opened,
          flagged: cell.flagged,
          adjacentMines: cell.adjacentMines,
        })),
      ),
    };
  }

  #placeMines() {
    const positions = Array.from(
      { length: this.width * this.height },
      (_, i) => i,
    );

    for (let i = positions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [positions[i], positions[j]] = [positions[j], positions[i]];
    }

    for (const position of positions.slice(0, this.mineCount)) {
      const x = position % this.width;
      const y = Math.floor(position / this.width);

      this.board[y][x].mine = true;
    }
  }

  #calculateNumbers() {
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (this.board[y][x].mine) {
          continue;
        }

        let count = 0;

        for (const [nx, ny] of this.#neighbors(x, y)) {
          if (this.board[ny][nx].mine) {
            count++;
          }
        }

        this.board[y][x].adjacentMines = count;
      }
    }
  }

  #open(x, y) {
    const cell = this.board[y][x];

    if (cell.opened || cell.flagged || cell.mine) {
      return;
    }

    cell.opened = true;

    if (cell.adjacentMines !== 0) {
      return;
    }

    for (const [nx, ny] of this.#neighbors(x, y)) {
      this.#open(nx, ny);
    }
  }

  #openMines() {
    for (const row of this.board) {
      for (const cell of row) {
        if (cell.mine) {
          cell.opened = true;
        }
      }
    }
  }

  #checkWin() {
    for (const row of this.board) {
      for (const cell of row) {
        if (!cell.mine && !cell.opened) {
          return;
        }
      }
    }

    this.state = "won";
  }

  #neighbors(x, y) {
    const result = [];

    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) {
          continue;
        }

        const nx = x + dx;
        const ny = y + dy;

        if (this.#inside(nx, ny)) {
          result.push([nx, ny]);
        }
      }
    }

    return result;
  }

  #inside(x, y) {
    return x >= 0 && x < this.width && y >= 0 && y < this.height;
  }
}
