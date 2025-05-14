import { ReaderContext, TransactionContext, WriterContext } from "@reboot-dev/reboot";

import {
  AssignTeamRequest,
  EmptyRequest,
  Cheaoss,
  InitGameRequest,
  Location,
  LocPieceIndex,
  Piece,
  PieceType,
  Team,
  CheaossState,
  BoardPiecesResponse,
  MoveRequest,
  InvalidMoveError,
  LocationRequiredError,
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

function flipTeam(team: Team): Team {
  if (team === Team.WHITE) return Team.BLACK;
  else if (team === Team.BLACK) return Team.WHITE;
  else return Team.TEAM_UNKNOWN;
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

    // assume that init game has been run
    // TODO: possibly should throw an error if we ever have unknown team
    const team = state.nextTeamAssignment;
    state.nextTeamAssignment = flipTeam(team);
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
    state.players = {};
    state.nextTeamAssignment = Team.WHITE;
    state.nextTeamToMove = Team.WHITE;
    state.whiteMovesQueue = [];
    state.blackMovesQueue = [];
    state.outstandingPlayerMoves = {};
    state.outstandingPieceMoves = {};

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

  async queueMove(
    context: WriterContext,
    state: Cheaoss.State,
    request: MoveRequest
  ) {
    let pieceRef = Piece.ref(request.pieceId);
    let piece;
    try {
      piece = await pieceRef.piece(context);
    } catch (e) {
      // TODO: what actually do we get if a piece doesn't exist --
      // you get a `PiecePieceAborted: rbt.v1alpha1.StateNotConstructed`
      // which I guess ... is sort of handled ... in that it'll throw before we get here.
      // TODO: this might actually swallow more than we expect.
      throw new Cheaoss.QueueMoveAborted(
        new InvalidMoveError({
          message: "Piece not found"
        })
      );
    }

    // Outstanding moves check
    if (request.playerId in state.outstandingPlayerMoves) {
      // Make sure each player only has one move outstanding
      throw new Cheaoss.QueueMoveAborted(
        new InvalidMoveError({
          message: "You already have a move outstanding."
        })
      );
    } else if (request.pieceId in state.outstandingPieceMoves) {
      // Make sure each piece has one move outstanding
      throw new Cheaoss.QueueMoveAborted(
        new InvalidMoveError({
          message: "This piece is already getting moved by someone else."
        })
      );
    }

    // Data validation check
    if (request.start === undefined || request.end === undefined) {
      throw new Cheaoss.QueueMoveAborted(
        new InvalidMoveError({
          message: "Move requests must have a start and an end"
        })
      )
    }

    // Chess logic checks
    if (state.players[request.playerId] !== piece.team) {
      throw new Cheaoss.QueueMoveAborted(
        new InvalidMoveError({
          message: "You can only move your team's pieces."
        })
      );
    } else if (piece.loc?.row !== request.start.row || piece.loc?.col !== request.start.col) {
        throw new Cheaoss.QueueMoveAborted(
          new InvalidMoveError({
            message: "That piece isn't there anymore."
          })
        );
    } else {
      const pieceToCheck = new Piece.State();
      pieceToCheck.copyFrom(piece); // TODO: some left over troubles from the fact I called it PieceMethod.Piece & have a message caleld Piece
      const check = validateChessMove(pieceToCheck, request.end);
      if (check !== null) {
        throw new Cheaoss.QueueMoveAborted(
          new InvalidMoveError({
            message: "Invalid chess move."
          })
        );
      }
    }

    if (state.players[request.playerId] == Team.WHITE) {
      state.whiteMovesQueue.push(request);
    } else if (state.players[request.playerId] == Team.BLACK) {
      state.blackMovesQueue.push(request);
    }
    state.outstandingPieceMoves[request.pieceId] = true;
    state.outstandingPlayerMoves[request.playerId] = true;

    await this.ref().schedule().runQueue(context);

    return {};
  }

  async runQueue(
    context: TransactionContext,
    state: Cheaoss.State,
    request: EmptyRequest
  ) {
    // TODO: check if this works. We're trying to grab the queue
    const queue = (state.nextTeamToMove === Team.WHITE) ? state.whiteMovesQueue : state.blackMovesQueue;

    // If there is no next move to make, get out of here
    if (queue.length === 0) {
      return {};
    }

    // take the move and make it
    let move = queue.shift();
    if (move === undefined) { return {}; } // not possible since length > 0, but making the wiggly lines happy
    try {
      await Piece.ref(move.pieceId).movePiece(context, move);
    } catch (e) {
      // TODO: check that this is a Piece.MovePieceAborted(InvalidMoveError)
      // sort of error and not something else.
      // TODO: ppossibly should add this to a list of errors that the user can see
      console.log("error in runQueue", e);
    }

    // flip the team who can play
    state.nextTeamToMove = flipTeam(state.nextTeamToMove);

    // remove from indices
    delete state.outstandingPieceMoves[move.pieceId]
    delete state.outstandingPlayerMoves[move.playerId]

    // check if there's more moves to run, if so, run the queue in half a second
    const otherQueue = (state.nextTeamToMove === Team.WHITE) ? state.whiteMovesQueue : state.blackMovesQueue;
    if (otherQueue.length > 0) {
      await this.ref().schedule({
        when: new Date(Date.now() + 500)
      }).runQueue(context);
    }

    return {};
  }

  async queues(
    context: ReaderContext,
    state: Cheaoss.State,
    request: EmptyRequest
  ) {
    return {
      whiteMovesQueue: state.whiteMovesQueue,
      blackMovesQueue: state.blackMovesQueue
    }

  }
}

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

    const check = validateChessMove(state, request.end);
    if (check === null) {
      console.log("Moving the piece", state, request)

      // update the location
      state.loc = request.end;

      // update the idnex
      await pieceToLocIdRef(context.stateId, request.start).delete(context);
      await pieceToLocIdRef(context.stateId, request.end).set(
        context,
        { pieceId: context.stateId }
      );
      return {};
    } else {
      throw new Piece.MovePieceAborted(check);
    }
  }
}

function validateChessMove(piece: Piece.State, end: Location): InvalidMoveError|null {
  switch (piece.type as PieceType) {
    case PieceType.PAWN:
      // TODO: allow 2 spaces initially
      // TODO: allow eating on the diagonal
      // TODO: disallow moving forward if something else is there
      // can only move inc row by 1 if white, dec row by 1 if black.
      let direction = (piece.team === Team.WHITE) ? 1 : -1;
      if (piece.loc?.row !== end.row - direction || piece.loc?.col !== end.col) {
        return  new InvalidMoveError({
          message: "Pawns must move forward in their own column."
        })
      }
      break;
  }

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

  async delete(
    context: WriterContext,
    state: LocPieceIndex.State,
    request: EmptyRequest
  ) {
    // !!! Reboot has no real delete, so the best we can do is set it to empty string
    state.pieceId = "";
    return {};
  }
}