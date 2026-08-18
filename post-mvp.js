const STORAGE_KEY = "multiGameScorer:v6";

function readState() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || null;
  } catch {
    return null;
  }
}

function writeState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function makeId(prefix) {
  if (globalThis.crypto?.randomUUID) return `${prefix}_${crypto.randomUUID()}`;
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function hideCompletedResumeCards() {
  const state = readState();
  if (!state) return;

  document.querySelectorAll(".resume-card[data-game]").forEach((card) => {
    const gameKey = card.dataset.game;
    card.hidden = Boolean(state.activeMatches?.[gameKey]?.saved);
  });

  const grid = document.querySelector(".resume-grid");
  if (grid) {
    const hasVisibleCard = [...grid.querySelectorAll(".resume-card")].some((card) => !card.hidden);
    const section = grid.closest(".section-block");
    if (section) section.hidden = !hasVisibleCard;
  }
}

function finishOhHellMatch() {
  const state = readState();
  const game = state?.games?.ohHell;
  if (!state || !game) return;

  if (!confirm("Finish this Oh Hell match and save the current scores?")) return;

  const scores = (game.scores || []).map((score) => Number(score) || 0);
  const top = Math.max(...scores);
  const winnerIndexes = scores
    .map((score, index) => ({ score, index }))
    .filter((item) => item.score === top)
    .map((item) => item.index);

  let active = state.activeMatches?.ohHell;
  if (!active) {
    active = {
      id: makeId("match"),
      gameKey: "ohHell",
      startedAt: null,
      sidePlayerIds: (game.teams || []).map(() => []),
      saved: false
    };
  }

  const match = {
    id: active.id,
    gameKey: "ohHell",
    gameLabel: "Oh Hell",
    startedAt: active.startedAt || null,
    endedAt: new Date().toISOString(),
    sides: (game.teams || []).map((label, index) => ({
      label,
      playerIds: active.sidePlayerIds?.[index] || []
    })),
    scores,
    winnerIndexes,
    isTie: winnerIndexes.length !== 1,
    hands: Array.isArray(game.history) ? game.history.length : 0
  };

  state.matches = [match, ...(state.matches || []).filter((item) => item.id !== match.id)].slice(0, 500);
  state.activeMatches = {
    ...(state.activeMatches || {}),
    ohHell: { ...active, saved: true, matchId: match.id }
  };
  state.notice = "Oh Hell match saved.";
  writeState(state);
  location.reload();
}

function addOhHellFinishButton() {
  const state = readState();
  if (!state || state.gameKey !== "ohHell") return;
  if (!["score", "table", "history", "rules"].includes(state.screen)) return;
  if (state.activeMatches?.ohHell?.saved) return;

  const toolbar = document.querySelector(".game-toolbar");
  if (!toolbar || toolbar.querySelector("[data-runtime-action='finish-oh-hell']")) return;

  const button = document.createElement("button");
  button.type = "button";
  button.className = "secondary";
  button.dataset.runtimeAction = "finish-oh-hell";
  button.textContent = "Finish Match";
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    finishOhHellMatch();
  });
  toolbar.appendChild(button);
}

function refreshRuntimePolish() {
  hideCompletedResumeCards();
  addOhHellFinishButton();
}

const observer = new MutationObserver(() => queueMicrotask(refreshRuntimePolish));
observer.observe(document.documentElement, { childList: true, subtree: true });

document.addEventListener("DOMContentLoaded", refreshRuntimePolish);
queueMicrotask(refreshRuntimePolish);
