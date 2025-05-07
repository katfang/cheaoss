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
  BoardPiecesResponse,
  MoveRequest,
  InvalidMoveError,
} from "../../api/cheaoss/v1/cheaoss_rbt.js";

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
    // if we've seen the player before, return their existing team
    if (state.players[request.playerId] !== undefined) {
      return { team: state.players[request.playerId] };
    }

    // if team is unknown, set it to white, otherwise use the team as expected
    const team = (state.nextTeamAssignment === Team.TEAM_UNKNOWN) ? Team.WHITE : state.nextTeamAssignment;
    state.nextTeamAssignment = (team == Team.WHITE) ? Team.BLACK : Team.WHITE;
    state.players[request.playerId] = team;
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

  async movePiece(
    context: TransactionContext,
    state: Cheaoss.State,
    request: MoveRequest
  ) {
    // TODO ??? I thought this could be a writer because it only calls one write?
    // get the piece
    let pieceRef = Piece.ref(request.pieceId);
    let piece = await pieceRef.piece(context);

    if (state.players[request.playerId] !== piece.team) {
      throw new Cheaoss.MovePieceAborted(
        new InvalidMoveError({
          message: "You can only move your team's pieces."
        })
      );
    }

    // check the piece is in the right place
    if (piece && (piece.loc?.row === request.start?.row && piece.loc?.col === request.start?.col)) {
      await pieceRef.movePiece(context, request.end);
    } else {
      // TODO possibly should return an error
      throw new Cheaoss.MovePieceAborted(
        new InvalidMoveError({
          message: "Piece was not found starting location."
        })
      );
    }

    return {};
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
    switch (state.type as PieceType) {
      case PieceType.PAWN:
        // TODO: allow 2 spaces initially
        // TODO: allow eating on the diagonal
        // TODO: disallow moving forward if something else is there
        // can only move inc row by 1 if white, dec row by 1 if black.
        let direction = (state.team === Team.WHITE) ? 1 : -1;
        if (state.loc?.row !== request.row - direction || state.loc?.col !== request.col) {
          throw new Piece.MovePieceAborted(
            new InvalidMoveError({
              message: "Pawns must move forward in their own column."
            })
          );
        }
        break;
    }

    console.log("Moving the piece", state, request)
    state.loc = request;
    return {};
  }
}