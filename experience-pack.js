const CORE_KEY = "multiGameScorer:v6";
const EXPERIENCE_KEY = "multiGameScorer:experience:v1";

const GAME_LABELS = {
  fiveHundred: "Five Hundred",
  spades: "Spades",
  hearts: "Hearts",
  canasta: "Canasta",
  golf: "Golf",
  euchre: "Euchre",
  ohHell: "Oh Hell",
  phase10: "Phase 10",
  general: "General",
  cribbage: "Cribbage"
};

const defaultExperience = {
  favorites: [],
  groups: [],
  matchGame: "all",
  matchPlayer: "all"
};

let refreshQueued = false;

function readCore() {
  try {
    return JSON.parse(localStorage.getItem(CORE_KEY)) || null;
  } catch {
    return null;
  }
}

function readExperience() {
  try {
    const saved = JSON.parse(localStorage.getItem(EXPERIENCE_KEY)) || {};
    return {
      ...defaultExperience,
      ...saved,
      favorites: Array.isArray(saved.favorites) ? saved.favorites : [],
      groups: Array.isArray(saved.groups) ? saved.groups : []
    };
  } catch {
    return { ...defaultExperience };
  }
}

function writeExperience(patch) {
  const next = { ...readExperience(), ...patch };
  localStorage.setItem(EXPERIENCE_KEY, JSON.stringify(next));
  return next;
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

function makeId(prefix) {
  if (globalThis.crypto?.randomUUID) return `${prefix}_${crypto.randomUUID()}`;
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function showToast(message) {
  let toast = document.querySelector(".experience-toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.className = "experience-toast";
    toast.setAttribute("role", "status");
    toast.setAttribute("aria-live", "polite");
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 1800);
}

function renameDataToSettings() {
  document.querySelectorAll('.app-nav button[data-action="data"]').forEach((button) => {
    if (button.dataset.settingsLabel === "true") return;
    button.innerHTML = "<span>⚙</span>Settings";
    button.dataset.settingsLabel = "true";
  });

  const state = readCore();
  if (state?.screen !== "data") return;
  const section = document.querySelector(".section-block");
  if (!section) return;
  const eyebrow = section.querySelector(".section-heading-row .eyebrow");
  const heading = section.querySelector(".section-heading-row h2");
  if (eyebrow) eyebrow.textContent = "Preferences & data";
  if (heading) heading.textContent = "Settings";
}

function favoriteOrder(a, b, favorites) {
  const ai = favorites.indexOf(a.dataset.game);
  const bi = favorites.indexOf(b.dataset.game);
  const aFav = ai >= 0;
  const bFav = bi >= 0;
  if (aFav && bFav) return ai - bi;
  if (aFav) return -1;
  if (bFav) return 1;
  return Number(a.dataset.originalOrder || 0) - Number(b.dataset.originalOrder || 0);
}

function rebuildFavoriteGrid(grid) {
  const experience = readExperience();
  const wrappers = [...grid.querySelectorAll(":scope > .experience-game-wrap")];
  if (!wrappers.length) return;

  grid.querySelectorAll(":scope > .game-grid-heading").forEach((node) => node.remove());
  wrappers.sort((a, b) => favoriteOrder(a, b, experience.favorites));
  wrappers.forEach((wrapper) => {
    const active = experience.favorites.includes(wrapper.dataset.game);
    wrapper.classList.toggle("is-favorite", active);
    const star = wrapper.querySelector(".favorite-toggle");
    if (star) {
      star.classList.toggle("active", active);
      star.setAttribute("aria-pressed", String(active));
      star.title = active ? "Remove from favourites" : "Add to favourites";
      star.textContent = active ? "★" : "☆";
    }
  });

  const favorites = wrappers.filter((wrapper) => experience.favorites.includes(wrapper.dataset.game));
  const others = wrappers.filter((wrapper) => !experience.favorites.includes(wrapper.dataset.game));

  if (favorites.length) {
    const favHeading = document.createElement("div");
    favHeading.className = "game-grid-heading";
    favHeading.textContent = "Favourites";
    grid.appendChild(favHeading);
    favorites.forEach((wrapper) => grid.appendChild(wrapper));

    if (others.length) {
      const allHeading = document.createElement("div");
      allHeading.className = "game-grid-heading";
      allHeading.textContent = "All games";
      grid.appendChild(allHeading);
    }
  }
  others.forEach((wrapper) => grid.appendChild(wrapper));
}

function enhanceFavoriteGames() {
  const state = readCore();
  if (state?.screen !== "home") return;
  const grid = document.querySelector(".game-grid");
  if (!grid) return;

  const directTiles = [...grid.querySelectorAll(":scope > .game-tile[data-game]")];
  directTiles.forEach((tile, index) => {
    const gameKey = tile.dataset.game;
    const wrapper = document.createElement("div");
    wrapper.className = "experience-game-wrap";
    wrapper.dataset.game = gameKey;
    wrapper.dataset.originalOrder = String(index);
    grid.insertBefore(wrapper, tile);
    wrapper.appendChild(tile);

    const favorite = document.createElement("button");
    favorite.type = "button";
    favorite.className = "favorite-toggle";
    favorite.setAttribute("aria-label", `Favourite ${GAME_LABELS[gameKey] || gameKey}`);
    favorite.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const experience = readExperience();
      const favorites = experience.favorites.filter((key) => key !== gameKey);
      if (!experience.favorites.includes(gameKey)) favorites.push(gameKey);
      writeExperience({ favorites });
      rebuildFavoriteGrid(grid);
    });
    wrapper.appendChild(favorite);
  });

  if (!grid.parentElement?.querySelector(".favorite-hint")) {
    const hint = document.createElement("p");
    hint.className = "favorite-hint";
    hint.textContent = "Tap the star to keep your regular games at the top.";
    grid.before(hint);
  }

  rebuildFavoriteGrid(grid);
}

