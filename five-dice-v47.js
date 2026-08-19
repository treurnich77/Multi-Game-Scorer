const DICE_KEY = "multiGameScorer:fiveDice:v1";
const UPPER_KEYS = ["ones", "twos", "threes", "fours", "fives", "sixes"];
const CATEGORIES = [
  ["ones", "Ones"], ["twos", "Twos"], ["threes", "Threes"], ["fours", "Fours"], ["fives", "Fives"], ["sixes", "Sixes"],
  ["threeKind", "Three of a Kind"], ["fourKind", "Four of a Kind"], ["fullHouse", "Full House"],
  ["smallStraight", "Small Straight"], ["largeStraight", "Large Straight"], ["fiveDice", "Five Dice"], ["chance", "Chance"]
];

let queued = false;

function readDice() {
  try { return JSON.parse(localStorage.getItem(DICE_KEY)) || null; } catch { return null; }
}

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[ch]));
}

function upperSubtotal(player) {
  return UPPER_KEYS.reduce((sum, key) => sum + Number(player?.scores?.[key] ?? 0), 0);
}

function upperBonus(player) {
  return upperSubtotal(player) >= 63 ? 35 : 0;
}

function totalScore(player) {
  const base = Object.values(player?.scores || {}).reduce((sum, value) => sum + Number(value || 0), 0);
  return base + upperBonus(player);
}

function addFiveDiceToContinue(saved) {
  if (!saved || saved.phase === "finished") return;
  const home = document.querySelector("main.home-shell");
  if (!home) return;

  let continueSection = [...home.querySelectorAll(".section-block")].find((section) =>
    section.querySelector("h2")?.textContent?.trim() === "Pick up where you left off"
  );

  if (!continueSection) {
    continueSection = document.createElement("section");
    continueSection.className = "section-block v47-dice-continue";
    continueSection.innerHTML = `<div class="section-heading-row"><div><span class="eyebrow">Continue</span><h2>Pick up where you left off</h2></div></div><div class="resume-grid"></div>`;
    const chooseGame = [...home.querySelectorAll(".section-block")].find((section) =>
      section.querySelector("h2")?.textContent?.trim() === "Choose a game"
    );
    if (chooseGame) chooseGame.before(continueSection);
    else home.appendChild(continueSection);
  }

  let grid = continueSection.querySelector(".resume-grid");
  if (!grid) {
    grid = document.createElement("div");
    grid.className = "resume-grid";
    continueSection.appendChild(grid);
  }
  if (grid.querySelector("[data-v47-five-dice-resume]")) return;

  const current = saved.players?.[saved.current] || saved.players?.[0];
  const button = document.createElement("button");
  button.className = "resume-card";
  button.dataset.hub = "resume-five-dice";
  button.dataset.v47FiveDiceResume = "true";
  button.innerHTML = `<strong>Five Dice</strong><span>${current ? `${esc(current.name)} · ${totalScore(current)} pts` : "Unfinished game"}</span>`;
  grid.appendChild(button);
}

function patchHome() {
  const hub = document.querySelector(".game-night-hub");
  const home = document.querySelector("main.home-shell");
  if (!hub || !home || hub.dataset.v47Done === "true") return;
  hub.dataset.v47Done = "true";

  hub.querySelectorAll(".resume-hub-card").forEach((node) => node.remove());
  const saved = readDice();
  addFiveDiceToContinue(saved);
}

function patchPlayLibrary() {
  const grid = document.querySelector(".play-library-grid");
  if (!grid || grid.dataset.v47Done === "true") return;
  grid.dataset.v47Done = "true";
  grid.querySelectorAll(".resume-play-card").forEach((node) => node.remove());
  const fiveDice = grid.querySelector('[data-hub="new-five-dice"] strong');
  if (fiveDice) fiveDice.textContent = "Five Dice";
}

function patchDiceScorecard() {
  const screen = document.querySelector(".dice-game");
  if (!screen || screen.dataset.v47Done === "true") return;
  screen.dataset.v47Done = "true";

  const saved = readDice();
  const player = saved?.players?.[saved.current];
  if (!player) return;

  const upper = upperSubtotal(player);
  const bonus = upperBonus(player);
  const total = totalScore(player);

  const turnSummary = screen.querySelector(".dice-top p");
  if (turnSummary) {
    turnSummary.textContent = turnSummary.textContent.replace(/·\s*Total score\s*\d+/, `· Total score ${total}`);
  }

  const choice = screen.querySelector(".score-choice");
  const grid = choice?.querySelector(".category-grid");
  if (choice && grid) {
    const openButtons = new Map(
      [...grid.querySelectorAll("[data-score-category]")].map((button) => [button.dataset.scoreCategory, button])
    );

    const summary = document.createElement("div");
    summary.className = "upper-score-summary";
    summary.innerHTML = `<div><span>Upper section</span><strong>${upper} / 63</strong></div><div><span>Bonus</span><strong>${bonus ? "+35" : `${Math.max(0, 63 - upper)} to go`}</strong></div>`;
    grid.before(summary);

    const fragment = document.createDocumentFragment();
    CATEGORIES.forEach(([key, label]) => {
      if (player.scores?.[key] != null) {
        const used = document.createElement("button");
        used.type = "button";
        used.className = "category-card used-category";
        used.disabled = true;
        used.innerHTML = `<span>${esc(label)}<small>Used</small></span><strong>${Number(player.scores[key])}</strong>`;
        fragment.appendChild(used);
      } else {
        const open = openButtons.get(key);
        if (open) fragment.appendChild(open);
      }
    });
    grid.replaceChildren(fragment);
  }

  const scoreLines = [...screen.querySelectorAll(".compact-scoreboard .dice-score-line")];
  saved.players?.forEach((p, index) => {
    const value = scoreLines[index]?.querySelector("strong");
    if (value) value.textContent = String(totalScore(p));
  });
}

function patchFinishedGame() {
  const finished = document.querySelector(".dice-finished");
  if (!finished || finished.dataset.v47Done === "true") return;
  finished.dataset.v47Done = "true";

  const saved = readDice();
  if (!saved?.players?.length || saved.phase !== "finished") return;
  const ordered = [...saved.players].sort((a, b) => totalScore(b) - totalScore(a));
  const winningScore = totalScore(ordered[0]);
  const winners = ordered.filter((player) => totalScore(player) === winningScore);

  const heading = finished.querySelector("h1");
  if (heading) heading.textContent = winners.length === 1 ? `${winners[0].name} wins!` : "Tie game";

  const list = finished.querySelector(".final-score-list");
  if (list) {
    list.innerHTML = ordered.map((player) => `<div><span style="color:${esc(player.colour)}">${esc(player.name)}</span><strong>${totalScore(player)}</strong></div>`).join("");
  }
}

function patch() {
  patchHome();
  patchPlayLibrary();
  patchDiceScorecard();
  patchFinishedGame();
}

function queuePatch() {
  if (queued) return;
  queued = true;
  queueMicrotask(() => {
    queued = false;
    patch();
  });
}

const app = document.getElementById("app");
if (app) new MutationObserver(queuePatch).observe(app, { childList: true, subtree: true });
document.addEventListener("DOMContentLoaded", queuePatch);
queuePatch();
