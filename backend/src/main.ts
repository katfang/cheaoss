import { Application, ExternalContext } from "@reboot-dev/reboot";
import { Game } from "../../api/cheaoss/v1/game_rbt.js";
import { GameServicer, PieceServicer, LocPieceIndexServicer } from "./cheaoss_servicer.js";

const initialize = async (context: ExternalContext) => {
  const game = Game.ref("singleton");
  await game
    .unidempotently()
    .initGame(context);
};

new Application({
  servicers: [GameServicer, PieceServicer, LocPieceIndexServicer],
  initialize,
}).run();