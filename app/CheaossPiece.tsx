"use client";
import { useState } from "react";
import { Team, PieceType, usePiece, Piece } from "../api/cheaoss/v1/cheaoss_rbt_react"

// LOAD PIECES ATTEMPT 3
export default function CheaossPiece({ pieceId, team, pieceType } : { pieceId: string, team?: Team, pieceType?: PieceType }) {
  if (team && pieceType) {
    return (
      <div>
        {team}-{pieceType}
      </div>
    )
  } else {
    return;
  } 
}
