"use client";
import { useCheaoss, usePiece } from "../api/cheaoss/v1/cheaoss_rbt_react"

import CheaossSquare from "./CheaossSquare";
import Error from "./Error";
import Piece from "./Piece";

export default function CheaossBoard({ gameId } : { gameId: string }) {
  // TODO: probably pass from above?
  const cheaossRef = useCheaoss({ id: "singleton" });
  const boardRes = cheaossRef.useBoard();

  if (boardRes.response === undefined) {
    return <Error message="Still working" />;
  }

  // LOAD PIECES ATTEMPT 3
  const allPieces = boardRes.response.pieceIds.map((pieceId, index) =>
    <Piece key={pieceId} pieceId={pieceId} />
  );

  // LOAD PIECES ATTEMPT 1
  // if (boardRes.response?.pieceIds) {
  //   boardRes.response?.pieceIds.forEach(pieceId => {
  //     console.log("here", pieceId);
  //     const { response } = usePiece({ id: pieceId }).usePiece();
  //     pieces.push(response);
  //   });
  // }

  const squares = [];
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      squares.push(<CheaossSquare key={`${r}=${c}`} row={r} col={c} />);
    }
  }

  //  <Pieces pieceIds={boardRes.response?.pieceIds || []} />
  return (
    <div className="grid grid-cols-[40px_40px_40px_40px_40px_40px_40px_40px] grid-rows-[40px_40px_40px_40px_40px_40px_40px_40px] items-center justify-items-center g-4">
      {squares}
      {allPieces}
    </div>
  );
}
