const CORE_KEY = "multiGameScorer:v6";
const POLISH_KEY = "multiGameScorer:polish:v1";

const COLOUR_OPTIONS = [
  { key: "emerald", label: "Emerald" },
  { key: "blue", label: "Blue" },
  { key: "violet", label: "Violet" },
  { key: "amber", label: "Amber" },
  { key: "rose", label: "Rose" },
  { key: "teal", label: "Teal" },
  { key: "slate", label: "Slate" },
  { key: "orange", label: "Orange" },
  { key: "cyan", label: "Cyan" },
  { key: "indigo", label: "Indigo" },
  { key: "lime", label: "Lime" },
  { key: "pink", label: "Pink" },
  { key: "brown", label: "Brown" },
  { key: "red", label: "Red" },
  { key: "navy", label: "Navy" },
  { key: "gold", label: "Gold" }
];
const COLOURS = COLOUR_OPTIONS.map((colour) => colour.key);
const PARTNERSHIP_GAMES = new Set(["fiveHundred", "spades", "canasta", "euchre"]);
const PALETTES = [
  { key: "classic", label: "Classic Felt" },
  { key: "midnight", label: "Midnight" },
  { key: "casino", label: "Casino" },
  { key: "clubhouse", label: "Clubhouse" },
  { key: "ice", label: "Ice" },
  { key: "contrast", label: "High Contrast" }
];

const defaultPolish = {
  palette: "classic",
  keepAwake: true,
  focus: false,
  dealerByMatch: {}
};

let wakeLock = null;
let wakeRequestPending = false;
let observerQueued = false;

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

function readPolish() {
  try {
    return { ...defaultPolish, ...(JSON.parse(localStorage.getItem(POLISH_KEY)) || {}) };
  } catch {
    return { ...defaultPolish };
  }
}

function writePolish(patch) {
  const next = { ...readPolish(), ...patch };
  localStorage.setItem(POLISH_KEY, JSON.stringify(next));
  applyPalette(next);
  applyFocus(next);
  syncWakeLock();
  return next;
}

function isGameScreen(state = readCore()) {
  return Boolean(state && ["score", "table", "history", "rules"].includes(state.screen));
}

function gameLabel(state, match) {
  if (match?.gameLabel) return match.gameLabel;
  const labels = {
    fiveHundred: "Five Hundred",
    spades: "Spades",
    hearts: "Hearts",
    canasta: "Canasta",
    golf: "Golf",
    euchre: "Euchre",
    ohHell: "Oh Hell",
    phase10: "Phase 10",
    general: "General Score Sheet",
    cribbage: "Cribbage"
  };
  return labels[state?.gameKey] || "Game";
}

function applyPalette(polish = readPolish()) {
  document.documentElement.dataset.palette = polish.palette || "classic";
  const meta = document.querySelector('meta[name="theme-color"]');
  const themeColours = {
    classic: "#0f5132",
    midnight: "#17243a",
    casino: "#681c24",
    clubhouse: "#31543f",
    ice: "#2b5f7c",
    contrast: "#111111"
  };
  if (meta) meta.content = themeColours[polish.palette] || themeColours.classic;
}

function applyFocus(polish = readPolish()) {
  document.documentElement.classList.toggle("game-focus", Boolean(polish.focus) && isGameScreen());
}

async function releaseWakeLock() {
  if (!wakeLock) return;
  try { await wakeLock.release(); } catch {}
  wakeLock = null;
}

async function syncWakeLock() {
  const polish = readPolish();
  const shouldHold = polish.keepAwake && isGameScreen() && document.visibilityState === "visible";
  if (!shouldHold) {
    await releaseWakeLock();
    return;
  }
  if (wakeLock || wakeRequestPending || !navigator.wakeLock?.request) return;
  wakeRequestPending = true;
  try {
    wakeLock = await navigator.wakeLock.request("screen");
    wakeLock.addEventListener("release", () => { wakeLock = null; }, { once: true });
  } catch {
    wakeLock = null;
  } finally {
    wakeRequestPending = false;
  }
}

function ensurePlayerColours() {
  const state = readCore();
  if (!state?.players?.length) return state;
  const used = new Set();
  let changed = false;

  state.players.forEach((player) => {
    const current = COLOURS.includes(player.color) && !used.has(player.color) ? player.color : null;
    if (current) {
      used.add(current);
      return;
    }

    const available = COLOURS.find((colour) => !used.has(colour));
    if (available) {
      if (player.color !== available) changed = true;
      player.color = available;
      used.add(available);
      return;
    }

    if (player.color) {
      delete player.color;
      changed = true;
    }
  });

  if (changed) writeCore(state);
  return state;
}

