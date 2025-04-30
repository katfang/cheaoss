"use client";

import { useSortedMap } from "@reboot-dev/reboot-std-react/sorted-map";
import { PieceType } from "@/api/cheaoss/v1/cheaoss_pb";

export default function CheaossSquare({ gameId, row, col, piece } : { gameId: string, row: number, col: number, piece?: PieceType }) {
  const squareColor = ((row + col) % 2 === 0 ? "bg-white-square" : "bg-black-square") + " w-full h-full";
    useSortedMap({id: gameId});

  return (
    <div className={squareColor}>
    </div>
  );
}
