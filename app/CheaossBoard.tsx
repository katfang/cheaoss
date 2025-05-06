"use client";
import { useCheaoss, Piece, PieceType, Team } from "../api/cheaoss/v1/cheaoss_rbt_react"

import CheaossBoardStatic from "./CheaossBoardStatic";
import Error from "./Error";

export default function CheaossBoard({ gameId } : { gameId: string }) {
  // TODO: probably pass from above?
  const cheaossRef = useCheaoss({ id: "singleton" });
  const boardRes = cheaossRef.useBoard();
  const boardPieces = cheaossRef.useBoardPieces();

  if (boardPieces.response === undefined) {
    return;
  }

  // TODO ??? is there a way of having this update by piece using usePiece, or nope, nah?
  let pieces = boardPieces.response?.pieces;
  let newLocs = new Map<string, string>();
  let newStates = new Map<string, Piece.State>();
  for (let pieceId in pieces) {
    newLocs.set(`${pieces[pieceId].loc?.row}-${pieces[pieceId].loc?.col}`, pieceId);
    newStates.set(pieceId, pieces[pieceId]);
  }

  if (boardRes.response === undefined) {
    return <Error message="Still working" />;
  }

  return (
    <CheaossBoardStatic pieceIdToState={newStates} locToPieceId={newLocs} />
  );
}
