import { ReaderContext, TransactionContext, WriterContext } from "@reboot-dev/reboot";

import {
  AckMoveRequest,
  AssignTeamRequest,
  BoardPiecesResponse,
  CancelMoveRequest,
  Game,
  GetOutstandingMovesRequest,
  InitGameRequest,
  ListOfMoves
} from "../api/cheaoss/v1/game_rbt.js"

import {
  InvalidMoveError,
  Move,
  MoveCannotBeCanceledError,
  MoveRequest,
  MoveStatus
} from "../api/cheaoss/v1/move_rbt.js"

import {
  Piece,
  PieceType,
} from "../api/cheaoss/v1/piece_rbt.js"

import { EmptyRequest } from "../api/cheaoss/v1/util_pb.js"
import { Team } from "../api/cheaoss/v1/cheaoss_pb.js";
import { pieceToLocId, validateMovementPattern } from "./piece_servicer.js";
import { StateTracker } from "../api/tracker/v1/state_tracker_rbt.js";
import { LocPieceIndex } from "../api/cheaoss/v1/piece_rbt.js";
import { errors_pb } from "@reboot-dev/reboot-api";

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

export class GameServicer extends Game.Servicer {

  async assignTeam(
    context: WriterContext,
    request: AssignTeamRequest
  ) {
    // if we've seen the player before, return their existing team
    if (this.state.players[request.playerId] !== undefined) {
      return { team: this.state.players[request.playerId] };
    }

    // assume that init game has been run
    // TODO: possibly should throw an error if we ever have unknown team
    const team = this.state.nextTeamAssignment;
    this.state.nextTeamAssignment = flipTeam(team);
    this.state.players[request.playerId] = team;
    return { team: team };
  }

  async initGame(
    context: TransactionContext,
    request: InitGameRequest
  ) {
    // TODO(reboot-dev/reboot#30) workaround: would consider tearDown for its own transaction
    // but that would case nested transaction errors, so it's just an internal method.
    // TODO(upgrade)
    this.tearDownForInitGame(context, BOARD_SIZE);


    let keysList: string[][] = [];
    let locIds: string[] = [];
    // make the new subboard
    for (let boardRow: number = 0; boardRow < BOARD_SIZE; boardRow++) {
      for (let boardCol: number = 0; boardCol < BOARD_SIZE; boardCol++) {
        keysList.push(await this.makeInitialBoardPieces(context, context.stateId, boardRow*8, boardCol*8));

        for (let i = 0; i < BACK_ROW.length; i++) {
          locIds.push(
            pieceToLocId(context.stateId, boardRow*8, boardCol*8 + i), // white back row
            pieceToLocId(context.stateId, boardRow*8 + 1, boardCol*8 + i), // white pawn
            pieceToLocId(context.stateId, boardRow*8 + 8-1, boardCol*8 + i), // black back row
            pieceToLocId(context.stateId, boardRow*8 + 8-2, boardCol*8 + i), // black pawn
          );
        }
      }
    }
    await StateTracker.ref(context.stateId).track(context, {
      key: "LocPieceIndex",
      toTrack: locIds
    });

    this.state.pieceIds = keysList.flat();
    this.state.players = {};
    this.state.nextTeamAssignment = Team.WHITE;
    this.state.nextTeamToMove = Team.WHITE;
    this.state.whiteMovesQueue = [];
    this.state.blackMovesQueue = [];
    this.state.outstandingPlayerMoves = {};
    this.state.outstandingPieceMoves = {};

    return {};
  }

