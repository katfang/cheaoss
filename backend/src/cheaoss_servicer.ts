import { ReaderContext, WriterContext } from "@reboot-dev/reboot";

import {
  Cheaoss,
  AssignTeamRequest,
  AssignTeamResponse,
} from "../../api/cheaoss/v1/cheaoss_rbt.js";

export class CheaossServicer extends Cheaoss.Servicer {
  async assignTeam(
    context: WriterContext,
    state: Cheaoss.State,
    request: AssignTeamRequest 
  ) {
    console.log("team assignment", state.nextTeamAssignment);
    const teamAssignment = state.nextTeamAssignment; 
    state.nextTeamAssignment = (teamAssignment + 1) % 2;
    return { team: teamAssignment };
  }
}