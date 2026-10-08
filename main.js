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

  const header = [
    "   ",
    ...Array.from(
      { length: state.width },
      (_, x) => String(x).padStart(2, " "),
    ),
  ].join(" ");

  const lines = [header];

  for (let y = 0; y < state.height; y++) {
    const cells = state.board[y].map((cell) => {
      if (cell.mine && cell.opened) {
        return "*";
      }

      if (cell.flagged) {
        return "F";
      }

      if (!cell.opened) {
        return "#";
      }

      if (cell.adjacentMines === 0) {
        return " ";
      }

      return String(cell.adjacentMines);
    });

    lines.push(
      `${String(y).padStart(2, " ")} ${cells
        .map((cell) => cell.padStart(2, " "))
        .join(" ")}`,
    );
  }

  return `\`\`\`\n${lines.join("\n")}\n\`\`\``;
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
  const game = await loadOrCreateGame();

  const slack = new Slack({
    width: game.width,
    height: game.height,
  });

  while (game.state === "playing") {
    await slack.postMap(renderMap(game));

    const input = await slack.waitForInput();

    let changed;

    if (input.action === "f") {
      changed = game.flag(input.column, input.row);
    } else {
      changed = game.open(input.column, input.row);
    }

    if (changed) {
      await saveGame(STATE_PATH, game);
    }
  }

  await slack.postMap(renderMap(game));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
