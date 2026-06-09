import { canasta } from "./canasta.js?v=14";
import { cribbage } from "./cribbage.js?v=21";
import { euchre } from "./euchre.js?v=19";
import { fiveHundred } from "./fiveHundred.js?v=12";
import { general } from "./general.js?v=19";
import { golf } from "./golf.js?v=18";
import { hearts } from "./hearts.js?v=12";
import { ohHell } from "./ohHell.js?v=19";
import { phase10 } from "./phase10.js?v=19";
import { spades } from "./spades.js?v=12";

export const games = {
  fiveHundred,
  spades,
  hearts,
  canasta,
  golf,
  euchre,
  ohHell,
  phase10,
  general,
  cribbage
};

export const gameOrder = ["fiveHundred", "spades", "hearts", "canasta", "golf", "euchre", "ohHell", "phase10", "general", "cribbage"];
