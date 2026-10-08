import { readFile, writeFile } from "node:fs/promises";
import { Minesweeper } from "./minesweeper.js";

export async function saveGame(path, game) {
  await writeFile(
    path,
    JSON.stringify(game.getState(), null, 2),
    "utf8",
  );
}

export async function loadGame(path) {
  const data = JSON.parse(await readFile(path, "utf8"));
  return Minesweeper.fromState(data);
}
