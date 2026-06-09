import { gameOrder, games } from "./games/index.js?v=21";
import { clone, escapeHtml, signed } from "./games/shared.js?v=12";

const STORAGE_KEY = "multiGameScorer:v5";
const OLD_KEYS = ["fiveHundredScorer:v1", "multiGameScorer:v2"];

const initialState = {
  gameKey: "fiveHundred",
  screen: "score",
  darkMode: false,
  games: Object.fromEntries(gameOrder.map((key) => [key, games[key].createState()]))
};

let state = loadState();
const app = document.getElementById("app");

function loadState() {
  try {
    OLD_KEYS.forEach((key) => localStorage.removeItem(key));
    const params = new URLSearchParams(window.location.search);
    if (params.has("reset")) {
      localStorage.removeItem(STORAGE_KEY);
      params.delete("reset");
      const cleanQuery = params.toString();
      window.history.replaceState(null, "", `${window.location.pathname}${cleanQuery ? `?${cleanQuery}` : ""}`);
    }
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved) return clone(initialState);
    return {
      ...clone(initialState),
      ...saved,
      games: {
        ...clone(initialState).games,
        ...(saved.games || {})
      }
    };
  } catch {
    return clone(initialState);
  }
}

function activeGame() {
  return games[state.gameKey];
}