function setupInputs() {
  return [...document.querySelectorAll('.setup-panel input[data-action="setup-name"]')];
}

function setSetupInput(input, value) {
  input.value = value;
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

function fillSetupNames(names) {
  const inputs = setupInputs();
  if (!inputs.length) return;
  names.slice(0, inputs.length).forEach((name, index) => setSetupInput(inputs[index], name));
}

function recentPlayerNames(state) {
  const playerById = new Map((state?.players || []).map((player) => [player.id, player.name]));
  const seen = new Set();
  const names = [];
  const add = (name) => {
    const clean = String(name || "").trim();
    const folded = clean.toLocaleLowerCase();
    if (!clean || seen.has(folded)) return;
    seen.add(folded);
    names.push(clean);
  };

  for (const match of state?.matches || []) {
    for (const side of match.sides || []) {
      for (const id of side.playerIds || []) add(playerById.get(id));
    }
    if (names.length >= 8) break;
  }

  [...(state?.players || [])]
    .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))
    .forEach((player) => add(player.name));

  return names.slice(0, 8);
}

function saveCurrentGroup() {
  const names = setupInputs().map((input) => input.value.trim());
  if (!names.length || names.some((name) => !name)) {
    showToast("Enter every player first.");
    return;
  }
  if (new Set(names.map((name) => name.toLocaleLowerCase())).size !== names.length) {
    showToast("Each player can only appear once.");
    return;
  }

  const suggested = names.length === 4 ? "Game Night Crew" : `${names.length}-Player Group`;
  const label = window.prompt("Name this player group", suggested)?.trim();
  if (!label) return;

  const experience = readExperience();
  const existingIndex = experience.groups.findIndex((group) => group.label.toLocaleLowerCase() === label.toLocaleLowerCase());
  const group = { id: existingIndex >= 0 ? experience.groups[existingIndex].id : makeId("group"), label, names, updatedAt: new Date().toISOString() };
  const groups = experience.groups.slice();
  if (existingIndex >= 0) groups[existingIndex] = group;
  else groups.unshift(group);
  writeExperience({ groups: groups.slice(0, 20) });
  showToast(`${label} saved.`);
  addSetupShortcuts(true);
}

