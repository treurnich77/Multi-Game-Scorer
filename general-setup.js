const CORE_KEY = "multiGameScorer:v6";
const GENERAL_KEY = "general";
const SKIP_HOME_ONCE_KEY = "multiGameScorer:skipHomeOnce";
const MIN_PLAYERS = 2;
const MAX_PLAYERS = 12;

let pending = null;
let activePanel = null;
let refreshQueued = false;

function readCore() {
  try {
    return JSON.parse(localStorage.getItem(CORE_KEY)) || null;
  } catch {
    return null;
  }
}

function writeCore(state) {
  localStorage.setItem(CORE_KEY, JSON.stringify(state));
}

function normalizeName(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function makeId(prefix) {
  if (globalThis.crypto?.randomUUID) return `${prefix}_${crypto.randomUUID()}`;
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function clampPlayerCount(value) {
  const count = Number(value);
  if (!Number.isFinite(count)) return 4;
  return Math.min(MAX_PLAYERS, Math.max(MIN_PLAYERS, Math.round(count)));
}

function validTarget(value) {
  const target = Number(value);
  return Number.isFinite(target) && target > 0 ? Math.round(target) : null;
}

function escapeText(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[char]));
}

function freshPending(state) {
  const previous = state?.games?.general;
  const count = clampPlayerCount(previous?.teams?.length || 4);
  const target = validTarget(previous?.target) || 100;
  return {
    count,
    target,
    names: Array.from({ length: count }, () => "")
  };
}

function ensurePending(state) {
  if (!pending) pending = freshPending(state);
  return pending;
}

function playerCountOptions(selected) {
  return Array.from({ length: MAX_PLAYERS - MIN_PLAYERS + 1 }, (_, index) => MIN_PLAYERS + index)
    .map((count) => `<option value="${count}" ${count === selected ? "selected" : ""}>${count}</option>`)
    .join("");
}

function playerFieldsMarkup() {
  return pending.names.slice(0, pending.count).map((name, index) => `
    <section class="setup-side general-player-card">
      <div class="setup-side-title">Player ${index + 1}</div>
      <div class="field">
        <label for="general-setup-player-${index}">Name</label>
        <input
          id="general-setup-player-${index}"
          list="saved-player-names"
          autocomplete="off"
          data-general-setup-name
          data-player-index="${index}"
          value="${escapeText(name)}"
          placeholder="Enter name"
        />
      </div>
    </section>
  `).join("");
}

function updateMeta(panel) {
  const meta = panel.querySelector(".setup-meta");
  if (!meta) return;
  const target = validTarget(pending.target);
  meta.innerHTML = `<span>${pending.count} players</span><span>Target ${target || "—"}</span>`;
}

function renderPlayerFields(panel) {
  const sides = panel.querySelector(".setup-sides");
  if (sides) sides.innerHTML = playerFieldsMarkup();
  updateMeta(panel);
}

function buildGeneralSetup(panel, state) {
  ensurePending(state);
  panel.dataset.generalSetupVersion = "2";

  const intro = panel.querySelector(".panel-intro");
  if (intro) intro.textContent = "Choose the number of players, target score, and player names before starting.";

  let options = panel.querySelector(".general-setup-options");
  if (!options) {
    options = document.createElement("section");
    options.className = "general-setup-options";
    const sides = panel.querySelector(".setup-sides");
    if (sides) sides.before(options);
  }

  options.innerHTML = `
    <div class="field">
      <label for="general-setup-count">Number of players</label>
      <select id="general-setup-count" data-general-setup-count>
        ${playerCountOptions(pending.count)}
      </select>
    </div>
    <div class="field">
      <label for="general-setup-target">Target score</label>
      <input id="general-setup-target" type="number" inputmode="numeric" min="1" step="1" data-general-setup-target value="${escapeText(pending.target)}" />
    </div>
  `;

  renderPlayerFields(panel);
}

function clearSetupError(panel) {
  panel.querySelector(".general-setup-error")?.remove();
  panel.querySelector(".form-error")?.remove();
}

function showSetupError(panel, message) {
  clearSetupError(panel);
  const error = document.createElement("div");
  error.className = "form-error general-setup-error";
  error.textContent = message;
  const options = panel.querySelector(".general-setup-options");
  if (options) options.after(error);
  else panel.prepend(error);
}

function ensurePlayer(name, players) {
  const existing = players.find((player) => String(player.name || "").toLocaleLowerCase() === name.toLocaleLowerCase());
  if (existing) return existing.id;
  const player = {
    id: makeId("player"),
    name,
    createdAt: new Date().toISOString()
  };
  players.push(player);
  return player.id;
}

