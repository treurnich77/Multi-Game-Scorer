(() => {
  const STYLE_ID = "five-dice-no-number-badge";
  const DICE_KEY = "multiGameScorer:fiveDice:v1";

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = ".die-value{display:none!important;visibility:hidden!important;pointer-events:none!important}";
    document.head.appendChild(style);
  }

  function canHoldDice() {
    try {
      const state = JSON.parse(localStorage.getItem(DICE_KEY));
      return Boolean(state && state.phase === "turn" && state.rolls > 0);
    } catch {
      return false;
    }
  }

  // The base Five Dice screen may render dice disabled while an accidental-roll
  // undo is available. v48 normally re-enables them; this guard makes sure the
  // user's tap reaches that existing hold handler even after a resume/update.
  document.addEventListener("pointerdown", (event) => {
    const die = event.target.closest?.("[data-die-index]");
    if (!die || !canHoldDice()) return;
    die.disabled = false;
  }, true);

  ensureStyle();
  document.addEventListener("DOMContentLoaded", ensureStyle);
})();
