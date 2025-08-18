import { ReaderContext, WriterContext } from "@reboot-dev/reboot";
import {
  ListOfIds,
  StateTracker,
  TrackRequest
} from "../api/tracker/v1/state_tracker_rbt.js"
import { Empty } from "@bufbuild/protobuf";

export class StateTrackerServicer extends StateTracker.Servicer {
  async get(
    context: WriterContext,
    request: Empty
  ) {
    if (this.state.tracked === undefined) {
      this.state.tracked = {};
    }
    return this.state;
  }

  async track(
    context: WriterContext,
    request: TrackRequest
  ) {
    // set up initial state if not yet created
    if (this.state.tracked === undefined) {
      this.state.tracked = {};
    }
    if (!(request.key in this.state.tracked)) {
      this.state.tracked[request.key] = new ListOfIds();
    }

    // add the things to track
    this.state.tracked[request.key].ids.push(...request.toTrack);
    return {};
  }

  async clearAll(
    context: WriterContext,
    request: Empty
  ) {
    this.state.tracked = {};
    return {};
  }
}