function colourForPlayer(state, id, fallbackIndex = 0) {
  const player = state?.players?.find((item) => item.id === id);
  return player?.color && COLOURS.includes(player.color) ? player.color : COLOURS[fallbackIndex % COLOURS.length];
}

function availableColourOptions(state, playerId) {
  const usedByOthers = new Set(
    (state?.players || [])
      .filter((player) => player.id !== playerId && COLOURS.includes(player.color))
      .map((player) => player.color)
  );
  return COLOUR_OPTIONS.filter((colour) => !usedByOthers.has(colour.key));
}

function rebuildPlayerColourControls() {
  document.querySelectorAll(".player-colour-control").forEach((control) => control.remove());
  addPlayerColourControls();
}

function addPlayerColourControls() {
  const state = ensurePlayerColours();
  if (!state || state.screen !== "players") return;

  document.querySelectorAll(".player-card").forEach((card) => {
    if (card.querySelector(".player-colour-control")) return;
    const name = card.querySelector(".player-card-main strong")?.textContent?.trim();
    const player = state.players.find((item) => item.name === name);
    if (!player) return;

    const avatar = card.querySelector(".avatar");
    if (avatar && player.color) avatar.dataset.playerColour = player.color;

    const options = availableColourOptions(state, player.id);
    const control = document.createElement("label");
    control.className = "player-colour-control";
    control.dataset.playerId = player.id;
    control.title = "Player colour used in every game";

    const dot = document.createElement("span");
    dot.className = "colour-dot";
    if (player.color) dot.dataset.playerColour = player.color;

    const select = document.createElement("select");
    select.className = "player-colour-select";
    select.setAttribute("aria-label", `Colour for ${player.name}`);
    select.innerHTML = options.length
      ? options.map((colour) => `<option value="${colour.key}" ${player.color === colour.key ? "selected" : ""}>${colour.label}</option>`).join("")
      : `<option value="">No colour available</option>`;
    select.disabled = !options.length;

    select.addEventListener("change", () => {
      const latest = ensurePlayerColours();
      const target = latest?.players?.find((item) => item.id === player.id);
      if (!target) return;
      const chosen = select.value;
      const alreadyUsed = latest.players.some((item) => item.id !== target.id && item.color === chosen);
      if (!chosen || alreadyUsed) {
        showToast(alreadyUsed ? "That colour is already assigned." : "Choose an available colour.");
        rebuildPlayerColourControls();
        return;
      }

      target.color = chosen;
      writeCore(latest);
      if (avatar) avatar.dataset.playerColour = chosen;
      dot.dataset.playerColour = chosen;
      addTeamColourStrips(true);
      rebuildPlayerColourControls();
      showToast(`${target.name} is now ${COLOUR_OPTIONS.find((colour) => colour.key === chosen)?.label || chosen}.`);
    });

    control.append(dot, select);
    card.appendChild(control);
  });
}

function addTeamColourStrips(force = false) {
  const state = ensurePlayerColours();
  if (!state || !isGameScreen(state)) return;
  const active = state.activeMatches?.[state.gameKey];
  const sidePlayerIds = active?.sidePlayerIds || [];

  document.querySelectorAll(".score-card").forEach((card, index) => {
    if (force) card.querySelector(".team-colour-strip")?.remove();
    if (card.querySelector(".team-colour-strip")) return;
    const ids = sidePlayerIds[index] || [];
    if (!ids.length) return;
    const strip = document.createElement("div");
    strip.className = "team-colour-strip";
    ids.forEach((id, memberIndex) => {
      const segment = document.createElement("span");
      segment.dataset.playerColour = colourForPlayer(state, id, index + memberIndex);
      strip.appendChild(segment);
    });
    card.prepend(strip);
  });
}

function setupNames() {
  return [...document.querySelectorAll('.setup-panel input[data-action="setup-name"]')];
}

