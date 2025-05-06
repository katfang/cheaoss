"use client";

import { Piece, PieceType, Team } from "../api/cheaoss/v1/cheaoss_rbt_react"

export default function CheaossSquare({ row, col, piece } : { row: number, col: number, piece?: Piece.State}) {
  const squareColor = ((row + col) % 2 === 0 ? "bg-black-square" : "bg-white-square") + " w-full h-full";
  const pieceRep = piece ? `${Team[piece.team]} ${PieceType[piece.type]}` : '';

  return (
    <div className={squareColor}>
      {pieceRep}
    </div>
  );
}