function addSetupShortcuts(force = false) {
  const state = readCore();
  const panel = document.querySelector(".setup-panel");
  if (!state || state.screen !== "setup" || !panel) return;
  if (force) panel.querySelector(".experience-setup-shortcuts")?.remove();
  if (panel.querySelector(".experience-setup-shortcuts")) return;

  const inputs = setupInputs();
  if (!inputs.length) return;
  const experience = readExperience();
  const recent = recentPlayerNames(state);
  const groups = experience.groups.filter((group) => Array.isArray(group.names) && group.names.length === inputs.length);

  const block = document.createElement("section");
  block.className = "experience-setup-shortcuts";
  block.innerHTML = `
    ${recent.length ? `
      <div class="experience-shortcut-row">
        <div class="experience-subhead">Recent players</div>
        <div class="player-chip-row">
          ${recent.map((name) => `<button type="button" class="player-chip" data-recent-name="${escapeText(name)}">${escapeText(name)}</button>`).join("")}
        </div>
      </div>
    ` : ""}
    ${groups.length ? `
      <div class="experience-shortcut-row">
        <div class="experience-subhead">Saved groups</div>
        <div class="saved-group-grid">
          ${groups.map((group) => `<button type="button" class="saved-group-chip" data-group-id="${escapeText(group.id)}"><strong>${escapeText(group.label)}</strong><span>${group.names.map(escapeText).join(" · ")}</span></button>`).join("")}
        </div>
      </div>
    ` : ""}
    <button type="button" class="secondary save-player-group">Save these players as a group</button>
  `;

  block.addEventListener("click", (event) => {
    const recentButton = event.target.closest("button[data-recent-name]");
    if (recentButton) {
      const name = recentButton.dataset.recentName;
      const current = setupInputs();
      if (current.some((input) => input.value.trim().toLocaleLowerCase() === name.toLocaleLowerCase())) {
        showToast(`${name} is already selected.`);
        return;
      }
      const target = current.find((input) => !input.value.trim());
      if (!target) {
        showToast("All player spots are already filled.");
        return;
      }
      setSetupInput(target, name);
      return;
    }

    const groupButton = event.target.closest("button[data-group-id]");
    if (groupButton) {
      const group = readExperience().groups.find((item) => item.id === groupButton.dataset.groupId);
      if (!group) return;
      fillSetupNames(group.names);
      showToast(`${group.label} loaded.`);
      return;
    }

    if (event.target.closest(".save-player-group")) saveCurrentGroup();
  });

  const sides = panel.querySelector(".setup-sides");
  if (sides) sides.before(block);
}

function addSavedGroupSettings(force = false) {
  const state = readCore();
  if (state?.screen !== "data") return;
  const section = document.querySelector(".section-block");
  if (!section) return;
  if (force) section.querySelector(".experience-group-settings")?.remove();
  if (section.querySelector(".experience-group-settings")) return;

  const experience = readExperience();
  const card = document.createElement("div");
  card.className = "data-card experience-group-settings";
  card.innerHTML = `
    <h3>Saved player groups</h3>
    <p>One-tap groups make repeat game nights faster.</p>
    ${experience.groups.length ? `
      <div class="settings-group-list">
        ${experience.groups.map((group) => `
          <div class="settings-group-row">
            <div><strong>${escapeText(group.label)}</strong><span>${(group.names || []).map(escapeText).join(" · ")}</span></div>
            <button type="button" class="danger compact-danger" data-delete-group="${escapeText(group.id)}">Delete</button>
          </div>
        `).join("")}
      </div>
    ` : `<div class="experience-empty">No saved groups yet. Create one from any New Match screen.</div>`}
  `;

  card.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-delete-group]");
    if (!button) return;
    const experience = readExperience();
    const group = experience.groups.find((item) => item.id === button.dataset.deleteGroup);
    if (!group) return;
    if (!confirm(`Delete ${group.label}?`)) return;
    writeExperience({ groups: experience.groups.filter((item) => item.id !== group.id) });
    addSavedGroupSettings(true);
  });

  const danger = section.querySelector(".danger-zone");
  if (danger) danger.before(card); else section.appendChild(card);
}

