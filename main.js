import { access } from "node:fs/promises";

import { Minesweeper } from "./minesweeper.js";
import { loadGame, saveGame } from "./state.js";
import { Slack } from "./slack.js";

const STATE_PATH = process.env.SLAMINE_STATE ?? "./state.json";

const WIDTH = Number(process.env.SLAMINE_WIDTH ?? 9);
const HEIGHT = Number(process.env.SLAMINE_HEIGHT ?? 9);
const MINE_COUNT = Number(process.env.SLAMINE_MINES ?? 10);

function renderMap(game) {
  const state = game.getState();

  const numbers = [
    ":white_large_square:",
    ":one:",
    ":two:",
    ":three:",
    ":four:",
    ":five:",
    ":six:",
    ":seven:",
    ":eight:",
  ];

  const coordinates = [
    ":0:",
    ":1:",
    ":2:",
    ":3:",
    ":4:",
    ":5:",
    ":6:",
    ":7:",
    ":8:",
  ];

  const lines = [
    [
      ":black:",
      ...coordinates,
    ].join(""),
  ];

  for (let y = 0; y < state.height; y++) {
    const cells = state.board[y].map((cell) => {
      if (cell.mine && cell.opened) {
        return ":boom:";
      }

      if (cell.flagged) {
        return ":triangular_flag_on_post:";
      }

      if (!cell.opened) {
        return ":hash:";
      }

      return numbers[cell.adjacentMines];
    });

    lines.push([
      coordinates[y],
      ...cells,
    ].join(""));
  }

  return lines.join("\n");
}

async function loadOrCreateGame() {
  try {
    await access(STATE_PATH);
    return await loadGame(STATE_PATH);
  } catch {
    return new Minesweeper(WIDTH, HEIGHT, MINE_COUNT);
  }
}

async function main() {
  let game = await loadOrCreateGame();

  const slack = new Slack({
    width: game.width,
    height: game.height,
  });

  await slack.postNewMap(renderMap(game));

  while (true) {
    if (game.state !== "playing") {
      await slack.postMap(renderMap(game));
      break;
    }

    const input = await slack.waitForInput();

    if (input.type === "reset") {
      game = new Minesweeper(WIDTH, HEIGHT, MINE_COUNT);

      await saveGame(STATE_PATH, game);

      slack.width = game.width;
      slack.height = game.height;

      await slack.postNewMap(renderMap(game));

      continue;
    }

    let changed;

    if (input.action === "f") {
      changed = game.flag(input.column, input.row);
    } else {
      changed = game.open(input.column, input.row);
    }

    if (!changed) {
      continue;
    }

    await saveGame(STATE_PATH, game);
    await slack.postMap(renderMap(game));
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

