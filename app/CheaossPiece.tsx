"use client";
import { useState } from "react";
import { Team, PieceType, usePiece, Piece } from "../api/cheaoss/v1/cheaoss_rbt_react"

// LOAD PIECES ATTEMPT 3
export default function CheaossPiece({ pieceId, updatePiece } : { pieceId: string, updatePiece: Function}) {
  const [oldPiece, setOldPiece] = useState<Piece.State|undefined>(new Piece.State({team: Team.TEAM_UNKNOWN, type: PieceType.PIECES_TYPE_UNKNOWN}));
  let piece = usePiece({ id: pieceId });
  let { response } = piece.usePiece();
  if (response === undefined) { return; }
  // TODO NEXT: I *think* the problem is if we're running for the very first time (creating the Cheaoss Pieces), and oldPiece=unknown,
  // we're running into some set up issues where we're trying to set up CheaossPiece, but then we gotta update CheaossBoard
  if (oldPiece && response && oldPiece.loc?.row != response.loc?.row && oldPiece.loc?.col !== response.loc?.col) {
    setOldPiece(response);
    updatePiece(pieceId, oldPiece, response);
  }
  return (
    <div>
      {pieceId}
      {Team[response.team]}-{PieceType[response.type]}
    </div>
  )
}
