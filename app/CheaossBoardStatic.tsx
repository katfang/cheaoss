"use client";
import { useState } from 'react';
import { Piece, Location } from "../api/cheaoss/v1/cheaoss_rbt_react"
import { rcToLocKey, locToLocKey } from "./utils"

import CheaossSquare from "./CheaossSquare";

export default function CheaossBoardStatic({ pieceIdToState, locToPieceId, queueMove } : { pieceIdToState: Map<string, Piece.State>, locToPieceId: Map<string, string>, queueMove: (pieceId: string, start: Location, end: Location) => void}) {
  const [startLoc, setStartLoc] = useState<Location | null>(null);
  const [endLoc, setEndLoc] = useState<Location | null>(null);

  function selectSquare(loc: Location) {
    if (startLoc === null) {
      setStartLoc(loc);
    } else if (endLoc === null) {
      setEndLoc(loc);
      let pieceId = locToPieceId.get(locToLocKey(startLoc));
      if (pieceId !== undefined) {
        queueMove(
          pieceId,
          startLoc,
          loc
        );
      }
      // TODO: else, error
    }
  }

  const squares = [];
  for (let r = 7; r >= 0; r--) { // in chess, we want 0,0 to be the bottom left corner
    for (let c = 0; c < 8; c++) {
      let piece = pieceIdToState.get(
        locToPieceId.get(rcToLocKey(r, c)) || ""
      );
      squares.push(<CheaossSquare
        key={rcToLocKey(r, c)}
        row={r}
        col={c}
        piece={piece}
        onSelect={ (piece !== undefined || startLoc !== null) ? () => selectSquare(new Location({row: r, col: c})) : undefined }
        isStart={startLoc !== null ? (startLoc.row == r && startLoc.col == c) : false}
        isEnd={endLoc !== null ? (endLoc.row == r && endLoc.col == c) : false}
      />);
    }
  }

  return (
    <div className="grid grid-cols-[80px_80px_80px_80px_80px_80px_80px_80px] grid-rows-[80px_80px_80px_80px_80px_80px_80px_80px] items-center justify-items-center g-4">
      {squares}
    </div>
  );
}
