import { Application, ExternalContext } from "@reboot-dev/reboot";
import { Hello } from "../../api/hello/v1/hello_rbt.js";
import { HelloServicer } from "./hello_servicer.js";

const initialize = async (context: ExternalContext) => {
  const hello = Hello.ref("reboot-hello");

  const response = await hello
    .idempotently()
    .send(context, { message: "This is a new world order." });
};

new Application({
  servicers: [HelloServicer],
  initialize,
}).run();