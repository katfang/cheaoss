"use client";
import { useState, useReducer, ReactElement } from "react";
import { useCheaoss, Piece, InitialBoardResponse } from "../api/cheaoss/v1/cheaoss_rbt_react"

import CheaossPiece from "./CheaossPiece";
import CheaossSquare from "./CheaossSquare";

function pieceReducer(piecesMap: Map<string, string>, action: any) {
  let newMap = null;
  switch(action.type) {
    case 'update':
      newMap = new Map(piecesMap);
      if (action.oldPiece !== undefined) {
        newMap.delete(`${action.oldPiece.loc?.row}-${action.oldPiece.loc?.col}`);
      }
      newMap.set(`${action.newPiece.loc?.row}-${action.newPiece.loc?.col}`, action.pieceId);
      return newMap;
    case 'initial':
      newMap = new Map();
      for (let pieceId in action.pieces) {
        newMap.set(`${action.pieces[pieceId].loc?.row}-${action.pieces[pieceId].loc?.col}`, pieceId);
      }
      return newMap;
    default:
      throw Error("Error in pieceReducer", action);
  }
}

export default function CheaossBoard({ gameId } : { gameId: string }) {
  // TODO: probably pass from above?
  const cheaossRef = useCheaoss({ id: "singleton" });
  const boardRes = cheaossRef.useBoard();
  const initialBoard = cheaossRef.useInitialBoard();
  const [piecesMap, setPiecesMap] = useState(new Map());
  const [locToPieceId, dispatch] = useReducer(pieceReducer, new Map<string, string>());

  if (boardRes.response === undefined || initialBoard.response === undefined) {
    return "Still Loading";
  }

  // LOAD PIECES ATTEMPT 4
  const updatePiece = function(pieceId: string, oldPiece: Piece.State, newPiece: Piece.State ) {
    const newMap = new Map(piecesMap);
    // TODO: you could eat a piece or a pawn could be promoted
    newMap.delete(`${oldPiece.loc?.row}-${oldPiece.loc?.col}`);
    newMap.set(`${newPiece.loc?.row}-${newPiece.loc?.col}`, pieceId);
    setPiecesMap(newMap);
  }

  // LOAD PIECES ATTEMPT 4
  const pieces = new Map<string, ReactElement>();
  boardRes.response.pieceIds.forEach( pieceId =>
    pieces.set(
      pieceId,
      <CheaossPiece key={pieceId} pieceId={pieceId} updatePiece={updatePiece} dispatchUpdate={dispatch} />
    )
  );

  // initialze the pieces
  // TODO ... we actually only want to do this the first time and NEVER again ... should this be in a UseEffect?

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
      squares.push(<CheaossSquare key={`${r}=${c}`} gameId={gameId} row={r} col={c} piece={pieces.get(locToPieceId.get(`${r}-${c}`) || "")} />);
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
