import { gameOrder, games } from "./games/index.js?v=21";
import { clone, escapeHtml, signed } from "./games/shared.js?v=12";

const STORAGE_KEY = "multiGameScorer:v6";
const LEGACY_STORAGE_KEY = "multiGameScorer:v5";
const VERY_OLD_KEYS = ["fiveHundredScorer:v1", "multiGameScorer:v2"];
const PARTNERSHIP_GAMES = new Set(["fiveHundred", "spades", "canasta", "euchre"]);
const MAX_MATCHES = 500;

const initialState = {
  version: 6,
  gameKey: "fiveHundred",
  screen: "home",
  darkMode: false,
  games: Object.fromEntries(gameOrder.map((key) => [key, games[key].createState()])),
  players: [],
  matches: [],
  activeMatches: {},
  setup: null,
  notice: ""
};

let state = loadState();
const app = document.getElementById("app");

function nowId(prefix = "id") {
  if (globalThis.crypto?.randomUUID) return `${prefix}_${crypto.randomUUID()}`;
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function normalizedName(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function loadState() {
  try {
    VERY_OLD_KEYS.forEach((key) => localStorage.removeItem(key));
    const params = new URLSearchParams(window.location.search);
    if (params.has("reset")) {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(LEGACY_STORAGE_KEY);
      params.delete("reset");
      const cleanQuery = params.toString();
      window.history.replaceState(null, "", `${window.location.pathname}${cleanQuery ? `?${cleanQuery}` : ""}`);
    }

    const current = JSON.parse(localStorage.getItem(STORAGE_KEY));
    const legacy = current ? null : JSON.parse(localStorage.getItem(LEGACY_STORAGE_KEY));
    const saved = current || legacy;
    if (!saved) return clone(initialState);

    const freshGames = clone(initialState).games;
    const migrated = {
      ...clone(initialState),
      ...saved,
      version: 6,
      games: {
        ...freshGames,
        ...(saved.games || {})
      },
      players: Array.isArray(saved.players) ? saved.players : [],
      matches: Array.isArray(saved.matches) ? saved.matches : [],
      activeMatches: saved.activeMatches && typeof saved.activeMatches === "object" ? saved.activeMatches : {},
      setup: null,
      notice: ""
    };

    if (legacy) migrated.screen = "home";
    return migrated;
  } catch {
    return clone(initialState);
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function setState(patch, shouldRender = true) {
  state = { ...state, ...patch };
  saveState();
  if (shouldRender) render();
}

function activeGame() {
  return games[state.gameKey];
}

function gameState(gameKey = state.gameKey) {
  return state.games[gameKey];
}

function updateGame(patch, shouldRender = true) {
  state = {
    ...state,
    games: {
      ...state.games,
      [state.gameKey]: {
        ...gameState(),
        ...patch
      }
    }
  };
  saveState();
  if (shouldRender) render();
}

function appHeader({ compact = false } = {}) {
  return `
    <header class="hero ${compact ? "compact-hero" : ""}">
      <div class="title-block">
        <div class="title-row">
          <div>
            <h1>${compact ? "Scorer" : "Multi-Game Scorer"}</h1>
            <p>${compact ? "Game night, remembered." : "Automatic scoring, saved players, and match history."}</p>
          </div>
          <button class="theme-toggle ${state.darkMode ? "active" : ""}" data-action="theme" aria-pressed="${state.darkMode}" aria-label="Toggle dark mode"><span></span></button>
        </div>
      </div>
      ${compact ? "" : `
        <div class="card-stack" aria-hidden="true">
          <div class="playing-card card-back"><span class="card-pattern">◆</span></div>
          <div class="playing-card card-mid red-card"><span class="corner top">Q<br>♥</span><span class="pip">♥</span><span class="corner bottom">Q<br>♥</span></div>
          <div class="playing-card card-front"><span class="corner top">A<br>♠</span><span class="pip">♠</span><span class="corner bottom">A<br>♠</span></div>
        </div>
      `}
    </header>
  `;
}

function bottomNav(active = "home") {
  return `
    <nav class="app-nav" aria-label="Main navigation">
      <button class="${active === "home" ? "active" : ""}" data-action="home"><span>⌂</span>Home</button>
      <button class="${active === "players" ? "active" : ""}" data-action="players"><span>♟</span>Players</button>
      <button class="${active === "matches" ? "active" : ""}" data-action="matches"><span>≡</span>Matches</button>
      <button class="${active === "data" ? "active" : ""}" data-action="data"><span>↕</span>Data</button>
    </nav>
  `;
}

function isGameInProgress(key) {
  const g = gameState(key);
  const active = state.activeMatches[key];
  if (active && !active.saved) return true;
  return Boolean(g?.history?.length || g?.scores?.some((score) => Number(score) !== 0));
}

function homeScreen() {
  const recent = state.matches.slice(0, 4);
  const resumable = gameOrder.filter(isGameInProgress).slice(0, 3);
  const totalWins = state.matches.filter((match) => match.winnerIndexes?.length).length;
  return `
    <main class="shell home-shell">
      ${appHeader()}
      ${state.notice ? `<div class="notice">${escapeHtml(state.notice)}</div>` : ""}

      <section class="home-summary">
        <div><strong>${state.players.length}</strong><span>Players</span></div>
        <div><strong>${state.matches.length}</strong><span>Matches</span></div>
        <div><strong>${totalWins}</strong><span>Decided</span></div>
      </section>

      ${resumable.length ? `
        <section class="section-block">
          <div class="section-heading-row"><div><span class="eyebrow">Continue</span><h2>Pick up where you left off</h2></div></div>
          <div class="resume-grid">
            ${resumable.map((key) => {
              const g = gameState(key);
              return `<button class="resume-card" data-action="resume-game" data-game="${key}"><strong>${escapeHtml(games[key].label)}</strong><span>${g.teams.map((team, index) => `${escapeHtml(team)} ${g.scores[index]}`).join(" · ")}</span></button>`;
            }).join("")}
          </div>
        </section>
      ` : ""}

      <section class="section-block">
        <div class="section-heading-row"><div><span class="eyebrow">New match</span><h2>Choose a game</h2></div></div>
        <div class="game-grid">
          ${gameOrder.map((key) => `
            <button class="game-tile" data-action="choose-game" data-game="${key}">
              <span class="game-mark">${gameMark(key)}</span>
              <strong>${escapeHtml(games[key].label)}</strong>
              <small>${gameSubtitle(key)}</small>
            </button>
          `).join("")}
        </div>
      </section>

      <section class="section-block">
        <div class="section-heading-row">
          <div><span class="eyebrow">Recent</span><h2>Match history</h2></div>
          <button class="text-button" data-action="matches">View all</button>
        </div>
        ${recent.length ? `<div class="match-list">${recent.map(renderMatchRow).join("")}</div>` : `<div class="empty-state"><strong>No saved matches yet.</strong><span>Your first completed game will appear here automatically.</span></div>`}
      </section>
      ${bottomNav("home")}
    </main>
  `;
}

function gameMark(key) {
  const marks = {
    fiveHundred: "500",
    spades: "♠",
    hearts: "♥",
    canasta: "C",
    golf: "9",
    euchre: "E",
    ohHell: "OH",
    phase10: "10",
    general: "+",
    cribbage: "♣"
  };
  return marks[key] || "•";
}

function gameSubtitle(key) {
  const subtitles = {
    fiveHundred: "Bids & tricks",
    spades: "Bids, bags & tricks",
    hearts: "Low score wins",
    canasta: "Standard & Samba",
    golf: "Nine-round scoring",
    euchre: "Made, march & loner",
    ohHell: "Bids & exact tricks",
    phase10: "Phases & points",
    general: "Simple flexible scoring",
    cribbage: "Race to 121"
  };
  return subtitles[key] || "Automatic scoring";
}

function setupForGame(gameKey) {
  const fresh = games[gameKey].createState();
  const memberCount = PARTNERSHIP_GAMES.has(gameKey) ? 2 : 1;
  return {
    gameKey,
    memberCount,
    names: fresh.teams.map(() => Array.from({ length: memberCount }, () => "")),
    error: ""
  };
}

function openSetup(gameKey = state.gameKey) {
  const active = state.activeMatches[gameKey];
  const hasUnsavedActiveMatch = Boolean(active && !active.saved);
  const hasLegacyProgress = Boolean(!active && isGameInProgress(gameKey));
  if ((hasUnsavedActiveMatch || hasLegacyProgress) && !confirm(`Start a new ${games[gameKey].label} match? The unfinished score for this game will be replaced.`)) return;
  setState({ gameKey, screen: "setup", setup: setupForGame(gameKey), notice: "" });
}

function setupScreen() {
  const setup = state.setup || setupForGame(state.gameKey);
  const gameDef = games[setup.gameKey];
  const existingNames = state.players.map((player) => player.name);
  return `
    <main class="shell">
      ${appHeader({ compact: true })}
      <section class="panel setup-panel">
        <button class="back-link" data-action="home">← Home</button>
        <span class="eyebrow">New match</span>
        <h2>${escapeHtml(gameDef.fullName || gameDef.label)}</h2>
        <p class="panel-intro">Choose who is playing. Existing names are remembered; new names become player profiles automatically.</p>
        ${setup.error ? `<div class="form-error">${escapeHtml(setup.error)}</div>` : ""}
        <datalist id="saved-player-names">${existingNames.map((name) => `<option value="${escapeHtml(name)}"></option>`).join("")}</datalist>
        <div class="setup-sides">
          ${setup.names.map((members, sideIndex) => `
            <section class="setup-side">
              <div class="setup-side-title">${setup.names.length === 2 && setup.memberCount > 1 ? `Team ${sideIndex + 1}` : setup.memberCount > 1 ? `Side ${sideIndex + 1}` : `Player ${sideIndex + 1}`}</div>
              ${members.map((name, memberIndex) => `
                <div class="field">
                  <label for="setup-${sideIndex}-${memberIndex}">${setup.memberCount > 1 ? `Player ${memberIndex + 1}` : "Name"}</label>
                  <input id="setup-${sideIndex}-${memberIndex}" list="saved-player-names" autocomplete="off" data-action="setup-name" data-side="${sideIndex}" data-member="${memberIndex}" value="${escapeHtml(name)}" placeholder="Enter name" />
                </div>
              `).join("")}
            </section>
          `).join("")}
        </div>
        <div class="setup-meta">
          <span>${setup.names.length * setup.memberCount} players</span>
          <span>Target ${gameDef.target ?? gameState(setup.gameKey)?.target ?? "—"}</span>
        </div>
        <button class="primary wide-button" data-action="start-match">Start ${escapeHtml(gameDef.label)}</button>
      </section>
      ${bottomNav("")}
    </main>
  `;
}

function ensurePlayer(name, players) {
  const clean = normalizedName(name);
  const existing = players.find((player) => player.name.toLocaleLowerCase() === clean.toLocaleLowerCase());
  if (existing) return existing.id;
  const player = { id: nowId("player"), name: clean, createdAt: new Date().toISOString() };
  players.push(player);
  return player.id;
}

function startMatch() {
  const setup = state.setup;
  if (!setup) return;
  const names = setup.names.map((members) => members.map(normalizedName));
  const flat = names.flat();
  if (flat.some((name) => !name)) {
    setState({ setup: { ...setup, error: "Enter a name for every player." } });
    return;
  }
  const folded = flat.map((name) => name.toLocaleLowerCase());
  if (new Set(folded).size !== folded.length) {
    setState({ setup: { ...setup, error: "Each player can only appear once in a match." } });
    return;
  }

  const players = state.players.map((player) => ({ ...player }));
  const sidePlayerIds = names.map((members) => members.map((name) => ensurePlayer(name, players)));
  const labels = names.map((members) => members.join(" & "));
  const fresh = games[setup.gameKey].createState();
  fresh.teams = labels;
  fresh.scores = labels.map(() => 0);

  const activeMatches = {
    ...state.activeMatches,
    [setup.gameKey]: {
      id: nowId("match"),
      gameKey: setup.gameKey,
      startedAt: new Date().toISOString(),
      sidePlayerIds,
      saved: false
    }
  };

  state = {
    ...state,
    players,
    games: { ...state.games, [setup.gameKey]: fresh },
    activeMatches,
    gameKey: setup.gameKey,
    screen: "score",
    setup: null,
    notice: ""
  };
  saveState();
  render();
}

function winnerIndexesFromText(winText, g) {
  if (!winText || /tie/i.test(winText)) return [];
  return g.teams.reduce((indexes, team, index) => {
    if (winText === `${team} wins` || winText.startsWith(`${team} wins`)) indexes.push(index);
    return indexes;
  }, []);
}

function ensureCurrentMatchSaved() {
  const gameDef = activeGame();
  const g = gameState();
  const winText = gameDef.winner(g);
  if (!winText) return;

  let active = state.activeMatches[state.gameKey];
  if (active?.saved) return;
  if (!active) {
    active = {
      id: nowId("match"),
      gameKey: state.gameKey,
      startedAt: null,
      sidePlayerIds: g.teams.map(() => []),
      saved: false
    };
  }

  const winnerIndexes = winnerIndexesFromText(winText, g);
  const match = {
    id: active.id,
    gameKey: state.gameKey,
    gameLabel: gameDef.label,
    startedAt: active.startedAt,
    endedAt: new Date().toISOString(),
    sides: g.teams.map((label, index) => ({ label, playerIds: active.sidePlayerIds?.[index] || [] })),
    scores: g.scores.slice(),
    winnerIndexes,
    isTie: /tie/i.test(winText),
    hands: Array.isArray(g.history) ? g.history.length : 0
  };

  state = {
    ...state,
    matches: [match, ...state.matches.filter((item) => item.id !== match.id)].slice(0, MAX_MATCHES),
    activeMatches: {
      ...state.activeMatches,
      [state.gameKey]: { ...active, saved: true, matchId: match.id }
    }
  };
  saveState();
}

function matchSideNames(match) {
  return (match.sides || []).map((side) => side.label).join(" vs ");
}

function renderMatchRow(match) {
  const winnerLabels = (match.winnerIndexes || []).map((index) => match.sides?.[index]?.label).filter(Boolean);
  const result = match.isTie ? "Tie" : winnerLabels.length ? `${winnerLabels.join(" & ")} won` : "Completed";
  const date = new Date(match.endedAt || match.startedAt || Date.now());
  return `
    <div class="match-row">
      <span class="match-badge">${escapeHtml(gameMark(match.gameKey))}</span>
      <div class="match-copy">
        <strong>${escapeHtml(match.gameLabel || games[match.gameKey]?.label || "Game")}</strong>
        <span>${escapeHtml(matchSideNames(match))}</span>
        <small>${escapeHtml(result)} · ${date.toLocaleDateString()}</small>
      </div>
      <div class="match-score">${(match.scores || []).join("–")}</div>
    </div>
  `;
}

function playerStats(playerId) {
  const played = state.matches.filter((match) => match.sides?.some((side) => side.playerIds?.includes(playerId)));
  let wins = 0;
  let ties = 0;
  const byGame = {};
  for (const match of played) {
    const sideIndex = match.sides.findIndex((side) => side.playerIds?.includes(playerId));
    if (match.isTie) ties += 1;
    if (match.winnerIndexes?.includes(sideIndex)) wins += 1;
    byGame[match.gameKey] = (byGame[match.gameKey] || 0) + 1;
  }
  const favoriteKey = Object.entries(byGame).sort((a, b) => b[1] - a[1])[0]?.[0];
  return {
    played: played.length,
    wins,
    ties,
    winRate: played.length ? Math.round((wins / played.length) * 100) : 0,
    favorite: favoriteKey ? games[favoriteKey]?.label || favoriteKey : "—"
  };
}

function playersScreen() {
  const ordered = state.players.slice().sort((a, b) => a.name.localeCompare(b.name));
  return `
    <main class="shell">
      ${appHeader({ compact: true })}
      <section class="section-block player-manager">
        <div class="section-heading-row"><div><span class="eyebrow">Profiles</span><h2>Players</h2></div></div>
        <div class="add-player-row">
          <input id="new-player-name" autocomplete="off" placeholder="Add a player name" aria-label="New player name" />
          <button class="primary" data-action="add-player">Add</button>
        </div>
        ${state.notice ? `<div class="notice">${escapeHtml(state.notice)}</div>` : ""}
        ${ordered.length ? `
          <div class="player-grid">
            ${ordered.map((player) => {
              const stats = playerStats(player.id);
              return `
                <article class="player-card">
                  <div class="avatar">${escapeHtml(player.name.charAt(0).toUpperCase())}</div>
                  <div class="player-card-main">
                    <strong>${escapeHtml(player.name)}</strong>
                    <span>${stats.played} played · ${stats.wins} won · ${stats.winRate}% win rate</span>
                    <small>Most played: ${escapeHtml(stats.favorite)}</small>
                  </div>
                </article>
              `;
            }).join("")}
          </div>
        ` : `<div class="empty-state"><strong>No player profiles yet.</strong><span>Add names here, or just start a match and profiles will be created automatically.</span></div>`}
      </section>
      ${bottomNav("players")}
    </main>
  `;
}

function matchesScreen() {
  return `
    <main class="shell">
      ${appHeader({ compact: true })}
      <section class="section-block">
        <div class="section-heading-row"><div><span class="eyebrow">Archive</span><h2>Completed matches</h2></div><span class="count-pill">${state.matches.length}</span></div>
        ${state.matches.length ? `<div class="match-list full">${state.matches.map(renderMatchRow).join("")}</div>` : `<div class="empty-state"><strong>No completed matches yet.</strong><span>Results are saved automatically when a game reaches its winning condition.</span></div>`}
      </section>
      ${bottomNav("matches")}
    </main>
  `;
}

function dataScreen() {
  return `
    <main class="shell">
      ${appHeader({ compact: true })}
      <section class="section-block">
        <div class="section-heading-row"><div><span class="eyebrow">Your data</span><h2>Backup & restore</h2></div></div>
        <div class="data-card">
          <h3>Export backup</h3>
          <p>Save players, match history, current scores, and settings to a JSON backup file.</p>
          <button class="secondary" data-action="export-data">Export backup</button>
        </div>
        <div class="data-card">
          <h3>Restore backup</h3>
          <p>Restore a backup created by this app. This replaces the data currently on this device.</p>
          <input class="hidden-file" id="import-file" type="file" accept="application/json,.json" data-action="import-file" />
          <button class="secondary" data-action="choose-import">Choose backup file</button>
        </div>
        <div class="data-card danger-zone">
          <h3>Reset app data</h3>
          <p>Clears player profiles, matches, scores, and settings on this device.</p>
          <button class="danger" data-action="reset-all">Reset everything</button>
        </div>
        ${state.notice ? `<div class="notice">${escapeHtml(state.notice)}</div>` : ""}
      </section>
      ${bottomNav("data")}
    </main>
  `;
}

function scoreCards() {
  const g = gameState();
  const gameDef = activeGame();
  const active = state.activeMatches[state.gameKey];
  const linked = active?.sidePlayerIds?.some((ids) => ids.length);
  return `
    <section class="scoreboard ${g.teams.length > 2 ? "four" : ""}" aria-label="Current scores">
      ${g.teams.map((team, index) => {
        const meta = gameDef.scoreCardMeta ? gameDef.scoreCardMeta(g, index) : [];
        return `
          <section class="score-card">
            <input class="team-name" data-action="team-name" data-team="${index}" value="${escapeHtml(team)}" aria-label="Player or team ${index + 1} name" ${linked ? "readonly" : ""} />
            ${meta.map((item) => `<span class="dealer-pill">${escapeHtml(item)}</span>`).join("")}
            <div class="score-row"><div class="score ${g.scores[index] < 0 ? "negative" : ""}">${g.scores[index]}</div></div>
          </section>
        `;
      }).join("")}
    </section>
  `;
}

function historyPanel() {
  const g = gameState();
  const items = g.history.length
    ? g.history.map((hand) => `
      <div class="history-item">
        <span class="mini-pill">${escapeHtml(activeGame().label)}</span>
        <div><strong>${escapeHtml(hand.summary)}</strong><div>${escapeHtml(hand.detail)}</div></div>
        <strong>${hand.deltas.map(signed).join(" / ")}</strong>
      </div>
    `).join("")
    : `<p>No hands yet.</p>`;
  return `
    <section class="panel">
      <h2>Hand History</h2>
      <div class="history-list">${items}</div>
      <div class="actions">
        <button class="secondary" data-action="new-match">New Match</button>
        <button class="danger" data-action="clear-current-game">Clear This Game</button>
      </div>
    </section>
  `;
}

function activePanel() {
  const gameDef = activeGame();
  const g = gameState();
  if (state.screen === "table") return gameDef.renderTable(g);
  if (state.screen === "history") return historyPanel();
  if (state.screen === "rules") return gameDef.renderRules(g);
  return gameDef.renderEntry(g);
}

function tabs() {
  return `
    <nav class="tabs" aria-label="Game sections">
      ${[["score", "Score"], ["table", "Table"], ["history", "History"], ["rules", "Rules"]].map(([key, label]) => `
        <button class="tab ${state.screen === key ? "active" : ""}" data-action="screen" data-screen="${key}">${label}</button>
      `).join("")}
    </nav>
  `;
}

function gameScreen() {
  ensureCurrentMatchSaved();
  const g = gameState();
  const gameDef = activeGame();
  const win = gameDef.winner(g);
  return `
    <main class="shell game-shell">
      ${appHeader({ compact: true })}
      <section class="game-toolbar">
        <button class="secondary" data-action="home">← Home</button>
        <div><span class="eyebrow">Current game</span><strong>${escapeHtml(gameDef.fullName || gameDef.label)}</strong></div>
        <button class="secondary" data-action="new-match">New</button>
      </section>
      ${scoreCards()}
      ${win ? `
        <section class="winner winner-result">
          <div><span class="winner-kicker">Match complete</span><strong>${escapeHtml(win)}</strong><span>Final score ${g.scores.join(" – ")}</span></div>
          <button class="secondary" data-action="new-match">Play Again</button>
        </section>
      ` : ""}
      ${activePanel()}
      ${tabs()}
    </main>
  `;
}

function undoHand() {
  const g = gameState();
  const [latest, ...rest] = g.history;
  if (!latest) return;
  const activeMatches = { ...state.activeMatches };
  if (activeMatches[state.gameKey]?.saved) {
    const matchId = activeMatches[state.gameKey].matchId;
    state.matches = state.matches.filter((match) => match.id !== matchId);
    activeMatches[state.gameKey] = { ...activeMatches[state.gameKey], saved: false, matchId: null };
  }
  state.activeMatches = activeMatches;
  if (latest.gameBefore) {
    updateGame({ ...latest.gameBefore, history: rest, undone: [latest, ...g.undone].slice(0, 20) });
  } else {
    updateGame({ scores: latest.scoresBefore, mode: latest.modeBefore, history: rest, undone: [latest, ...g.undone].slice(0, 20) });
  }
}

function redoHand() {
  const g = gameState();
  const [latest, ...rest] = g.undone;
  if (!latest) return;
  if (latest.gameAfter) {
    updateGame({ ...latest.gameAfter, history: [latest, ...g.history], undone: rest });
  } else {
    updateGame({ scores: latest.scoresAfter, history: [latest, ...g.history], undone: rest });
  }
}

function clearCurrentGame() {
  if (!confirm(`Clear the current ${activeGame().label} score and hand history? Saved completed matches will stay in Match History.`)) return;
  const previous = gameState();
  const fresh = activeGame().createState();
  fresh.teams = previous.teams.slice();
  fresh.scores = previous.teams.map(() => 0);
  const activeMatches = { ...state.activeMatches };
  delete activeMatches[state.gameKey];
  state = { ...state, activeMatches };
  updateGame(fresh);
}

function resetAll() {
  if (!confirm("Clear every player, match, score, and setting from this device? This cannot be undone unless you exported a backup.")) return;
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(LEGACY_STORAGE_KEY);
  state = clone(initialState);
  saveState();
  render();
}

function submitHand() {
  const patch = activeGame().submit(gameState());
  updateGame(patch, false);
  ensureCurrentMatchSaved();
  render();
}

function addPlayerFromInput() {
  const input = document.getElementById("new-player-name");
  const name = normalizedName(input?.value);
  if (!name) return;
  if (state.players.some((player) => player.name.toLocaleLowerCase() === name.toLocaleLowerCase())) {
    setState({ notice: `${name} is already in your players.` });
    return;
  }
  setState({
    players: [...state.players, { id: nowId("player"), name, createdAt: new Date().toISOString() }],
    notice: `${name} added.`
  });
}

function exportData() {
  const backup = {
    app: "Multi-Game Scorer",
    version: 6,
    exportedAt: new Date().toISOString(),
    state: {
      ...state,
      setup: null,
      notice: ""
    }
  };
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `multi-game-scorer-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  setState({ notice: "Backup exported." });
}

async function importData(file) {
  if (!file) return;
  try {
    const parsed = JSON.parse(await file.text());
    const incoming = parsed?.state;
    if (!incoming || !incoming.games || !Array.isArray(incoming.players) || !Array.isArray(incoming.matches)) throw new Error("Invalid backup");
    if (!confirm("Restore this backup and replace the app data currently on this device?")) return;
    state = {
      ...clone(initialState),
      ...incoming,
      version: 6,
      games: { ...clone(initialState).games, ...incoming.games },
      setup: null,
      screen: "home",
      notice: "Backup restored."
    };
    saveState();
    render();
  } catch {
    setState({ notice: "That file is not a valid Multi-Game Scorer backup." });
  }
}

function render() {
  document.documentElement.dataset.theme = state.darkMode ? "dark" : "light";
  if (state.screen === "home") app.innerHTML = homeScreen();
  else if (state.screen === "setup") app.innerHTML = setupScreen();
  else if (state.screen === "players") app.innerHTML = playersScreen();
  else if (state.screen === "matches") app.innerHTML = matchesScreen();
  else if (state.screen === "data") app.innerHTML = dataScreen();
  else app.innerHTML = gameScreen();
}

app.addEventListener("input", (event) => {
  const el = event.target;
  const action = el.dataset.action;
  if (action === "setup-name") {
    const setup = clone(state.setup);
    setup.names[Number(el.dataset.side)][Number(el.dataset.member)] = el.value;
    setup.error = "";
    state.setup = setup;
    saveState();
    return;
  }

  if (["home", "setup", "players", "matches", "data"].includes(state.screen)) return;
  const g = gameState();
  if (action === "team-name") {
    if (el.readOnly) return;
    const teams = g.teams.slice();
    teams[Number(el.dataset.team)] = el.value;
    updateGame({ teams }, false);
    return;
  }
  const patch = activeGame().handleInput ? activeGame().handleInput(g, el) : null;
  if (patch) updateGame(patch, false);
});

app.addEventListener("change", (event) => {
  const el = event.target;
  const action = el.dataset.action;
  if (action === "import-file") {
    importData(el.files?.[0]);
    return;
  }
  if (["home", "setup", "players", "matches", "data"].includes(state.screen)) return;
  const g = gameState();
  if (action === "team-name") {
    if (el.readOnly) return;
    const teams = g.teams.slice();
    teams[Number(el.dataset.team)] = el.value || `Player ${Number(el.dataset.team) + 1}`;
    updateGame({ teams });
    return;
  }
  const patch = activeGame().handleChange ? activeGame().handleChange(g, el) : null;
  if (patch) updateGame(patch);
});

app.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button || button.disabled) return;
  const action = button.dataset.action;

  if (action === "theme") return setState({ darkMode: !state.darkMode });
  if (action === "home") return setState({ screen: "home", setup: null, notice: "" });
  if (action === "players") return setState({ screen: "players", setup: null, notice: "" });
  if (action === "matches") return setState({ screen: "matches", setup: null, notice: "" });
  if (action === "data") return setState({ screen: "data", setup: null, notice: "" });
  if (action === "choose-game") return openSetup(button.dataset.game);
  if (action === "resume-game") return setState({ gameKey: button.dataset.game, screen: "score", setup: null, notice: "" });
  if (action === "start-match") return startMatch();
  if (action === "new-match") return openSetup(state.gameKey);
  if (action === "add-player") return addPlayerFromInput();
  if (action === "export-data") return exportData();
  if (action === "choose-import") return document.getElementById("import-file")?.click();
  if (action === "reset-all") return resetAll();
  if (action === "clear-current-game") return clearCurrentGame();

  if (["home", "setup", "players", "matches", "data"].includes(state.screen)) return;
  if (action === "screen") return setState({ screen: button.dataset.screen });
  if (action === "submit") return submitHand();
  if (action === "undo") return undoHand();
  if (action === "redo") return redoHand();

  const patch = activeGame().handleClick ? activeGame().handleClick(gameState(), button) : null;
  if (patch) updateGame(patch);
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}

saveState();
render();