function startGeneralMatch(panel) {
  const state = readCore();
  if (!state || state.screen !== "setup" || state.gameKey !== GENERAL_KEY) return;
  ensurePending(state);

  const names = pending.names.slice(0, pending.count).map(normalizeName);
  if (names.some((name) => !name)) {
    showSetupError(panel, "Enter a name for every player.");
    return;
  }

  const folded = names.map((name) => name.toLocaleLowerCase());
  if (new Set(folded).size !== folded.length) {
    showSetupError(panel, "Each player can only appear once in a match.");
    return;
  }

  const target = validTarget(pending.target);
  if (!target) {
    showSetupError(panel, "Enter a target score greater than zero.");
    return;
  }

  const players = Array.isArray(state.players) ? state.players.map((player) => ({ ...player })) : [];
  const playerIds = names.map((name) => ensurePlayer(name, players));
  const game = {
    teams: names,
    scores: names.map(() => 0),
    history: [],
    undone: [],
    target,
    mode: {
      deltas: names.map(() => 0),
      target,
      direction: "high"
    }
  };

  const next = {
    ...state,
    players,
    games: { ...state.games, general: game },
    activeMatches: {
      ...(state.activeMatches || {}),
      general: {
        id: makeId("match"),
        gameKey: GENERAL_KEY,
        startedAt: new Date().toISOString(),
        sidePlayerIds: playerIds.map((id) => [id]),
        saved: false
      }
    },
    gameKey: GENERAL_KEY,
    screen: "score",
    setup: null,
    notice: ""
  };

  writeCore(next);
  sessionStorage.setItem(SKIP_HOME_ONCE_KEY, "1");
  location.reload();
}

function hideMidMatchPlayerButtons(state) {
  if (!state || state.gameKey !== GENERAL_KEY || ["home", "setup", "players", "matches", "data"].includes(state.screen)) return;
  document.querySelectorAll('[data-action="general-add-player"], [data-action="general-remove-player"]').forEach((button) => {
    const parent = button.parentElement;
    button.remove();
    if (parent && !parent.querySelector("button")) parent.remove();
  });
}

function refresh() {
  const state = readCore();
  if (!state) return;

  if (state.screen === "setup" && state.gameKey === GENERAL_KEY) {
    const panel = document.querySelector(".setup-panel");
    if (!panel) return;
    if (panel !== activePanel) {
      pending = null;
      activePanel = panel;
    }
    if (panel.dataset.generalSetupVersion !== "2") buildGeneralSetup(panel, state);
    return;
  }

  activePanel = null;
  pending = null;
  hideMidMatchPlayerButtons(state);
}

function queueRefresh() {
  if (refreshQueued) return;
  refreshQueued = true;
  queueMicrotask(() => {
    refreshQueued = false;
    refresh();
  });
}

const appRoot = document.getElementById("app");
if (appRoot) {
  new MutationObserver(queueRefresh).observe(appRoot, { childList: true });

  appRoot.addEventListener("input", (event) => {
    const state = readCore();
    if (!state || state.screen !== "setup" || state.gameKey !== GENERAL_KEY || !pending) return;
    const target = event.target;
    const panel = target.closest(".setup-panel");
    if (!panel) return;

    if (target.matches?.("[data-general-setup-name]")) {
      const index = Number(target.dataset.playerIndex);
      if (Number.isInteger(index) && index >= 0 && index < pending.names.length) {
        pending.names[index] = target.value;
        clearSetupError(panel);
      }
      return;
    }

    if (target.matches?.("[data-general-setup-target]")) {
      pending.target = target.value;
      clearSetupError(panel);
      updateMeta(panel);
    }
  }, true);

  appRoot.addEventListener("change", (event) => {
    const state = readCore();
    if (!state || state.screen !== "setup" || state.gameKey !== GENERAL_KEY || !pending) return;
    const target = event.target;
    if (!target.matches?.("[data-general-setup-count]")) return;

    const nextCount = clampPlayerCount(target.value);
    const nextNames = pending.names.slice(0, nextCount);
    while (nextNames.length < nextCount) nextNames.push("");
    pending.count = nextCount;
    pending.names = nextNames;
    renderPlayerFields(target.closest(".setup-panel"));
  }, true);

  appRoot.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action='start-match']");
    if (!button) return;
    const state = readCore();
    if (!state || state.screen !== "setup" || state.gameKey !== GENERAL_KEY) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    startGeneralMatch(button.closest(".setup-panel"));
  }, true);
}

document.addEventListener("DOMContentLoaded", queueRefresh);
queueRefresh();
