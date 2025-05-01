"use client";
import { usePiece } from "../api/cheaoss/v1/cheaoss_rbt_react"

export default function Pieces({ pieceIds } : { pieceIds: string[] }) {
  let pieces = pieceIds.map(pieceId => {
    usePiece({ id: pieceId }).usePiece();
  });
  console.log(pieces);
  return (
    <div>{pieces}</div>
  )
}
