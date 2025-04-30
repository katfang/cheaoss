import { Application, ExternalContext } from "@reboot-dev/reboot";
import sortedMap, {
  SortedMap,
} from "@reboot-dev/reboot-std/collections/sorted_map.js";
import { Hello } from "../../api/hello/v1/hello_rbt.js";
import { HelloServicer } from "./hello_servicer.js";
import { Cheaoss } from "../../api/cheaoss/v1/cheaoss_rbt.js";
import { CheaossServicer } from "./cheaoss_servicer.js";

const initialize = async (context: ExternalContext) => {
  const hello = Hello.ref("reboot-hello");

  const response = await hello
    .idempotently()
    .send(context, { message: "This is a new world order." });

  const cheaoss = Cheaoss.ref("singleton");
  const cheaossResponse = await cheaoss
    .unidempotently()
    .initGame(context);
  
};

new Application({
  servicers: [HelloServicer, CheaossServicer, ...sortedMap.servicers()],
  initialize,
}).run();