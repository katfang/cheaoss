"use client";
import { ReactElement, useEffect, useState } from "react";
import { useCheaoss, Piece, PieceType, Team } from "../api/cheaoss/v1/cheaoss_rbt_react"

import CheaossPiece from "./CheaossPiece";
import CheaossBoardStatic from "./CheaossBoardStatic";
import Error from "./Error";

export default function CheaossBoard({ gameId } : { gameId: string }) {
  // TODO: probably pass from above?
  const cheaossRef = useCheaoss({ id: "singleton" });
  const boardRes = cheaossRef.useBoard();
  const [locToPieceId, setLocToPieceId] = useState(new Map<string, string>());
  const [pieceIdToOldState, setPieceIdToOldState] = useState(new Map<string, Piece.State>());
  const [pieceIdToReactComponent, setPieceIdToReactComponent] = useState(new Map<string, ReactElement>());

  useEffect(() => {
    async function fetchInitialPieces() {
      const initialBoardResp = await cheaossRef.initialBoard();
      if (initialBoardResp === undefined) {
        return;
      }
      let pieces = initialBoardResp.response?.pieces;
      let newLocs = new Map<string, string>();
      let pieceStates = new Map<string, Piece.State>();
      let reactPieces = new Map<string, ReactElement>();
      for (let pieceId in pieces) {
        newLocs.set(`${pieces[pieceId].loc?.row}-${pieces[pieceId].loc?.col}`, pieceId);
        pieceStates.set(pieceId, pieces[pieceId]);
        reactPieces.set(
          pieceId,
          <CheaossPiece key={pieceId} pieceId={pieceId} team={pieces[pieceId].team} pieceType={pieces[pieceId].type} />
        );
      }
      setLocToPieceId(newLocs);
      setPieceIdToOldState(pieceStates);
      setPieceIdToReactComponent(reactPieces);
    }
    fetchInitialPieces();
  }, []);

  if (boardRes.response === undefined) {
    return <Error message="Still working" />;
  }

  return (
    <CheaossBoardStatic pieces={pieceIdToReactComponent} locToPieceId={locToPieceId} /> 
  );
}