function addSetupTools() {
  const state = readCore();
  const panel = document.querySelector(".setup-panel");
  if (!state || state.screen !== "setup" || !PARTNERSHIP_GAMES.has(state.gameKey) || !panel || panel.querySelector(".setup-fun-tools")) return;

  const inputs = setupNames();
  if (inputs.length !== 4) return;

  const tools = document.createElement("div");
  tools.className = "setup-fun-tools";
  tools.innerHTML = `<button type="button" class="secondary shuffle-teams">⇄ Shuffle teams</button><span>Enter four names, then mix the partnerships.</span>`;
  tools.querySelector("button").addEventListener("click", () => {
    const names = inputs.map((input) => input.value.trim());
    if (names.some((name) => !name)) {
      showToast("Enter all four names first.");
      return;
    }
    for (let i = names.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [names[i], names[j]] = [names[j], names[i]];
    }
    inputs.forEach((input, index) => {
      input.value = names[index];
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    showToast("Teams shuffled.");
  });

  panel.querySelector(".setup-meta")?.before(tools);
}

function participants(state = readCore()) {
  if (!state) return [];
  const active = state.activeMatches?.[state.gameKey];
  const ids = (active?.sidePlayerIds || []).flat();
  if (ids.length) {
    return ids.map((id) => state.players?.find((player) => player.id === id)).filter(Boolean).map((player) => ({ id: player.id, name: player.name }));
  }
  return (state.games?.[state.gameKey]?.teams || []).map((name, index) => ({ id: `side-${index}`, name }));
}

function currentMatchKey(state = readCore()) {
  return state?.activeMatches?.[state.gameKey]?.id || `legacy-${state?.gameKey || "game"}`;
}

function addGameTools() {
  const state = readCore();
  const toolbar = document.querySelector(".game-toolbar");
  if (!state || !isGameScreen(state) || !toolbar) return;

  if (!toolbar.querySelector(".focus-toggle")) {
    const focus = document.createElement("button");
    focus.type = "button";
    focus.className = "secondary focus-toggle";
    focus.textContent = readPolish().focus ? "Full view" : "Focus";
    focus.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const next = writePolish({ focus: !readPolish().focus });
      focus.textContent = next.focus ? "Full view" : "Focus";
    });
    toolbar.appendChild(focus);
  }

  if (document.querySelector(".game-tools-panel")) return;
  const people = participants(state);
  const matchKey = currentMatchKey(state);
  const polish = readPolish();
  const dealerIndex = polish.dealerByMatch?.[matchKey];
  const dealerName = Number.isInteger(dealerIndex) && people[dealerIndex] ? people[dealerIndex].name : "Not chosen";

  const details = document.createElement("details");
  details.className = "game-tools-panel";
  details.innerHTML = `
    <summary><span>Game tools</span><strong class="dealer-status">Dealer: ${escapeText(dealerName)}</strong></summary>
    <div class="game-tools-grid">
      <button type="button" class="secondary" data-tool="dealer">${Number.isInteger(dealerIndex) ? "Next dealer" : "Pick dealer"}</button>
      <button type="button" class="secondary" data-tool="random">Random player</button>
      <button type="button" class="secondary" data-tool="coin">Coin flip</button>
      <button type="button" class="secondary" data-tool="die">Roll D6</button>
    </div>
    <div class="tool-result" aria-live="polite"></div>
  `;

  details.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-tool]");
    if (!button) return;
    event.preventDefault();
    const result = details.querySelector(".tool-result");
    const latestPeople = participants();
    if (!latestPeople.length) return;

    if (button.dataset.tool === "dealer") {
      const latestPolish = readPolish();
      const current = latestPolish.dealerByMatch?.[matchKey];
      const nextIndex = Number.isInteger(current) ? (current + 1) % latestPeople.length : Math.floor(Math.random() * latestPeople.length);
      const dealerByMatch = { ...(latestPolish.dealerByMatch || {}), [matchKey]: nextIndex };
      writePolish({ dealerByMatch });
      const name = latestPeople[nextIndex].name;
      details.querySelector(".dealer-status").textContent = `Dealer: ${name}`;
      button.textContent = "Next dealer";
      result.textContent = `${name} deals.`;
    }

    if (button.dataset.tool === "random") {
      const choice = latestPeople[Math.floor(Math.random() * latestPeople.length)];
      result.textContent = `${choice.name} was picked.`;
    }

    if (button.dataset.tool === "coin") {
      result.textContent = Math.random() < 0.5 ? "Heads" : "Tails";
    }

    if (button.dataset.tool === "die") {
      result.textContent = `You rolled ${Math.floor(Math.random() * 6) + 1}.`;
    }
  });

  toolbar.after(details);
}

function escapeText(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char]));
}

function matchForCurrentState(state) {
  const matchId = state?.activeMatches?.[state.gameKey]?.matchId || state?.activeMatches?.[state.gameKey]?.id;
  return (state?.matches || []).find((match) => match.id === matchId) || (state?.matches || []).find((match) => match.gameKey === state?.gameKey);
}