function playerMatchSide(match, playerId) {
  return (match.sides || []).findIndex((side) => (side.playerIds || []).includes(playerId));
}

function rivalryData(state, playerId) {
  const stats = new Map();
  const relevant = (state.matches || []).filter((match) => playerMatchSide(match, playerId) >= 0);

  for (const match of relevant) {
    const playerSide = playerMatchSide(match, playerId);
    const isWin = (match.winnerIndexes || []).includes(playerSide);
    const isTie = Boolean(match.isTie);
    const opponents = new Set();
    (match.sides || []).forEach((side, sideIndex) => {
      if (sideIndex === playerSide) return;
      (side.playerIds || []).forEach((id) => {
        if (id && id !== playerId) opponents.add(id);
      });
    });

    opponents.forEach((opponentId) => {
      const current = stats.get(opponentId) || { played: 0, wins: 0, losses: 0, ties: 0 };
      current.played += 1;
      if (isTie) current.ties += 1;
      else if (isWin) current.wins += 1;
      else current.losses += 1;
      stats.set(opponentId, current);
    });
  }

  return [...stats.entries()]
    .map(([opponentId, values]) => ({ opponentId, ...values }))
    .sort((a, b) => b.played - a.played || b.wins - a.wins);
}

function currentWinStreak(state, playerId) {
  let streak = 0;
  for (const match of state.matches || []) {
    const side = playerMatchSide(match, playerId);
    if (side < 0) continue;
    if (match.isTie || !(match.winnerIndexes || []).includes(side)) break;
    streak += 1;
  }
  return streak;
}

function enhancePlayerStats() {
  const state = readCore();
  if (state?.screen !== "players") return;
  const playerByName = new Map((state.players || []).map((player) => [player.name, player]));
  const playerById = new Map((state.players || []).map((player) => [player.id, player]));

  document.querySelectorAll(".player-card").forEach((card) => {
    if (card.querySelector(".rivalry-details")) return;
    const name = card.querySelector(".player-card-main strong")?.textContent?.trim();
    const player = playerByName.get(name);
    if (!player) return;

    const streak = currentWinStreak(state, player.id);
    const rivalries = rivalryData(state, player.id).slice(0, 3);
    const details = document.createElement("details");
    details.className = "rivalry-details";
    details.innerHTML = `
      <summary>Rivalries & streaks${streak >= 2 ? `<span class="streak-badge">${streak} wins in a row</span>` : ""}</summary>
      <div class="rivalry-body">
        <div class="streak-line"><strong>Current win streak</strong><span>${streak ? `${streak} ${streak === 1 ? "game" : "games"}` : "—"}</span></div>
        ${rivalries.length ? rivalries.map((rivalry) => {
          const opponent = playerById.get(rivalry.opponentId);
          if (!opponent) return "";
          const tieText = rivalry.ties ? ` · ${rivalry.ties} ${rivalry.ties === 1 ? "tie" : "ties"}` : "";
          return `<div class="rivalry-line"><strong>vs ${escapeText(opponent.name)}</strong><span>${rivalry.wins}–${rivalry.losses}${tieText} · ${rivalry.played} played</span></div>`;
        }).join("") : `<div class="experience-empty">Play a few saved matches to build rivalries.</div>`}
      </div>
    `;
    card.appendChild(details);
  });
}

function enhanceWinnerScreen() {
  const state = readCore();
  if (!state || !["score", "table", "history", "rules"].includes(state.screen)) return;
  const winner = document.querySelector(".winner-result");
  if (!winner) return;
  winner.classList.add("experience-winner");

  const kicker = winner.querySelector(".winner-kicker");
  if (kicker && !kicker.dataset.experienceLabel) {
    kicker.textContent = `${GAME_LABELS[state.gameKey] || "Game"} · Match complete`;
    kicker.dataset.experienceLabel = "true";
  }

  const resultActions = winner.querySelector(".result-actions");
  if (resultActions && !resultActions.querySelector(".result-home")) {
    const home = document.createElement("button");
    home.type = "button";
    home.className = "secondary result-home";
    home.dataset.action = "home";
    home.textContent = "Home";
    resultActions.appendChild(home);
  }
}

