import { Application, ExternalContext } from "@reboot-dev/reboot";
import { Cheaoss } from "../../api/cheaoss/v1/cheaoss_rbt.js";
import { CheaossServicer, PieceServicer, LocPieceIndexServicer } from "./cheaoss_servicer.js";

const initialize = async (context: ExternalContext) => {
  const cheaoss = Cheaoss.ref("singleton");
  await cheaoss
    .unidempotently()
    .initGame(context);
};

new Application({
  servicers: [CheaossServicer, PieceServicer, LocPieceIndexServicer],
  initialize,
}).run();