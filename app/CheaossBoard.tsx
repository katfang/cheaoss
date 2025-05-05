"use client";
import { ReactElement } from "react";
import { useCheaoss, usePiece, Piece, PieceType, Team } from "../api/cheaoss/v1/cheaoss_rbt_react"

import CheaossPiece from "./CheaossPiece";
import CheaossBoardStatic from "./CheaossBoardStatic";
import Error from "./Error";

export default function CheaossBoard({ gameId } : { gameId: string }) {
  // TODO: probably pass from above?
  const cheaossRef = useCheaoss({ id: "singleton" });
  const boardRes = cheaossRef.useBoard();

  // // LOAD PIECES ATTEMPT 4
  // const updatePiece = function(pieceId: string, oldPiece: Piece.State, newPiece: Piece.State ) {
  //   const newMap = new Map(piecesMap);
  //   // TODO: you could eat a piece or a pawn could be promoted
  //   newMap.delete(`${oldPiece.loc?.row}-${oldPiece.loc?.col}`);
  //   newMap.set(`${newPiece.loc?.row}-${newPiece.loc?.col}`, pieceId);
  //   setPiecesMap(newMap);
  // }

  if (boardRes.response === undefined) {
    return <Error message="Still working" />;
  }

  // LOAD PIECES ATTEMPT 4
  const pieceIdToReactComponent = new Map<string, ReactElement>();
  const pieceIdToOldState = new Map<string, Piece.State>();
  const locToPieceId = new Map<string, string>();
  boardRes.response.pieceIds.map( pieceId => {
    pieceIdToOldState.set(
      pieceId,
      new Piece.State({team: Team.TEAM_UNKNOWN, type: PieceType.PIECES_TYPE_UNKNOWN})
    );
    pieceIdToReactComponent.set(
      pieceId,
      <CheaossPiece key={pieceId} pieceId={pieceId} team={pieceIdToOldState.get(pieceId)?.team} />
    );
    // let piece = usePiece({ id: pieceId });
    // let { response } = piece.usePiece();
    // // TODO NEXT: I *think* the problem is if we're running for the very first time (creating the Cheaoss Pieces), and oldPiece=unknown,
    // // we're running into some set up issues where we're trying to set up CheaossPiece, but then we gotta update CheaossBoard
    // if (oldPiece && response && oldPiece.loc?.row != response.loc?.row && oldPiece.loc?.col !== response.loc?.col) {
    //   setOldPiece(response);
    //   updatePiece(pieceId, oldPiece, response);
    // }
  });

  return (
    <CheaossBoardStatic pieces={pieceIdToReactComponent} locToPieceId={locToPieceId} /> 
  );
}