  async tearDownForInitGame(
    context: TransactionContext,
    boardSize: number
  ) {
    // This would have been a separate method you could call, but because of the way StateTracker is set up,
    // and wants to be accessed by both TearDown and InitGame, it's a helper method to avoid reboot-dev/reboot#30
    let stateTracker = StateTracker.ref(context.stateId);
    // Get tracked state to clear
    let stateTracked = await stateTracker.get(context);
    if ("LocPieceIndex" in stateTracked.tracked) {
      let locIds = stateTracked.tracked["LocPieceIndex"].ids;
      for (const locId of locIds) {
        let locPieces = locId.split("-");
        let locRow = parseInt(locPieces[1]);

        // TODO(reboot-dev/reboot#30) workaround: only clear locations
        // that are not initialized to avoid nested transaction error
        if (locRow % 8 !== 0 && locRow % 8 !== 1 && locRow % 8 !== 7 && locRow % 7 !== 6) {
          await LocPieceIndex.ref(locId).clear(context);
        }
      }
    }
    if ("Move" in stateTracked.tracked) {
      let moveIds = stateTracked.tracked["Move"].ids;
      for (const moveId of moveIds) {
        await Move.ref(moveId).clear(context);
      }
    }

    // Clear tracked state
    await stateTracker.clearAll(context);

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
    context: TransactionContext,
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
      throw new Game.QueueMoveAborted(
        new InvalidMoveError({
          message: "Piece not found"
        })
      );
    }

    // Outstanding moves check
    if (request.pieceId in this.state.outstandingPieceMoves) {
      // Make sure each piece has one move outstanding
      throw new Game.QueueMoveAborted(
        new InvalidMoveError({
          message: "This piece is already getting moved by someone else."
        })
      );
    }

    // Data validation check
    if (request.start === undefined || request.end === undefined) {
      throw new Game.QueueMoveAborted(
        new InvalidMoveError({
          message: "Move requests must have a start and an end"
        })
      )
    }

    // Chess logic checks
    if (this.state.players[request.playerId] !== piece.team) {
      throw new Game.QueueMoveAborted(
        new InvalidMoveError({
          message: "You can only move your team's pieces."
        })
      );
    } else if (piece.loc?.row !== request.start.row || piece.loc?.col !== request.start.col) {
        throw new Game.QueueMoveAborted(
          new InvalidMoveError({
            message: "That piece isn't there anymore."
          })
        );
    } else {
      const pieceToCheck = new Piece.State();
      pieceToCheck.copyFrom(piece); // TODO: some left over troubles from the fact I called it PieceMethod.Piece & have a message caleld Piece
      const check = validateMovementPattern(pieceToCheck, request.start, request.end);
      if (check instanceof InvalidMoveError) {
        throw new Game.QueueMoveAborted(check);
      }
    }

    // store the move
    let moveId = `${request.playerId}-${request.pieceId}`;
    await Move.ref(moveId).store(
      context,
      {
        playerId: request.playerId,
        pieceId: request.pieceId,
        start: request.start,
        end: request.end,
        status: MoveStatus.MOVE_QUEUED
      }
    )
    await StateTracker.ref(context.stateId).track(
      context,
      {
        key: "Move",
        toTrack: [moveId]
      }
    );

    // queue the move
    if (this.state.players[request.playerId] == Team.WHITE) {
      this.state.whiteMovesQueue.push(request);
    } else if (this.state.players[request.playerId] == Team.BLACK) {
      this.state.blackMovesQueue.push(request);
    }


    // update the indices
    this.state.outstandingPieceMoves[request.pieceId] = true;
    if (request.playerId in this.state.outstandingPlayerMoves) {
      this.state.outstandingPlayerMoves[request.playerId].moveIds.push(moveId);
    } else {
      this.state.outstandingPlayerMoves[request.playerId] = new ListOfMoves({ moveIds: [moveId] });;
    }

    await this.ref().schedule().runQueue(context);