function resultShareText(state, match) {
  const game = gameLabel(state, match);
  const sides = match?.sides?.map((side) => side.label) || state?.games?.[state.gameKey]?.teams || [];
  const scores = match?.scores || state?.games?.[state.gameKey]?.scores || [];
  const winnerLabels = (match?.winnerIndexes || []).map((index) => sides[index]).filter(Boolean);
  const result = match?.isTie ? "Tie game" : winnerLabels.length ? `${winnerLabels.join(" & ")} won` : "Match complete";
  return `${game}: ${result}. ${sides.map((side, index) => `${side} ${scores[index] ?? 0}`).join(" – ")}. Scored with Multi-Game Scorer.`;
}

function addResultPolish() {
  const state = readCore();
  const winner = document.querySelector(".winner-result");
  if (!state || !winner || winner.querySelector(".result-extras")) return;
  const match = matchForCurrentState(state);

  const extras = document.createElement("div");
  extras.className = "result-extras";
  const meta = [];
  if (match?.hands) meta.push(`${match.hands} ${match.hands === 1 ? "hand" : "hands"}`);
  if (match?.startedAt && match?.endedAt) {
    const minutes = Math.max(1, Math.round((new Date(match.endedAt) - new Date(match.startedAt)) / 60000));
    if (Number.isFinite(minutes)) meta.push(`${minutes} min`);
  }
  extras.innerHTML = `${meta.length ? `<span class="result-meta">${meta.join(" · ")}</span>` : ""}<div class="result-actions"><button type="button" class="secondary share-result">Share result</button><button type="button" class="secondary view-players" data-action="players">Player stats</button></div>`;

  extras.querySelector(".share-result").addEventListener("click", async () => {
    const latestState = readCore();
    const text = resultShareText(latestState, matchForCurrentState(latestState));
    try {
      if (navigator.share) {
        await navigator.share({ title: "Game result", text });
        return;
      }
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        showToast("Result copied.");
        return;
      }
      window.prompt("Copy your result", text);
    } catch (error) {
      if (error?.name !== "AbortError") showToast("Could not share this result.");
    }
  });

  winner.appendChild(extras);
}

function paletteMarkup(selected) {
  return PALETTES.map((palette) => `
    <button type="button" class="palette-choice ${selected === palette.key ? "active" : ""}" data-palette-choice="${palette.key}">
      <span class="palette-preview palette-${palette.key}"><i></i><i></i><i></i></span>
      <span>${palette.label}</span>
    </button>
  `).join("");
}

function addSettings() {
  const state = readCore();
  if (!state || state.screen !== "data") return;
  const section = document.querySelector(".section-block");
  if (!section || section.querySelector(".polish-settings")) return;
  const polish = readPolish();
  const danger = section.querySelector(".danger-zone");

  const card = document.createElement("div");
  card.className = "data-card polish-settings";
  card.innerHTML = `
    <h3>Game Night Settings</h3>
    <p>Make the scorer feel like yours.</p>
    <div class="setting-label">Colour palette</div>
    <div class="palette-grid">${paletteMarkup(polish.palette)}</div>
    <label class="wake-setting">
      <span><strong>Keep screen awake</strong><small>${navigator.wakeLock?.request ? "Prevents the display sleeping during a game." : "Not supported by this browser."}</small></span>
      <input type="checkbox" ${polish.keepAwake ? "checked" : ""} ${navigator.wakeLock?.request ? "" : "disabled"} />
    </label>
  `;

  card.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-palette-choice]");
    if (!button) return;
    writePolish({ palette: button.dataset.paletteChoice });
    card.querySelectorAll(".palette-choice").forEach((item) => item.classList.toggle("active", item === button));
  });
  card.querySelector('.wake-setting input[type="checkbox"]')?.addEventListener("change", (event) => {
    writePolish({ keepAwake: event.target.checked });
  });

  if (danger) danger.before(card); else section.appendChild(card);
}

function showToast(message) {
  let toast = document.querySelector(".polish-toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.className = "polish-toast";
    toast.setAttribute("role", "status");
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 1700);
}

function refresh() {
  applyPalette();
  applyFocus();
  addPlayerColourControls();
  addTeamColourStrips();
  addSetupTools();
  addGameTools();
  addResultPolish();
  addSettings();
  syncWakeLock();
}

const observer = new MutationObserver(() => {
  if (observerQueued) return;
  observerQueued = true;
  queueMicrotask(() => {
    observerQueued = false;
    refresh();
  });
});
observer.observe(document.documentElement, { childList: true, subtree: true });

document.addEventListener("visibilitychange", syncWakeLock);
document.addEventListener("DOMContentLoaded", refresh);
window.addEventListener("pagehide", releaseWakeLock);
queueMicrotask(refresh);
