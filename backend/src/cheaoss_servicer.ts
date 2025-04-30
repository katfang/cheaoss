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

  async initGame(
    context: TransactionContext,
    state: Cheaoss.State,
    request: InitGameRequest
  ) {
    const piecesMap = SortedMap.ref(context.stateId);
    let entries: { [key:string] : Uint8Array } = {}; // ??? how do I actually do this creation & setting
    let keys: string[] = []; 

    // this should perhaps blow away anything that exists there, but eh. later. 
    // console.log("teams are", Object.keys(Team)); // returns [ '0', '1', 'WHITE', 'BLACK' ]

    // generate keys
    for (let row: number = 0; row < 8*BOARD_SIZE; row++) {
      for (let col: number = 0; col < 8*BOARD_SIZE; col++) {
        keys.push(context.stateId + "-" + row + "-" + col);
      }
    }

    keys.forEach(keyName => {
      entries[keyName] = new Piece({
        team: Team.WHITE,
        type: PieceType.KING
      }).toBinary();
    });
        
    const resp = await piecesMap.insert(context, {entries: entries});
    const get = await piecesMap.get(context, {key: keys[0]});

    return {};
  }
}