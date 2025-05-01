"use client";
import { useCheaoss, usePiece } from "../api/cheaoss/v1/cheaoss_rbt_react"

import CheaossSquare from "./CheaossSquare";

export default function CheaossBoard({ gameId } : { gameId: string }) {
  // TODO: probably pass from above?
  const cheaossRef = useCheaoss({ id: "singleton" });
  const { response } = cheaossRef.useGetBoard();
  console.log(response);

  const squares = [];
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      squares.push(<CheaossSquare key={`${r}=${c}`} row={r} col={c} />);
    }
  }

  return (
    <div className="grid grid-cols-[40px_40px_40px_40px_40px_40px_40px_40px] grid-rows-[40px_40px_40px_40px_40px_40px_40px_40px] items-center justify-items-center g-4">
      {squares}
    </div>
  );
}
