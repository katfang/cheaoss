import { ReaderContext, TransactionContext, WriterContext } from "@reboot-dev/reboot";

import {
  AssignTeamRequest,
  EmptyRequest,
  Cheaoss,
  InitGameRequest,
  Location,
  Piece,
  PieceType,
  Team,
} from "../../api/cheaoss/v1/cheaoss_rbt.js";
import { SortedMap } from "@reboot-dev/reboot-std/collections/sorted_map.js";
import { Reader } from "@reboot-dev/reboot-react";

const BOARD_SIZE = 1; 

export class CheaossServicer extends Cheaoss.Servicer {
  async assignTeam(
    context: WriterContext,
    state: Cheaoss.State,
    request: AssignTeamRequest 
  ) {
    console.log("team assignment", state.nextTeamAssignment);
    // if team is unknown, set it to white, otherwise use the team as expected
    const team = (state.nextTeamAssignment === Team.TEAM_UNKNOWN) ? Team.WHITE : state.nextTeamAssignment;
    state.nextTeamAssignment = (team == Team.WHITE) ? Team.BLACK : Team.WHITE;
    return { team: team };
  }

  async initGame(
    context: TransactionContext,
    state: Cheaoss.State,
    request: InitGameRequest
  ) {
    let keysList: string[][] = [];
    // make the new subboard
    for (let boardRow: number = 0; boardRow < BOARD_SIZE; boardRow++) {
      for (let boardCol: number = 0; boardCol < BOARD_SIZE; boardCol++) {
        keysList.push(await this.makeInitialBoardPieces(context, context.stateId, boardRow*8, boardCol*8));
      }
    }

    state.pieceIds = keysList.flat();

    return {};
  }

  async makeInitialBoardPieces(
    context: TransactionContext,
    stateId: string,
    startingRow: number,
    startingCol: number,
  ) {
    let keys: string[] = [];
    let backRow: PieceType[] = [
      PieceType.ROOK,
      PieceType.KNIGHT,
      PieceType.BISHOP,
      PieceType.QUEEN,
      PieceType.KING,
      PieceType.BISHOP,
      PieceType.KNIGHT,
      PieceType.ROOK
    ];

    for (const [index, item] of backRow.entries()) {
      keys.push(`${stateId}-w-${startingRow}-${startingCol}-${index}`);
      await Piece.ref(`${stateId}-w-${startingRow}-${startingCol}-${index}`)
        .idempotently()
        .makePiece(
          context,
          new Piece.State({
            team: Team.WHITE,
            type: item,
            loc: {
              row: startingRow,
              col: startingCol+index
            }
          })
        );
      keys.push(`${stateId}-w-${startingRow}-${startingCol}-p${index}`);
      await Piece.ref(`${stateId}-w-${startingRow}-${startingCol}-p${index}`)
        .idempotently()
        .makePiece(
          context,
          new Piece.State({
            team: Team.WHITE,
            type: PieceType.PAWN,
            loc: {
              row: startingRow+1,
              col: startingCol+index
            }
          })
        );
      keys.push(`${stateId}-b-${startingRow}-${startingCol}-${index}`);
      await Piece.ref(`${stateId}-b-${startingRow}-${startingCol}-${index}`)
        .idempotently()
        .makePiece(
          context,
          new Piece.State({
            team: Team.BLACK,
            type: item,
            loc: {
              row: startingRow+8-1,
              col: startingCol+index
            }
          })
        );
      keys.push(`${stateId}-b-${startingRow}-${startingCol}-p${index}`);
      await Piece.ref(`${stateId}-b-${startingRow}-${startingCol}-p${index}`)
        .idempotently()
        .makePiece(
          context,
          new Piece.State({
            team: Team.BLACK,
            type: PieceType.PAWN,
            loc: {
              row: startingRow+8-1,
              col: startingCol+index
            }
          })
        );
    }
    return keys;
  }

  async board(
    context: ReaderContext,
    state: Cheaoss.State,
    request: EmptyRequest,
  ) {
    return state;
  }
}

export class PieceServicer extends Piece.Servicer {
  async makePiece(
    context: WriterContext,
    state: Piece.State,
    request: Piece.State
  ) {
    state.team = request.team;
    state.type = request.type;
    state.loc = request.loc;
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
    context: WriterContext,
    state: Piece.State,
    request: Location
  ) {
    state.loc = request;
    return {};
  }
}
