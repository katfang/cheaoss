import { ReaderContext, WriterContext } from "@reboot-dev/reboot";

import {
  Hello,
  MessagesRequest,
  SendRequest,
} from "../../api/hello/v1/hello_rbt.js";

export class HelloServicer extends Hello.Servicer {
  async messages(
    context: ReaderContext,
    state: Hello.State,
    request: MessagesRequest
  ) {
    return { messages: state.messages };
  }

  async send(
    context: WriterContext,
    state: Hello.State,
    request: SendRequest
  ) {
    state.messages.push(request.message);
    return {};
  }
}