function gameState() {
  return state.games[state.gameKey];
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function setState(patch) {
  state = { ...state, ...patch };
  saveState();
  render();
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

function gamePicker() {
  return `
    <section class="game-picker" aria-label="Choose game">
      <label for="game-select">Game</label>
      <select id="game-select" data-action="game-select">
        ${gameOrder.map((key) => `
          <option value="${key}" ${state.gameKey === key ? "selected" : ""}>${games[key].label}</option>
        `).join("")}
      </select>
    </section>
  `;
}

function scoreCards() {
  const g = gameState();
  const gameDef = activeGame();
  return `
    <section class="scoreboard ${g.teams.length > 2 ? "four" : ""}" aria-label="Current scores">
      ${g.teams.map((team, index) => {
        const meta = gameDef.scoreCardMeta ? gameDef.scoreCardMeta(g, index) : [];
        return `
          <section class="score-card">
            <input class="team-name" data-action="team-name" data-team="${index}" value="${escapeHtml(team)}" aria-label="Player or team ${index + 1} name" />
            ${meta.map((item) => `<span class="dealer-pill">${escapeHtml(item)}</span>`).join("")}
            <div class="score-row">
              <div class="score ${g.scores[index] < 0 ? "negative" : ""}">${g.scores[index]}</div>
            </div>
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
        <div>
          <strong>${escapeHtml(hand.summary)}</strong>
          <div>${escapeHtml(hand.detail)}</div>
        </div>
        <strong>${hand.deltas.map(signed).join(" / ")}</strong>
      </div>
    `).join("")
    : `<p>No hands yet.</p>`;
  return `
    <section class="panel">
      <h2>Hand History</h2>
      <div class="history-list">${items}</div>
      <div class="actions">
        <button class="secondary" data-action="new-game">New Game</button>
        <button class="danger" data-action="reset">Clear Everything</button>
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
    <nav class="tabs" aria-label="App sections">
      ${[
        ["score", "Score"],
        ["table", "Table"],
        ["history", "History"],
        ["rules", "Rules"]
      ].map(([key, label]) => `
        <button class="tab ${state.screen === key ? "active" : ""}" data-action="screen" data-screen="${key}">${label}</button>
      `).join("")}
    </nav>
  `;
}

function undoHand() {
  const g = gameState();
  const [latest, ...rest] = g.history;
  if (!latest) return;
  if (latest.gameBefore) {
    updateGame({
      ...latest.gameBefore,
      history: rest,
      undone: [latest, ...g.undone].slice(0, 20)
    });
  } else {
    updateGame({
      scores: latest.scoresBefore,
      mode: latest.modeBefore,
      history: rest,
      undone: [latest, ...g.undone].slice(0, 20)
    });
  }
}

function redoHand() {
  const g = gameState();
  const [latest, ...rest] = g.undone;
  if (!latest) return;
  if (latest.gameAfter) {
    updateGame({
      ...latest.gameAfter,
      history: [latest, ...g.history],
      undone: rest
    });
  } else {
    updateGame({
      scores: latest.scoresAfter,
      history: [latest, ...g.history],
      undone: rest
    });
  }
}

function newGame(keepHistory = true) {
  const previous = gameState();
  const fresh = activeGame().createState();
  fresh.teams = previous.teams.slice();
  fresh.scores = previous.teams.map(() => 0);
  if (Array.isArray(fresh.eliminated)) fresh.eliminated = previous.teams.map(() => false);
  if (Array.isArray(fresh.phases)) fresh.phases = previous.teams.map(() => 1);
  if (fresh.mode?.hands) {
    fresh.mode.hands = previous.teams.map(() => ["", "", "", "", "", ""]);
    fresh.mode.closed = previous.teams.map(() => [false, false, false]);
  }
  if (fresh.mode?.bids) {
    fresh.mode.bids = previous.teams.map(() => 0);
    fresh.mode.tricks = previous.teams.map(() => 0);
  }
  if (fresh.mode?.points && fresh.mode?.completed) {
    fresh.mode.points = previous.teams.map(() => 0);
    fresh.mode.completed = previous.teams.map(() => false);
  }
  if (fresh.mode?.deltas) fresh.mode.deltas = previous.teams.map(() => 0);
  if (keepHistory) fresh.history = previous.history;
  updateGame(fresh);
}

function resetAll() {
  if (!confirm("Clear every game, name, score, and hand history?")) return;
  state = clone(initialState);
  saveState();
  render();
}

function submitHand() {
  const patch = activeGame().submit(gameState());
  updateGame(patch);
}

function render() {
  const g = gameState();
  const gameDef = activeGame();
  const win = gameDef.winner(g);
  document.documentElement.dataset.theme = state.darkMode ? "dark" : "light";
  app.innerHTML = `
    <main class="shell">
      <header class="hero">
        <div class="title-block">
          <div class="title-row">
            <h1>Multi-Game Scorer</h1>
            <button class="theme-toggle ${state.darkMode ? "active" : ""}" data-action="theme" aria-pressed="${state.darkMode}" aria-label="Toggle dark mode">
              <span></span>
            </button>
          </div>
          <p>All your card games in one little app.</p>
        </div>
        <div class="card-stack" aria-hidden="true">
          <div class="playing-card card-back"><span class="card-pattern">◆</span></div>
          <div class="playing-card card-mid red-card"><span class="corner top">Q<br>♥</span><span class="pip">♥</span><span class="corner bottom">Q<br>♥</span></div>
          <div class="playing-card card-front"><span class="corner top">A<br>♠</span><span class="pip">♠</span><span class="corner bottom">A<br>♠</span></div>
        </div>
      </header>
      ${gamePicker()}
      ${scoreCards()}
      ${win ? `
        <section class="winner">
          <div><strong>${escapeHtml(win)}</strong><span>Target score: ${g.target}</span></div>
          <button class="secondary" data-action="new-game">New Game</button>
        </section>
      ` : ""}
      ${activePanel()}
      ${tabs()}
      <p class="install-note">On Android: open this page in Chrome, then use Add to Home screen.</p>
    </main>
  `;
}

app.addEventListener("input", (event) => {
  const el = event.target;
  const action = el.dataset.action;
  const g = gameState();
  if (action === "team-name") {
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
  const g = gameState();
  if (action === "game-select") {
    setState({ gameKey: el.value, screen: "score" });
    return;
  }
  if (action === "team-name") {
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
  if (action === "theme") setState({ darkMode: !state.darkMode });
  if (action === "screen") setState({ screen: button.dataset.screen });
  if (action === "submit") submitHand();
  if (action === "undo") undoHand();
  if (action === "redo") redoHand();
  if (action === "new-game") newGame(true);
  if (action === "reset") resetAll();

  const patch = activeGame().handleClick ? activeGame().handleClick(gameState(), button) : null;
  if (patch) updateGame(patch);
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}

render();
