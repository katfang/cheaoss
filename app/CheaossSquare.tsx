"use client";

import CheaossPiece from "./CheaossPiece";

export default function CheaossSquare({ row, col, piece } : { gameId: string, row: number, col: number, piece?: CheaossPiece }) {
  const squareColor = ((row + col) % 2 === 0 ? "bg-black-square" : "bg-white-square") + " w-full h-full";

  return (
    <div className={squareColor}>
      {piece}
    </div>
  );
}
