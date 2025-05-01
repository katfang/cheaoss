"use client";
import { Team, PieceType, usePiece } from "../api/cheaoss/v1/cheaoss_rbt_react"

// LOAD PIECES ATTEMPT 3
export default function Piece({ pieceId } : { pieceId: string }) {
  let piece = usePiece({ id: pieceId });
  let { response } = piece.usePiece();
  if (response === undefined) { return; }
  return (
    <div>
      {Team[response.team]}-{PieceType[response.type]}-{response.loc.row}-{response.loc.col}
    </div>
  )
}