function matchHasPlayer(match, playerId) {
  if (playerId === "all") return true;
  return (match.sides || []).some((side) => (side.playerIds || []).includes(playerId));
}

function applyMatchFilters(state, toolbar) {
  const experience = readExperience();
  const rows = [...document.querySelectorAll(".match-list.full .match-row")];
  let visible = 0;
  rows.forEach((row, index) => {
    const match = state.matches?.[index];
    if (!match) return;
    const gameMatches = experience.matchGame === "all" || match.gameKey === experience.matchGame;
    const playerMatches = matchHasPlayer(match, experience.matchPlayer);
    const show = gameMatches && playerMatches;
    row.hidden = !show;
    if (show) visible += 1;
  });
  const count = toolbar.querySelector(".filter-count");
  if (count) count.textContent = `${visible} of ${state.matches?.length || 0} matches`;
  const empty = toolbar.parentElement?.querySelector(".filtered-empty");
  if (empty) empty.hidden = visible !== 0;
}

function addMatchFilters() {
  const state = readCore();
  if (state?.screen !== "matches" || !state.matches?.length) return;
  const list = document.querySelector(".match-list.full");
  if (!list) return;
  let toolbar = list.parentElement?.querySelector(".match-filter-bar");
  if (toolbar) {
    applyMatchFilters(state, toolbar);
    return;
  }

  const experience = readExperience();
  const games = [...new Map(state.matches.map((match) => [match.gameKey, match.gameLabel || GAME_LABELS[match.gameKey] || match.gameKey])).entries()]
    .sort((a, b) => a[1].localeCompare(b[1]));
  const players = [...(state.players || [])].sort((a, b) => a.name.localeCompare(b.name));

  toolbar = document.createElement("div");
  toolbar.className = "match-filter-bar";
  toolbar.innerHTML = `
    <label>Game
      <select class="match-game-filter">
        <option value="all">All games</option>
        ${games.map(([key, label]) => `<option value="${escapeText(key)}" ${experience.matchGame === key ? "selected" : ""}>${escapeText(label)}</option>`).join("")}
      </select>
    </label>
    <label>Player
      <select class="match-player-filter">
        <option value="all">All players</option>
        ${players.map((player) => `<option value="${escapeText(player.id)}" ${experience.matchPlayer === player.id ? "selected" : ""}>${escapeText(player.name)}</option>`).join("")}
      </select>
    </label>
    <span class="filter-count"></span>
  `;

  const filteredEmpty = document.createElement("div");
  filteredEmpty.className = "empty-state filtered-empty";
  filteredEmpty.innerHTML = "<strong>No matches found.</strong><span>Try a different game or player filter.</span>";
  filteredEmpty.hidden = true;

  toolbar.querySelector(".match-game-filter").addEventListener("change", (event) => {
    writeExperience({ matchGame: event.target.value });
    applyMatchFilters(readCore(), toolbar);
  });
  toolbar.querySelector(".match-player-filter").addEventListener("change", (event) => {
    writeExperience({ matchPlayer: event.target.value });
    applyMatchFilters(readCore(), toolbar);
  });

  list.before(toolbar);
  list.after(filteredEmpty);
  applyMatchFilters(state, toolbar);
}

function refresh() {
  renameDataToSettings();
  enhanceFavoriteGames();
  addSetupShortcuts();
  addSavedGroupSettings();
  enhancePlayerStats();
  enhanceWinnerScreen();
  addMatchFilters();
}

const observer = new MutationObserver(() => {
  if (refreshQueued) return;
  refreshQueued = true;
  queueMicrotask(() => {
    refreshQueued = false;
    refresh();
  });
});
observer.observe(document.documentElement, { childList: true, subtree: true });

document.addEventListener("DOMContentLoaded", refresh);
queueMicrotask(refresh);