    return { moveId: moveId };
  }

  async cancelMove(
    context: TransactionContext,
    request: CancelMoveRequest
  ) {
    // TODO: check you are the player who made the move
    let move;
    try {
      move = await Move.ref(request.moveId).get(context);
    } catch (e) {
      if (e instanceof Move.GetAborted && e.error instanceof errors_pb.StateNotConstructed) {
        throw new Game.CancelMoveAborted(
          new MoveCannotBeCanceledError({
            message: "No such move in the system."
          })
        );
      }
      // dunno this error, throw it.
      throw e;
    }

    if (move.status !== MoveStatus.MOVE_QUEUED) {
      throw new Game.CancelMoveAborted(
        new MoveCannotBeCanceledError({
          message: `Move is in state ${MoveStatus[move.status]}. Cannot be canceled.`
        })
      );
    }

    // get the associated player, piece
    let playerId = move.playerId;
    let pieceId = move.pieceId;

    // remove from piece outstanding moves
    // leave in player outstanding moves for player to ack
    delete this.state.outstandingPieceMoves[pieceId];

    // remove from queue
    let team = this.state.players[playerId];
    if (team === Team.WHITE) {
      this.state.whiteMovesQueue = this.state.whiteMovesQueue.filter(qMove =>
        qMove.playerId !== playerId || qMove.pieceId !== pieceId
      );
    } else {
      this.state.blackMovesQueue = this.state.blackMovesQueue.filter(qMove =>
        qMove.playerId !== playerId || qMove.pieceId !== pieceId
      );
    }

    // mark move as canceled
    await Move.ref(request.moveId).setStatus(context, {
      status: MoveStatus.MOVE_CANCELED,
    });

    return {};
  }

  async runQueue(
    context: TransactionContext,
    request: EmptyRequest
  ) {
    // TODO: check if this works. We're trying to grab the queue
    const queue = (this.state.nextTeamToMove === Team.WHITE) ? this.state.whiteMovesQueue : this.state.blackMovesQueue;

    // If there is no next move to make, get out of here
    if (queue.length === 0) {
      return {};
    }

    // take the move and make it
    let move = queue.shift();
    if (move === undefined) { return {}; } // not possible since length > 0, but making the wiggly lines happy

    let invalidMove = false;
    try {
      await Piece.ref(move.pieceId).idempotently().movePiece(context, move);
    } catch (e) {
      if (e instanceof Piece.MovePieceAborted && e.error instanceof InvalidMoveError) {
        // invalid chess move, delete the outstanding move and mark as error
        delete this.state.outstandingPieceMoves[move.pieceId];
        await Move.ref(`${move.playerId}-${move.pieceId}`)
          .idempotently()
          .setStatus(
            context,
            {
              status: MoveStatus.MOVE_ERRORED,
              error: e.error.message
            }
          );
          invalidMove = true;
          console.log("errored successfully?");
      } else {
        // unexpected error
        throw e;
      }
    }

    // if the move succeeds, change which team gets to play, and mark move as executed.
    if (!invalidMove) {
      // flip the team who can play
      this.state.nextTeamToMove = flipTeam(this.state.nextTeamToMove);

      // remove from indices
      // DO NOT remove from player index: AckMove will do that instead b/c we need to make sure the client knows the move has been executed or errored.
      delete this.state.outstandingPieceMoves[move.pieceId];
      await Move.ref(`${move.playerId}-${move.pieceId}`)
        .idempotently()
        .setStatus(context, { status: MoveStatus.MOVE_EXECUTED });
    }

    // check if there's more moves to run, if so, run the queue in half a second
    const otherQueue = (this.state.nextTeamToMove === Team.WHITE) ? this.state.whiteMovesQueue : this.state.blackMovesQueue;
    if (otherQueue.length > 0) {
      await this.ref().schedule({
        when: new Date(Date.now() + 500)
      }).runQueue(context);
    }

    return {};
  }

  async queues(
    context: ReaderContext,
    request: EmptyRequest
  ) {
    return {
      whiteMovesQueue: this.state.whiteMovesQueue,
      blackMovesQueue: this.state.blackMovesQueue
    }
  }

  async getOutstandingMoves(
    context: ReaderContext,
    request: GetOutstandingMovesRequest
  ) {
    let moves: { [id: string ]: Move } = {};
    if (request.playerId in this.state.outstandingPlayerMoves) {
      let moveIds = this.state.outstandingPlayerMoves[request.playerId].moveIds;
      // collect all the moves
      for (const moveId of moveIds) {
        moves[moveId] = await Move.ref(moveId).get(context);
      }
    }
    console.log("!!! get outstanding moves", moves);
    return { moves: moves };
  }

  async ackMove(
    context: TransactionContext,
    request: AckMoveRequest
  ) {
    if (!(request.playerId in this.state.outstandingPlayerMoves)) {
      // there's no moves to acknowledge, what are we doing here.
      return {};
    }

    await Move.ref(request.moveId).ack(context);
    let moveIds = this.state.outstandingPlayerMoves[request.playerId].moveIds;
    let slice = moveIds.filter(moveId => moveId !== request.moveId);
    this.state.outstandingPlayerMoves[request.playerId] = new ListOfMoves({ moveIds: slice });
    return {};
  }
}