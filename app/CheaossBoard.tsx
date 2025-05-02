"use client";
import { useState } from "react";
import { useCheaoss, usePiece, Piece } from "../api/cheaoss/v1/cheaoss_rbt_react"

import CheaossPiece from "./CheaossPiece";
import CheaossSquare from "./CheaossSquare";
import Error from "./Error";

export default function CheaossBoard({ gameId } : { gameId: string }) {
  // TODO: probably pass from above?
  const cheaossRef = useCheaoss({ id: "singleton" });
  const boardRes = cheaossRef.useBoard();
  const [piecesMap, setPiecesMap] = useState(new Map());

  // LOAD PIECES ATTEMPT 4
  const updatePiece = function(pieceId: string, oldPiece: Piece.State, newPiece: Piece.State ) {
    const newMap = new Map(piecesMap);
    // TODO: you could eat a piece or a pawn could be promoted
    newMap.delete(`${oldPiece.loc?.row}-${oldPiece.loc?.col}`);
    newMap.set(`${newPiece.loc?.row}-${newPiece.loc?.col}`, pieceId);
    setPiecesMap(newMap);
  }

  if (boardRes.response === undefined) {
    return <Error message="Still working" />;
  }

  // LOAD PIECES ATTEMPT 4
  const pieces = Object.fromEntries(boardRes.response.pieceIds.map( pieceId =>
    [
      pieceId, <CheaossPiece key={pieceId} pieceId={pieceId} updatePiece={updatePiece} />
    ]
  ));

  // LOAD PIECES ATTEMPT 3
  // const allPieces = boardRes.response.pieceIds.map(pieceId =>
  //   <CheaossPiece key={pieceId} pieceId={pieceId} />
  // );

  // LOAD PIECES ATTEMPT 1
  // if (boardRes.response?.pieceIds) {
  //   boardRes.response?.pieceIds.forEach(pieceId => {
  //     console.log("here", pieceId);
  //     const { response } = usePiece({ id: pieceId }).usePiece();
  //     pieces.push(response);
  //   });
  // }

  // LOAD PIECES ATTEMPT 4
  const squares = [];
  for (let r = 7; r >= 0; r--) {
    for (let c = 0; c < 8; c++) {
      squares.push(<CheaossSquare key={`${r}=${c}`} gameId={gameId} row={r} col={c} piece={pieces[piecesMap.get(`${r}-${c}`)]} />);
    }
  }

  //  <Pieces pieceIds={boardRes.response?.pieceIds || []} />
  return (
    <div className="grid grid-cols-[80px_80px_80px_80px_80px_80px_80px_80px] grid-rows-[80px_80px_80px_80px_80px_80px_80px_80px] items-center justify-items-center g-4">
      {squares}

      { /* this triggers the pieces into rendering, but actually like, wtf --> */ }
      {Object.values(pieces)}
    </div>
  );
}
