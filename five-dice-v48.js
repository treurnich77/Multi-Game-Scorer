const DICE_KEY_V48 = "multiGameScorer:fiveDice:v1";
let v48Queued = false;
let pendingScoreKey = null;
let allowScoreCommit = false;

function v48ReadDice() {
  try { return JSON.parse(localStorage.getItem(DICE_KEY_V48)) || null; } catch { return null; }
}

function v48WriteDice(state) {
  localStorage.setItem(DICE_KEY_V48, JSON.stringify(state));
}

function v48Escape(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[ch]));
}

function v48ResumeFromStorage() {
  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.hidden = true;
  trigger.dataset.hub = "resume-five-dice";
  document.body.appendChild(trigger);
  trigger.click();
  trigger.remove();
}

function v48PatchRollFlow() {
  const screen = document.querySelector(".dice-game");
  if (!screen) return;
  const saved = v48ReadDice();
  if (!saved || saved.phase !== "turn") return;

  const hasUndo = Boolean(saved.lastRoll);
  screen.querySelectorAll("[data-die-index]").forEach((die) => {
    die.disabled = saved.rolls === 0;
  });
  screen.querySelectorAll("[data-score-category]").forEach((button) => {
    button.disabled = saved.rolls === 0;
  });

  const board = screen.querySelector(".dice-board");
  if (!board) return;
  board.querySelector(".roll-safety")?.remove();

  let controls = board.querySelector(".v48-roll-controls");
  if (!controls) {
    controls = document.createElement("div");
    controls.className = "v48-roll-controls";
    board.appendChild(controls);
  }

  const canRollAgain = saved.rolls < 3;
  const desiredControls = `
    ${hasUndo ? `<button class="v48-undo-roll" data-dice-action="undo-roll" type="button">Undo accidental roll</button>` : ""}
    ${canRollAgain ? `<button class="primary wide-button roll-button" data-dice-action="roll" type="button">${saved.rolls === 0 ? "Roll dice" : "Roll again"}</button>` : `<div class="v48-final-roll">Final roll — choose a score</div>`}
  `;
  if (controls.innerHTML !== desiredControls) controls.innerHTML = desiredControls;

  const choiceText = screen.querySelector(".score-choice-heading p");
  if (choiceText && hasUndo) choiceText.textContent = "Choose a category when you're ready. Use Undo accidental roll only if that roll was a mistake.";
}

function v48ClearPending() {
  pendingScoreKey = null;
  document.querySelectorAll(".category-card.v48-selected-score").forEach((button) => button.classList.remove("v48-selected-score"));
  document.querySelector(".v48-score-confirm")?.remove();
}

function v48ShowScoreConfirm(button) {
  const key = button?.dataset?.scoreCategory;
  if (!key) return;
  pendingScoreKey = key;

  document.querySelectorAll(".category-card.v48-selected-score").forEach((node) => node.classList.remove("v48-selected-score"));
  button.classList.add("v48-selected-score");

  const label = button.querySelector("span")?.childNodes?.[0]?.textContent?.trim() || key;
  const score = button.querySelector("strong")?.textContent?.trim() || "0";
  const panel = document.querySelector(".score-choice");
  if (!panel) return;

  let confirm = panel.querySelector(".v48-score-confirm");
  if (!confirm) {
    confirm = document.createElement("div");
    confirm.className = "v48-score-confirm";
    panel.prepend(confirm);
  }
  confirm.innerHTML = `
    <div><span>Selected</span><strong>${v48Escape(label)} — ${v48Escape(score)} pts</strong></div>
    <div class="v48-score-confirm-actions">
      <button type="button" class="secondary" data-v48-score-cancel>Change</button>
      <button type="button" class="primary" data-v48-score-submit>Submit score</button>
    </div>
  `;
  confirm.scrollIntoView({ block: "nearest", behavior: "smooth" });
}

function v48SubmitScore() {
  if (!pendingScoreKey) return;
  const selectorKey = pendingScoreKey.replace(/"/g, '\\"');
  const button = document.querySelector(`[data-score-category="${selectorKey}"]`);
  if (!button) return v48ClearPending();
  allowScoreCommit = true;
  button.click();
  allowScoreCommit = false;
  pendingScoreKey = null;
}

function v48QueuePatch() {
  if (v48Queued) return;
  v48Queued = true;
  queueMicrotask(() => {
    v48Queued = false;
    v48PatchRollFlow();
  });
}

document.addEventListener("click", (event) => {
  const cancel = event.target.closest("[data-v48-score-cancel]");
  if (cancel) {
    event.preventDefault();
    event.stopImmediatePropagation();
    v48ClearPending();
    return;
  }

  const submit = event.target.closest("[data-v48-score-submit]");
  if (submit) {
    event.preventDefault();
    event.stopImmediatePropagation();
    v48SubmitScore();
    return;
  }

  const die = event.target.closest("[data-die-index]");
  if (die) {
    const saved = v48ReadDice();
    if (saved?.phase === "turn" && saved.rolls > 0 && saved.lastRoll) {
      event.preventDefault();
      event.stopImmediatePropagation();
      const index = Number(die.dataset.dieIndex);
      if (!Number.isInteger(index) || index < 0 || index >= saved.held.length) return;
      saved.held[index] = !saved.held[index];
      v48WriteDice(saved);
      v48ResumeFromStorage();
      return;
    }
  }

  const category = event.target.closest("[data-score-category]");
  if (category && !allowScoreCommit) {
    event.preventDefault();
    event.stopImmediatePropagation();
    if (category.disabled) return;
    v48ShowScoreConfirm(category);
  }
}, true);

const v48App = document.getElementById("app");
// Only watch top-level screen swaps. Watching the entire subtree caused v48's own
// control rewrites to retrigger this observer indefinitely on resume.
if (v48App) new MutationObserver(v48QueuePatch).observe(v48App, { childList: true });
document.addEventListener("DOMContentLoaded", v48QueuePatch);
v48QueuePatch();
