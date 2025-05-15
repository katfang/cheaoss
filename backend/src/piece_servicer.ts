import { ReaderContext, TransactionContext, WriterContext } from "@reboot-dev/reboot";

import {
  InvalidMoveError,
  Location,
  LocationRequiredError,
  MoveRequest
} from "../../api/cheaoss/v1/move_pb.js"

import {
  LocPieceIndex,
  Piece,
  PieceType,
} from "../../api/cheaoss/v1/piece_rbt.js"

import { EmptyRequest } from "../../api/cheaoss/v1/util_pb.js"
import { Team } from "../../api/cheaoss/v1/cheaoss_pb.js";

const BOARD_SIZE = 1; 
const BACK_ROW: PieceType[] = [
  PieceType.ROOK,
  PieceType.KNIGHT,
  PieceType.BISHOP,
  PieceType.QUEEN,
  PieceType.KING,
  PieceType.BISHOP,
  PieceType.KNIGHT,
  PieceType.ROOK
];

export class PieceServicer extends Piece.Servicer {
  async makePiece(
    context: TransactionContext,
    state: Piece.State,
    request: Piece.State
  ) {
    if (request.loc === undefined) {
      throw new Piece.MakePieceAborted(new LocationRequiredError());
    }
    state.team = request.team;
    state.type = request.type;
    state.loc = request.loc;
    state.hasMoved = false;
    await pieceToLocIdRef(context.stateId, state.loc).set(
      context,
      { pieceId: context.stateId }
    );
    return {};
  }

  async piece(
    context: ReaderContext,
    state: Piece.State,
    request: EmptyRequest,
  ) {
    return state;
  }

  async movePiece(
    context: TransactionContext,
    state: Piece.State,
    request: MoveRequest
  ) {
    // Data validation check -- should not happen since queueMove does this check before adding it to the queue.
    if (request.start === undefined || request.end === undefined) {
      throw new Piece.MovePieceAborted(
        new InvalidMoveError({
          message: "Move requests must have a start and an end"
        })
      )
    }
    // check the piece is in the right place
    if (state.loc?.row !== request.start.row && state.loc?.col !== request.start.col) {
      throw new Piece.MovePieceAborted(
        new InvalidMoveError({
          message: "Piece not found at starting location."
        })
      );
    }

    const check = validateMovementPattern(state, request.end);
    if (check instanceof InvalidMoveError) {
      throw new Piece.MovePieceAborted(check);
    } else {
      // update the location
      state.loc = request.end;
      state.hasMoved = true;

      // update the idnex
      await pieceToLocIdRef(context.stateId, request.start).deleter(context);
      await pieceToLocIdRef(context.stateId, request.end).set(
        context,
        { pieceId: context.stateId }
      );
      return {};
    }
  }
}

enum MoveValidation {
  UNKNOWN = 0,
  INVALID,
  PASSED,

  // for pawns, this means *every* space must be empty
  // for other pieces, there can be a piece at the end.
  CHECK_NO_OBSTACLES,
  // a pawn can only move diagonally if it takes a piece or via en passant (ignoring en passant for now)
  CHECK_PAWN_DIAGONAL,
}

/**
 * This DOES NOT check if other pieces are in the way.
 */
export function validateMovementPattern(piece: Piece.State, end: Location, context?: ReaderContext): InvalidMoveError|MoveValidation {
  switch (piece.type as PieceType) {
    case PieceType.PAWN:
      // TODO: allow 2 spaces initially
      // TODO: allow eating on the diagonal
      // TODO: disallow moving forward if something else is there
      // can only move inc row by 1 if white, dec row by 1 if black.
      let direction = (piece.team === Team.WHITE) ? 1 : -1;
      if (piece.loc?.row === end.row - direction) {
        if (piece.loc?.col === end.col) {
          // moved one space
          return MoveValidation.CHECK_NO_OBSTACLES;
        } else if (Math.abs(piece.loc?.col - end.col) === 1) {
          // move diagonally
          return MoveValidation.CHECK_PAWN_DIAGONAL;
        }
      } else if (!piece.hasMoved && piece.loc?.row === end.row - (2*direction) && piece.loc?.col === end.col) {
        // moved two spaces
        return MoveValidation.CHECK_NO_OBSTACLES;
      }
      return  new InvalidMoveError({
        message: "Pawns must move forward in their own column."
      })
  }
  return MoveValidation.PASSED;
}

export function validateChessMove(piece: Piece.State, end: Location, context?: ReaderContext): InvalidMoveError|null {

  return null;
}

function pieceToLocIdRef(pieceId: string, loc: Location) {
  // clean abstraction wise, I hate the string-split, but it will in fact get us the game id
  let gameId = pieceId.split("-", 1)[0];
  let locId = `${gameId}-${loc.row}-${loc.col}`;
  return LocPieceIndex.ref(locId);
}


export class LocPieceIndexServicer extends LocPieceIndex.Servicer {
  async get(
    context: ReaderContext,
    state: LocPieceIndex.State,
    request: EmptyRequest
  ) {
    // Two possible responses for there not being an object:
    // * an error from reboot saying nothing at that index
    // * empty string for pieceId
    return state;
  }

  async set(
    context: WriterContext,
    state: LocPieceIndex.State,
    request: LocPieceIndex.State,
  ) {
    state.pieceId = request.pieceId;
    return {};
  }

  async deleter(
    context: WriterContext,
    state: LocPieceIndex.State,
    request: EmptyRequest
  ) {
    // !!! Reboot has no real delete, so the best we can do is set it to empty string
    state.pieceId = "";
    return {};
  }
}