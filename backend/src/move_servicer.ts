import { ReaderContext, WriterContext } from "@reboot-dev/reboot";
import { EmptyRequest } from "../api/cheaoss/v1/util_pb.js"
import { Move, MoveStatus, SetStatusRequest } from "../api/cheaoss/v1/move_rbt.js";

export class MoveServicer extends Move.Servicer {

  async store(
    context: WriterContext,
    request: Move.State
  ) {
    this.state.playerId = request.playerId;
    this.state.pieceId = request.pieceId;
    this.state.start = request.start;
    this.state.end = request.end;
    this.state.status = request.status;
    // ignores state.error because that should be set by setStatus when status = ERRORED
    return {};
  }

  async setStatus(
    context: WriterContext,
    request: SetStatusRequest
  ) {
    this.state.status = request.status;
    this.state.error = request.error;
    return {};
  }

  async get(
    context: ReaderContext,
    request: EmptyRequest
  ) {
    return this.state;
  }

  async ack(
    context: WriterContext,
    request: EmptyRequest
  ) {
    this.state.start = undefined;
    this.state.end = undefined;
    this.state.status = MoveStatus.MOVE_ACKED;
    this.state.error = "";
    return {};
  }

  async clear(
    context: WriterContext,
    request: EmptyRequest
  ) {
    // There's no true delete, so this will have to do.
    this.state.playerId = "";
    this.state.pieceId = "";
    this.state.start = undefined;
    this.state.end = undefined;
    this.state.status = MoveStatus.MOVE_UNKNOWN;
    this.state.error = "";
    return {};
  }

}