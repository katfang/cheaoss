"use client";

import { Piece, PieceType, Team } from "../api/cheaoss/v1/cheaoss_rbt_react"

const UNICODE_PIECES = new Map<Team, Map<PieceType, string>>();
const whitePieces = new Map<PieceType, string>();
whitePieces.set(PieceType.PIECES_TYPE_UNKNOWN, "X");
whitePieces.set(PieceType.PAWN, "♙");
whitePieces.set(PieceType.BISHOP, "♗");
whitePieces.set(PieceType.KNIGHT, "♘");
whitePieces.set(PieceType.ROOK, "♖");
whitePieces.set(PieceType.QUEEN, "♕");
whitePieces.set(PieceType.KING, "♔");
UNICODE_PIECES.set(Team.WHITE, whitePieces);
const blackPieces = new Map<PieceType, string>();
blackPieces.set(PieceType.PIECES_TYPE_UNKNOWN, "X");
blackPieces.set(PieceType.PAWN, "♟");
blackPieces.set(PieceType.BISHOP, "♝");
blackPieces.set(PieceType.KNIGHT, "♞");
blackPieces.set(PieceType.ROOK, "♜");
blackPieces.set(PieceType.QUEEN, "♛");
blackPieces.set(PieceType.KING, "♚");
UNICODE_PIECES.set(Team.BLACK, blackPieces);

export default function CheaossSquare({ row, col, piece } : { row: number, col: number, piece?: Piece.State}) {
  const squareColor = ((row + col) % 2 === 0 ? "bg-black-square" : "bg-white-square") + " w-full h-full";
  const pieceRep = piece ? UNICODE_PIECES.get(piece.team)?.get(piece.type) : '';

  return (
    <div className={squareColor + ' text-7xl text-center'}>
      {pieceRep}
    </div>
  );
}
