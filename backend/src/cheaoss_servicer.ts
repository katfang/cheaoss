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
  CheaossState,
  PieceMessage,
  BoardPiecesResponse,
} from "../../api/cheaoss/v1/cheaoss_rbt.js";
import { SortedMap } from "@reboot-dev/reboot-std/collections/sorted_map.js";
import { Reader } from "@reboot-dev/reboot-react";

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

function pieceId(gameId: string, team: Team, startingRow: number, startingCol: number, index: number, pieceType: PieceType): string {
  let teamStr = "u"; // Unknown
  switch(team as Team) {
    case Team.WHITE:
      teamStr = "w";
      break;
    case Team.BLACK:
      teamStr = "b";
      break;
    case Team.TEAM_UNKNOWN:
    default:
      teamStr = "u";
      break;
  }
  switch(pieceType as PieceType) {
    case PieceType.PAWN:
      return `${gameId}-${teamStr}-${startingRow}-${startingCol}-p${index}`;
    default:
      return `${gameId}-${teamStr}-${startingRow}-${startingCol}-${index}`;
  }
}

function pieceIds(gameId: string, startingRow: number, startingCol: number): string[] {
  let keys: string[] = [];
  for (const [index, item] of BACK_ROW.entries()) {
    keys.push(pieceId(gameId, Team.WHITE, startingRow, startingCol, index, item));
    keys.push(pieceId(gameId, Team.WHITE, startingRow, startingCol, index, PieceType.PAWN));
    keys.push(pieceId(gameId, Team.BLACK, startingRow, startingCol, index, item));
    keys.push(pieceId(gameId, Team.BLACK, startingRow, startingCol, index, PieceType.PAWN));
  }
  return keys;
}

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
    for (const [index, item] of BACK_ROW.entries()) {
      await Piece.ref(pieceId(stateId, Team.WHITE, startingRow, startingCol, index, item))
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
      await Piece.ref(pieceId(stateId, Team.WHITE, startingRow, startingCol, index, PieceType.PAWN))
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
      await Piece.ref(pieceId(stateId, Team.BLACK, startingRow, startingCol, index, item))
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
      await Piece.ref(pieceId(stateId, Team.BLACK, startingRow, startingCol, index, PieceType.PAWN))
        .idempotently()
        .makePiece(
          context,
          new Piece.State({
            team: Team.BLACK,
            type: PieceType.PAWN,
            loc: {
              row: startingRow+8-2,
              col: startingCol+index
            }
          })
        );
    }
    return pieceIds(stateId, startingRow, startingCol);
  }

  async board(
    context: ReaderContext,
    state: Cheaoss.State,
    request: EmptyRequest,
  ) {
    return state;
  }

  async boardPieces(
    context: ReaderContext,
    state: CheaossState,
    request: EmptyRequest
  ) {
    const response = new BoardPiecesResponse();
    // TODO: is there a way to create this
    // const pieces = new Map<string, PieceMessage>();

    let keysList: string[][] = [];
    // make the new subboard
    for (let boardRow: number = 0; boardRow < BOARD_SIZE; boardRow++) {
      for (let boardCol: number = 0; boardCol < BOARD_SIZE; boardCol++) {
        const subboardPieceIds = pieceIds(context.stateId, boardRow, boardCol);
        for (const subboardPieceId of subboardPieceIds) {
          response.pieces[subboardPieceId] = await Piece.ref(subboardPieceId).piece(context);
        }
      }
    }
    return response;
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
