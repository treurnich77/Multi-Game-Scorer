const CORE_KEY = "multiGameScorer:v6";
const DEALER_KEY = "multiGameScorer:dealer:v1";
const TRACKED_GAMES = new Set([
  "fiveHundred",
  "spades",
  "hearts",
  "canasta",
  "golf",
  "euchre",
  "ohHell",
  "phase10"
]);

const DEFAULT_DEALER_STATE = {
  pendingByGame: {},
  matches: {}
};

let lastScreen = null;
let lastGameKey = null;
let refreshQueued = false;

function readCore() {
  try {
    return JSON.parse(localStorage.getItem(CORE_KEY)) || null;
  } catch {
    return null;
  }
}

function readDealerState() {
  try {
    const saved = JSON.parse(localStorage.getItem(DEALER_KEY)) || {};
    return {
      ...DEFAULT_DEALER_STATE,
      ...saved,
      pendingByGame: saved.pendingByGame && typeof saved.pendingByGame === "object" ? saved.pendingByGame : {},
      matches: saved.matches && typeof saved.matches === "object" ? saved.matches : {}
    };
  } catch {
    return { ...DEFAULT_DEALER_STATE };
  }
}

function writeDealerState(next) {
  localStorage.setItem(DEALER_KEY, JSON.stringify(next));
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

function setupInputs() {
  return [...document.querySelectorAll('.setup-panel input[data-action="setup-name"]')];
}

function tokenForInput(input) {
  return `${input.dataset.side}:${input.dataset.member}`;
}

function labelForInput(input) {
  const entered = input.value.trim();
  if (entered) return entered;
  const side = Number(input.dataset.side) + 1;
  const member = Number(input.dataset.member) + 1;
  const allInputs = setupInputs();
  const sameSide = allInputs.filter((item) => item.dataset.side === input.dataset.side);
  if (sameSide.length > 1) return `Team ${side} · Player ${member}`;
  return `Player ${side}`;
}

function setupLabelMap() {
  return new Map(setupInputs().map((input) => [tokenForInput(input), labelForInput(input)]));
}

function defaultSeatTokens(inputs) {
  const parsed = inputs.map((input) => ({
    token: tokenForInput(input),
    side: Number(input.dataset.side),
    member: Number(input.dataset.member)
  }));
  const sideCount = new Set(parsed.map((item) => item.side)).size;
  const memberCount = parsed.reduce((max, item) => Math.max(max, item.member + 1), 0);

  if (sideCount === 2 && memberCount === 2 && parsed.length === 4) {
    return ["0:0", "1:0", "0:1", "1:1"];
  }

  return parsed
    .sort((a, b) => a.side - b.side || a.member - b.member)
    .map((item) => item.token);
}

function pendingForCurrentSetup(gameKey) {
  const inputs = setupInputs();
  if (!inputs.length) return null;

  const available = defaultSeatTokens(inputs);
  const availableSet = new Set(available);
  const dealerState = readDealerState();
  const saved = dealerState.pendingByGame[gameKey];
  const savedSeats = Array.isArray(saved?.seatTokens) ? saved.seatTokens : [];
  const validSaved = savedSeats.length === available.length
    && new Set(savedSeats).size === available.length
    && savedSeats.every((token) => availableSet.has(token));

  if (validSaved) {
    return {
      seatTokens: savedSeats,
      startingDealerToken: availableSet.has(saved.startingDealerToken) ? saved.startingDealerToken : savedSeats[0]
    };
  }

  return {
    seatTokens: available,
    startingDealerToken: available[0]
  };
}

function savePending(gameKey, pending) {
  const dealerState = readDealerState();
  dealerState.pendingByGame = {
    ...dealerState.pendingByGame,
    [gameKey]: pending
  };
  writeDealerState(dealerState);
}

function resetPendingForSetup(gameKey) {
  const inputs = setupInputs();
  if (!inputs.length) return;
  const seatTokens = defaultSeatTokens(inputs);
  savePending(gameKey, {
    seatTokens,
    startingDealerToken: seatTokens[0]
  });
}

function setupSeatMarkup(gameKey) {
  const pending = pendingForCurrentSetup(gameKey);
  if (!pending || pending.seatTokens.length < 2) return "";
  const labels = setupLabelMap();

  return `
    <section class="dealer-setup-card" aria-label="Dealer and seating setup">
      <div class="dealer-setup-heading">
        <div>
          <span class="eyebrow">Around the table</span>
          <strong>Clockwise seating</strong>
        </div>
        <small>Seat order tells Scorer who deals next.</small>
      </div>
      <div class="dealer-seat-list">
        ${pending.seatTokens.map((token, index) => `
          <div class="dealer-seat-row" data-seat-token="${escapeText(token)}">
            <span class="dealer-seat-number">${index + 1}</span>
            <strong class="dealer-seat-name" data-dealer-seat-name="${escapeText(token)}">${escapeText(labels.get(token) || `Seat ${index + 1}`)}</strong>
            <div class="dealer-seat-move">
              <button type="button" class="secondary dealer-seat-button" data-dealer-setup-action="move-up" data-seat-index="${index}" aria-label="Move seat ${index + 1} earlier clockwise" ${index === 0 ? "disabled" : ""}>↑</button>
              <button type="button" class="secondary dealer-seat-button" data-dealer-setup-action="move-down" data-seat-index="${index}" aria-label="Move seat ${index + 1} later clockwise" ${index === pending.seatTokens.length - 1 ? "disabled" : ""}>↓</button>
            </div>
          </div>
        `).join("")}
      </div>
      <div class="dealer-first-block">
        <span class="dealer-first-label">Who deals first?</span>
        <div class="dealer-first-choices">
          ${pending.seatTokens.map((token) => `
            <button
              type="button"
              class="dealer-first-choice ${pending.startingDealerToken === token ? "active" : ""}"
              data-dealer-setup-action="first-dealer"
              data-seat-token="${escapeText(token)}"
              aria-pressed="${pending.startingDealerToken === token}"
            >${escapeText(labels.get(token) || "Player")}</button>
          `).join("")}
        </div>
      </div>
    </section>
  `;
}

function renderSetupDealer(state) {
  if (!state || state.screen !== "setup" || !TRACKED_GAMES.has(state.gameKey)) return;
  const panel = document.querySelector(".setup-panel");
  if (!panel) return;

  const existing = panel.querySelector(".dealer-setup-card");
  if (existing) existing.remove();

  const html = setupSeatMarkup(state.gameKey);
  if (!html) return;

  const meta = panel.querySelector(".setup-meta");
  if (meta) meta.insertAdjacentHTML("beforebegin", html);
  else panel.querySelector(".wide-button")?.insertAdjacentHTML("beforebegin", html);
}

function updateSetupLabels() {
  const labels = setupLabelMap();
  document.querySelectorAll("[data-dealer-seat-name]").forEach((node) => {
    const label = labels.get(node.dataset.dealerSeatName);
    if (label && node.textContent !== label) node.textContent = label;
  });
  document.querySelectorAll('.dealer-first-choice[data-seat-token]').forEach((button) => {
    const label = labels.get(button.dataset.seatToken);
    if (label && button.textContent !== label) button.textContent = label;
  });
}

function playerNameMap(state) {
  return new Map((state?.players || []).map((player) => [player.id, player.name]));
}

function attachDealerConfigToMatch(state) {
  if (!state || !TRACKED_GAMES.has(state.gameKey)) return;
  const active = state.activeMatches?.[state.gameKey];
  if (!active?.id || !Array.isArray(active.sidePlayerIds)) return;

  const dealerState = readDealerState();
  if (dealerState.matches[active.id]) return;

  const pending = dealerState.pendingByGame[state.gameKey];
  if (!pending?.seatTokens?.length) return;

  const tokenMap = new Map();
  active.sidePlayerIds.forEach((ids, sideIndex) => {
    (ids || []).forEach((playerId, memberIndex) => {
      tokenMap.set(`${sideIndex}:${memberIndex}`, playerId);
    });
  });

  const seatPlayerIds = pending.seatTokens.map((token) => tokenMap.get(token));
  if (seatPlayerIds.some((id) => !id) || new Set(seatPlayerIds).size !== seatPlayerIds.length) return;

  const startingDealerPlayerId = tokenMap.get(pending.startingDealerToken) || seatPlayerIds[0];
  dealerState.matches = {
    ...dealerState.matches,
    [active.id]: {
      gameKey: state.gameKey,
      seatPlayerIds,
      anchors: [{ handCount: 0, playerId: startingDealerPlayerId }],
      createdAt: new Date().toISOString()
    }
  };
  writeDealerState(dealerState);
}

function dealerInfo(state) {
  const active = state?.activeMatches?.[state.gameKey];
  if (!active?.id) return null;

  const dealerState = readDealerState();
  const config = dealerState.matches[active.id];
  const seats = Array.isArray(config?.seatPlayerIds) ? config.seatPlayerIds : [];
  if (seats.length < 2) return null;

  const handCount = Array.isArray(state.games?.[state.gameKey]?.history)
    ? state.games[state.gameKey].history.length
    : 0;

  const anchors = (Array.isArray(config.anchors) ? config.anchors : [])
    .filter((anchor) => Number.isInteger(anchor?.handCount) && seats.includes(anchor?.playerId) && anchor.handCount <= handCount)
    .sort((a, b) => a.handCount - b.handCount);

  const anchor = anchors[anchors.length - 1] || { handCount: 0, playerId: seats[0] };
  const anchorIndex = Math.max(0, seats.indexOf(anchor.playerId));
  const steps = Math.max(0, handCount - anchor.handCount);
  const currentIndex = (anchorIndex + steps) % seats.length;
  const nextIndex = (currentIndex + 1) % seats.length;
  const names = playerNameMap(state);

  return {
    matchId: active.id,
    handCount,
    seats,
    currentPlayerId: seats[currentIndex],
    currentName: names.get(seats[currentIndex]) || "Unknown player",
    nextName: names.get(seats[nextIndex]) || "Unknown player",
    seatNames: seats.map((id) => names.get(id) || "Unknown player")
  };
}

function renderDealerPanel(state) {
  document.querySelector(".managed-dealer-panel")?.remove();
  const info = dealerInfo(state);
  if (!info) return;

  const toolbar = document.querySelector(".game-toolbar");
  if (!toolbar) return;

  const panel = document.createElement("section");
  panel.className = "managed-dealer-panel";
  panel.innerHTML = `
    <div class="managed-dealer-main">
      <span class="dealer-icon" aria-hidden="true">↻</span>
      <div class="managed-dealer-copy">
        <span>Dealer</span>
        <strong>${escapeText(info.currentName)}</strong>
        <small>Next: ${escapeText(info.nextName)} · ${info.handCount ? `${info.handCount} ${info.handCount === 1 ? "hand" : "hands"} completed` : "first hand"}</small>
      </div>
      <button type="button" class="secondary dealer-correct-button" data-dealer-action="toggle-correction">Correct</button>
    </div>
    <div class="dealer-correction" hidden>
      <span>Who is dealing this hand?</span>
      <div class="dealer-correction-choices">
        ${info.seats.map((playerId, index) => `
          <button
            type="button"
            class="dealer-correction-choice ${playerId === info.currentPlayerId ? "active" : ""}"
            data-dealer-action="set-current"
            data-player-id="${escapeText(playerId)}"
          >${escapeText(info.seatNames[index])}</button>
        `).join("")}
      </div>
      <small>This correction applies from this hand forward. Undoing past it restores the earlier dealer sequence.</small>
    </div>
  `;

  toolbar.after(panel);
  suppressLegacyDealerTool();
}

function suppressLegacyDealerTool() {
  if (!document.querySelector(".managed-dealer-panel")) return;
  document.querySelector('.game-tools-panel [data-tool="dealer"]')?.remove();
  document.querySelector(".game-tools-panel .dealer-status")?.remove();
}

function setCurrentDealer(playerId) {
  const state = readCore();
  const info = dealerInfo(state);
  if (!info || !info.seats.includes(playerId)) return;

  const dealerState = readDealerState();
  const config = dealerState.matches[info.matchId];
  if (!config) return;

  const anchors = (Array.isArray(config.anchors) ? config.anchors : [])
    .filter((anchor) => Number.isInteger(anchor?.handCount) && anchor.handCount < info.handCount);

  anchors.push({ handCount: info.handCount, playerId });
  dealerState.matches[info.matchId] = { ...config, anchors };
  writeDealerState(dealerState);
  renderDealerPanel(state);
}

function handleSetupDealerClick(event) {
  const button = event.target.closest("button[data-dealer-setup-action]");
  if (!button) return;
  const state = readCore();
  if (!state || state.screen !== "setup") return;

  event.preventDefault();
  event.stopImmediatePropagation();

  const pending = pendingForCurrentSetup(state.gameKey);
  if (!pending) return;

  if (button.dataset.dealerSetupAction === "first-dealer") {
    const token = button.dataset.seatToken;
    if (!pending.seatTokens.includes(token)) return;
    pending.startingDealerToken = token;
    savePending(state.gameKey, pending);
    renderSetupDealer(state);
    return;
  }

  const index = Number(button.dataset.seatIndex);
  if (!Number.isInteger(index)) return;
  const target = button.dataset.dealerSetupAction === "move-up" ? index - 1 : index + 1;
  if (target < 0 || target >= pending.seatTokens.length) return;

  const seats = pending.seatTokens.slice();
  [seats[index], seats[target]] = [seats[target], seats[index]];
  pending.seatTokens = seats;
  savePending(state.gameKey, pending);
  renderSetupDealer(state);
}

function handleManagedDealerClick(event) {
  const button = event.target.closest("button[data-dealer-action]");
  if (!button) return;

  event.preventDefault();
  event.stopImmediatePropagation();

  if (button.dataset.dealerAction === "toggle-correction") {
    const correction = button.closest(".managed-dealer-panel")?.querySelector(".dealer-correction");
    if (correction) correction.hidden = !correction.hidden;
    return;
  }

  if (button.dataset.dealerAction === "set-current") {
    setCurrentDealer(button.dataset.playerId);
  }
}

function refreshDealerEnhancements() {
  const state = readCore();
  if (!state) return;

  const enteringSetup = state.screen === "setup"
    && TRACKED_GAMES.has(state.gameKey)
    && (lastScreen !== "setup" || lastGameKey !== state.gameKey);

  if (enteringSetup) resetPendingForSetup(state.gameKey);

  if (state.screen === "setup" && TRACKED_GAMES.has(state.gameKey)) {
    renderSetupDealer(state);
  } else {
    attachDealerConfigToMatch(state);
    renderDealerPanel(state);
  }

  suppressLegacyDealerTool();
  lastScreen = state.screen;
  lastGameKey = state.gameKey;
}

function queueDealerRefresh() {
  if (refreshQueued) return;
  refreshQueued = true;
  queueMicrotask(() => {
    refreshQueued = false;
    refreshDealerEnhancements();
  });
}

const appRoot = document.getElementById("app");
if (appRoot) {
  new MutationObserver(queueDealerRefresh).observe(appRoot, { childList: true });
  appRoot.addEventListener("input", (event) => {
    if (event.target.matches?.('input[data-action="setup-name"]')) updateSetupLabels();
  });
  appRoot.addEventListener("click", handleSetupDealerClick, true);
  appRoot.addEventListener("click", handleManagedDealerClick, true);
}

document.addEventListener("DOMContentLoaded", queueDealerRefresh);
queueDealerRefresh();
