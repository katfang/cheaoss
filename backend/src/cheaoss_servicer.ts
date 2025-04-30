import { ReaderContext, TransactionContext, WriterContext } from "@reboot-dev/reboot";

import {
  Cheaoss,
  AssignTeamRequest,
  InitGameRequest,
  Team,
  Piece,
  PieceType,
} from "../../api/cheaoss/v1/cheaoss_rbt.js";
import { SortedMap } from "@reboot-dev/reboot-std/collections/sorted_map.js";

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

  initialBoardPieces(
    stateId: string,
    startingRow: number,
    startingCol: number,
  ): { [key:string]: Uint8Array} {
    let entries: { [key:string] : Uint8Array } = {}; // ??? how do I actually do this creation & setting
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
      // white backrow
      entries[`${stateId}-${startingRow}-${startingCol+index}`] = new Piece({
        team: Team.WHITE,
        type: item
      }).toBinary();
      // white pawn
      entries[`${stateId}-${startingRow+1}-${startingCol+index}`] = new Piece({
        team: Team.WHITE,
        type: PieceType.PAWN
      }).toBinary();
      // black backrow
      entries[`${stateId}-${startingRow+7}-${startingCol+index}`] = new Piece({
        team: Team.BLACK,
        type: item
      }).toBinary();
      entries[`${stateId}-${startingRow+6}-${startingCol+index}`] = new Piece({
        team: Team.BLACK,
        type: PieceType.PAWN
      }).toBinary();
    }

    return entries;
  }

  async initGame(
    context: TransactionContext,
    state: Cheaoss.State,
    request: InitGameRequest
  ) {
    const piecesMap = SortedMap.ref(context.stateId);
    // each array item is the location->piece dict for one board 
    let entries: { [key:string] : Uint8Array }[] = []; // ??? how do I actually do this creation & setting
    let keys: string[] = []; 

    // clear the entire board of any stuff
    for (let row: number = 0; row < 8*BOARD_SIZE; row++) {
      for (let col: number = 0; col < 8*BOARD_SIZE; col++) {
        keys.push(context.stateId + "-" + row + "-" + col);
      }
    }
    await piecesMap.remove(context, { keys: keys });

    // make the new subboard 
    for (let boardRow: number = 0; boardRow < BOARD_SIZE; boardRow++) {
      for (let boardCol: number = 0; boardCol < BOARD_SIZE; boardCol++) {
        entries.push(this.initialBoardPieces(context.stateId, boardRow*8, boardCol*8));
      }
    }
    console.log(Object.assign({}, ...entries));

    const resp = await piecesMap.insert(
      context,
      {
        entries: Object.assign({}, ...entries)
      });

    return {};
  }
}