"use client";
import { useState } from "react";
import { useCheaoss, Piece, Location, InvalidMoveError } from "../api/cheaoss/v1/cheaoss_rbt_react"

import CheaossSquare from "./CheaossSquare";
import { rcToLocKey, locToLocKey } from "./utils"
import { abort } from "process";

export default function CheaossBoard({
  gameId,
  playerId
} : {
  gameId: string,
  playerId: string
}) {
  // TODO: probably pass from above?
  const cheaossRef = useCheaoss({ id: gameId });
  const boardRes = cheaossRef.useBoard();
  const boardPieces = cheaossRef.useBoardPieces();
  const [startLoc, setStartLoc] = useState<Location | null>(null);
  const [endLoc, setEndLoc] = useState<Location | null>(null);

  if (boardRes.response === undefined || boardPieces.response === undefined) {
    return "still loading";
  }

  async function selectSquare(loc: Location) {
    if (startLoc === null) {
      setStartLoc(loc);
    } else if (endLoc === null) {
      setEndLoc(loc);
      let pieceId = locToPieceId.get(locToLocKey(startLoc));
      if (pieceId !== undefined) {
        const { aborted } = await cheaossRef.movePiece({
          playerId: playerId,
          pieceId: pieceId,
          start: startLoc,
          end: loc
        });
        if (aborted?.error instanceof InvalidMoveError) {
          alert(aborted.error.message);
        }
        setStartLoc(null);
        setEndLoc(null);
      }
    }
  }

  // TODO ??? is there a way of having this update by piece using usePiece, or nope, nah?
  let pieces = boardPieces.response?.pieces;
  let locToPieceId = new Map<string, string>();
  let pieceIdToState = new Map<string, Piece.State>();
  for (let pieceId in pieces) {
    locToPieceId.set(`${pieces[pieceId].loc?.row}-${pieces[pieceId].loc?.col}`, pieceId);
    pieceIdToState.set(pieceId, pieces[pieceId]);
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
