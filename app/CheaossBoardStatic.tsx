"use client";
import { ReactElement } from "react";

import CheaossSquare from "./CheaossSquare";

export default function CheaossBoardStatic({ pieces, locToPieceId } : { pieces: Map<string, ReactElement>, locToPieceId: Map<string, string>}) {
  // TODO: probably pass from above?

  // LOAD PIECES ATTEMPT 4
  const squares = [];
  for (let r = 7; r >= 0; r--) {
    for (let c = 0; c < 8; c++) {
      squares.push(<CheaossSquare key={`${r}-${c}`} row={r} col={c} piece={pieces.get(locToPieceId.get(`${r}-${c}`) || "")} />);
    }
  }

  return (
    <div className="grid grid-cols-[80px_80px_80px_80px_80px_80px_80px_80px] grid-rows-[80px_80px_80px_80px_80px_80px_80px_80px] items-center justify-items-center g-4">
      {squares}
    </div>
  );
}
