(function () {
  "use strict";

  const STORAGE_KEY = "multiGameScorer:v2";
  const OLD_KEYS = ["fiveHundredScorer:v1"];

  const SUITS = [
    { key: "S", label: "♠", name: "Spades", red: false },
    { key: "C", label: "♣", name: "Clubs", red: false },
    { key: "D", label: "♦", name: "Diamonds", red: true },
    { key: "H", label: "♥", name: "Hearts", red: true },
    { key: "NT", label: "NT", name: "No Trump", red: false }
  ];

  const SCORE_500 = {
    S: { 6: 40, 7: 140, 8: 240, 9: 340, 10: 440 },
    C: { 6: 60, 7: 160, 8: 260, 9: 360, 10: 460 },
    D: { 6: 80, 7: 180, 8: 280, 9: 380, 10: 480 },
    H: { 6: 100, 7: 200, 8: 300, 9: 400, 10: 500 },
    NT: { 6: 120, 7: 220, 8: 320, 9: 420, 10: 520 }
  };

  const GAME_INFO = {
    fiveHundred: { label: "500", fullName: "Five Hundred", target: 500, teams: ["Us", "Them"] },
    spades: { label: "Spades", fullName: "Spades", target: 500, teams: ["Team 1", "Team 2"] },
    hearts: { label: "Hearts", fullName: "Hearts", target: 100, teams: ["You", "Player 2", "Player 3", "Player 4"] }
  };

  const makeGameState = (gameKey) => ({
    teams: GAME_INFO[gameKey].teams.slice(),
    scores: GAME_INFO[gameKey].teams.map(() => 0),
    history: [],
    undone: [],
    target: GAME_INFO[gameKey].target,
    dealer: 0,
    fiveHundred: {
      contractTeam: 0,
      contractType: "normal",
      suit: "S",
      bid: 6,
      tricks: 6,
      touched: false
    },
    spades: {
      bids: [0, 0],
      tricksTeam1: 0,
      bags: [0, 0],
      touched: false
    },
    hearts: {
      points: [0, 0, 0, 0],
      touched: false
    }
  });

  const initialState = {
    gameKey: "fiveHundred",
    screen: "score",
    darkMode: false,
    games: {
      fiveHundred: makeGameState("fiveHundred"),
      spades: makeGameState("spades"),
      hearts: makeGameState("hearts")
    }
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
        const cleanUrl = `${window.location.pathname}${cleanQuery ? `?${cleanQuery}` : ""}`;
        window.history.replaceState(null, "", cleanUrl);
      }
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (!saved) return structuredClone(initialState);
      return {
        ...structuredClone(initialState),
        ...saved,
        games: {
          ...structuredClone(initialState).games,
          ...(saved.games || {})
        }
      };
    } catch {
      return structuredClone(initialState);
    }
  }

  function game() {
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

  function updateGame(patch) {
    state = {
      ...state,
      games: {
        ...state.games,
        [state.gameKey]: {
          ...game(),
          ...patch
        }
      }
    };
    saveState();
    render();
  }

  function updateMode(mode, patch) {
    updateGame({ [mode]: { ...game()[mode], ...patch } });
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function signed(value) {
    return `${value >= 0 ? "+" : ""}${value}`;
  }

  function score500(contractType, suit, bid, tricks) {
    if (contractType === "misere") return tricks === 0 ? 250 : -250;
    if (contractType === "openMisere") return tricks === 0 ? 500 : -500;
    const value = SCORE_500[suit][bid];
    return tricks >= bid ? value : -value;
  }

  function scoreSpades(bids, tricksTeam1, bags) {
    const tricks = [Math.max(0, Math.min(13, Number(tricksTeam1) || 0)), 0];
    tricks[1] = 13 - tricks[0];
    const scores = [0, 0];
    const nextBags = bags.slice();
    for (let i = 0; i < 2; i += 1) {
      const bid = Math.max(0, Math.min(13, Number(bids[i]) || 0));
      if (tricks[i] >= bid) {
        const over = Math.max(0, tricks[i] - bid);
        scores[i] = bid * 10 + over;
        nextBags[i] += over;
        if (nextBags[i] >= 10) {
          scores[i] -= 100;
          nextBags[i] -= 10;
        }
      } else {
        scores[i] = -(bid * 10);
      }
    }
    return { scores, nextBags, tricks };
  }

  function scoreHearts(points) {
    const values = points.map((value) => Math.max(0, Math.min(26, Number(value) || 0)));
    const shooter = values.findIndex((value) => value === 26);
    if (shooter >= 0) {
      return values.map((_, index) => (index === shooter ? 0 : 26));
    }
    return values;
  }

  function winnerText() {
    const g = game();
    if (state.gameKey === "hearts") {
      const out = g.scores.some((score) => score >= g.target);
      if (!out) return "";
      const lowScore = Math.min(...g.scores);
      const leaders = g.teams.filter((_, index) => g.scores[index] === lowScore);
      return leaders.length === 1 ? `${leaders[0]} wins` : "Tie for low score";
    }
    const top = Math.max(...g.scores);
    if (top < g.target) return "";
    const leaders = g.teams.filter((_, index) => g.scores[index] === top);
    return leaders.length === 1 ? `${leaders[0]} wins` : "Tie game";
  }

  function submit500() {
    const g = game();
    const m = g.fiveHundred;
    const contractPoints = score500(m.contractType, m.suit, Number(m.bid), Number(m.tricks));
    const defendingTeam = m.contractTeam === 0 ? 1 : 0;
    const defenderPoints = Math.max(0, 10 - Number(m.tricks)) * 10;
    const scores = g.scores.slice();
    scores[m.contractTeam] += contractPoints;
    scores[defendingTeam] += defenderPoints;
    const hand = {
      gameKey: state.gameKey,
      summary: `${describe500(m)} by ${g.teams[m.contractTeam]}`,
      detail: `${m.tricks} tricks won`,
      deltas: [m.contractTeam === 0 ? contractPoints : defenderPoints, m.contractTeam === 1 ? contractPoints : defenderPoints],
      scoresBefore: g.scores,
      scoresAfter: scores,
      modeBefore: structuredClone(m),
      playedAt: new Date().toISOString()
    };
    updateGame({
      scores,
      dealer: (g.dealer + 1) % 4,
      fiveHundred: { ...m, tricks: m.contractType === "normal" ? Number(m.bid) : 0, touched: false },
      history: [hand, ...g.history].slice(0, 100),
      undone: []
    });
  }

  function submitSpades() {
    const g = game();
    const m = g.spades;
    const result = scoreSpades(m.bids, m.tricksTeam1, m.bags);
    const scores = g.scores.map((score, index) => score + result.scores[index]);
    const hand = {
      gameKey: state.gameKey,
      summary: `Bids ${m.bids[0]} and ${m.bids[1]}`,
      detail: `${g.teams[0]} took ${result.tricks[0]}, ${g.teams[1]} took ${result.tricks[1]}`,
      deltas: result.scores,
      scoresBefore: g.scores,
      scoresAfter: scores,
      modeBefore: structuredClone(m),
      playedAt: new Date().toISOString()
    };
    updateGame({
      scores,
      spades: { bids: [0, 0], tricksTeam1: 0, bags: result.nextBags, touched: false },
      history: [hand, ...g.history].slice(0, 100),
      undone: []
    });
  }

  function submitHearts() {
    const g = game();
    const m = g.hearts;
    const deltas = scoreHearts(m.points);
    const scores = g.scores.map((score, index) => score + deltas[index]);
    const hand = {
      gameKey: state.gameKey,
      summary: "Hearts hand",
      detail: deltas.map((delta, index) => `${g.teams[index]} ${signed(delta)}`).join(", "),
      deltas,
      scoresBefore: g.scores,
      scoresAfter: scores,
      modeBefore: structuredClone(m),
      playedAt: new Date().toISOString()
    };
    updateGame({
      scores,
      hearts: { points: [0, 0, 0, 0], touched: false },
      history: [hand, ...g.history].slice(0, 100),
      undone: []
    });
  }

  function submitHand() {
    if (state.gameKey === "fiveHundred") submit500();
    if (state.gameKey === "spades") submitSpades();
    if (state.gameKey === "hearts") submitHearts();
  }

  function undoHand() {
    const g = game();
    const [latest, ...rest] = g.history;
    if (!latest) return;
    const patch = {
      scores: latest.scoresBefore,
      history: rest,
      undone: [latest, ...g.undone].slice(0, 20)
    };
    if (state.gameKey === "fiveHundred") patch.fiveHundred = latest.modeBefore;
    if (state.gameKey === "spades") patch.spades = latest.modeBefore;
    if (state.gameKey === "hearts") patch.hearts = latest.modeBefore;
    updateGame(patch);
  }

  function redoHand() {
    const g = game();
    const [latest, ...rest] = g.undone;
    if (!latest) return;
    updateGame({
      scores: latest.scoresAfter,
      history: [latest, ...g.history],
      undone: rest
    });
  }

  function newGame(keepHistory = true) {
    const fresh = makeGameState(state.gameKey);
    fresh.teams = game().teams.slice();
    if (keepHistory) fresh.history = game().history;
    state = {
      ...state,
      games: {
        ...state.games,
        [state.gameKey]: fresh
      }
    };
    saveState();
    render();
  }

  function resetAll() {
    if (!confirm("Clear every game, name, score, and hand history?")) return;
    state = structuredClone(initialState);
    saveState();
    render();
  }

  function describe500(m) {
    if (m.contractType === "misere") return "Misere";
    if (m.contractType === "openMisere") return "Open Misere";
    const suit = SUITS.find((item) => item.key === m.suit);
    return `${m.bid} ${suit ? suit.label : m.suit}`;
  }

  function gamePicker() {
    return `
      <section class="game-picker" aria-label="Choose game">
        <label for="game-select">Game</label>
        <select id="game-select" data-action="game-select">
          ${Object.entries(GAME_INFO).map(([key, info]) => `
            <option value="${key}" ${state.gameKey === key ? "selected" : ""}>${info.label}</option>
          `).join("")}
        </select>
      </section>
    `;
  }

  function scoreCards() {
    const g = game();
    return `
      <section class="scoreboard ${g.teams.length > 2 ? "four" : ""}" aria-label="Current scores">
        ${g.teams.map((team, index) => `
          <section class="score-card">
            <input class="team-name" data-action="team-name" data-team="${index}" value="${escapeHtml(team)}" aria-label="Player or team ${index + 1} name" />
            ${state.gameKey === "spades" ? `<span class="dealer-pill">Bags: ${g.spades.bags[index] || 0}</span>` : ""}
            <div class="score-row">
              <div class="score">${g.scores[index]}</div>
            </div>
          </section>
        `).join("")}
      </section>
    `;
  }

  function fiveHundredPanel() {
    const g = game();
    const m = g.fiveHundred;
    const defendingTeam = m.contractTeam === 0 ? 1 : 0;
    const contractPreview = score500(m.contractType, m.suit, Number(m.bid), Number(m.tricks));
    const defenderPreview = Math.max(0, 10 - Number(m.tricks)) * 10;
    const bidOptions = [6, 7, 8, 9, 10].map((value) => `<option value="${value}" ${Number(m.bid) === value ? "selected" : ""}>${value}</option>`).join("");
    const trickOptions = Array.from({ length: 11 }, (_, value) => `<option value="${value}" ${Number(m.tricks) === value ? "selected" : ""}>${value}</option>`).join("");
    return `
      <section class="panel">
        <h2>500 Hand Entry</h2>
        <div class="grid">
          <fieldset class="field">
            <legend>Contract</legend>
            <div class="segmented">
              <button class="chip ${m.contractType === "normal" ? "active" : ""}" data-action="500-type" data-type="normal">Bid</button>
              <button class="chip ${m.contractType === "misere" ? "active" : ""}" data-action="500-type" data-type="misere">Misere</button>
              <button class="chip ${m.contractType === "openMisere" ? "active" : ""}" data-action="500-type" data-type="openMisere">Open Misere</button>
            </div>
          </fieldset>
          <fieldset class="field">
            <legend>Contract Team</legend>
            <div class="segmented">
              <button class="chip ${m.contractTeam === 0 ? "active" : ""}" data-action="500-team" data-team="0">${escapeHtml(g.teams[0])}</button>
              <button class="chip ${m.contractTeam === 1 ? "active" : ""}" data-action="500-team" data-team="1">${escapeHtml(g.teams[1])}</button>
            </div>
          </fieldset>
          <div class="grid two ${m.contractType === "normal" ? "" : "hidden"}">
            <div class="field">
              <label for="bid">Bid</label>
              <select id="bid" data-action="500-bid">${bidOptions}</select>
            </div>
            <fieldset class="field">
              <legend>Suit</legend>
              <div class="suits">
                ${SUITS.map((suit) => `
                  <button class="suit ${suit.red ? "red" : ""} ${suit.key === "NT" ? "nt" : ""} ${m.suit === suit.key ? "active" : ""}"
                    data-action="500-suit" data-suit="${suit.key}" aria-label="${suit.name}">${suit.label}</button>
                `).join("")}
              </div>
            </fieldset>
          </div>
          <div class="field">
            <label for="tricks">Tricks Won by Contract Team</label>
            <select id="tricks" data-action="500-tricks">${trickOptions}</select>
          </div>
          <div class="grid two ${m.touched ? "" : "hidden"}">
            <div class="mini-pill">${escapeHtml(g.teams[m.contractTeam])}: ${signed(contractPreview)}</div>
            <div class="mini-pill">${escapeHtml(g.teams[defendingTeam])}: +${defenderPreview}</div>
          </div>
        </div>
        ${actionButtons()}
      </section>
    `;
  }

  function spadesPanel() {
    const g = game();
    const m = g.spades;
    const preview = scoreSpades(m.bids, m.tricksTeam1, m.bags);
    const trickOptions = Array.from({ length: 14 }, (_, value) => `<option value="${value}" ${Number(m.tricksTeam1) === value ? "selected" : ""}>${value}</option>`).join("");
    return `
      <section class="panel">
        <h2>Spades Hand Entry</h2>
        <div class="grid two">
          ${[0, 1].map((index) => `
            <div class="field">
              <label for="spades-bid-${index}">${escapeHtml(g.teams[index])} bid</label>
              <input id="spades-bid-${index}" type="number" min="0" max="13" inputmode="numeric" data-action="spades-bid" data-team="${index}" value="${m.bids[index]}" />
            </div>
          `).join("")}
        </div>
        <div class="field">
          <label for="spades-tricks">${escapeHtml(g.teams[0])} tricks won</label>
          <select id="spades-tricks" data-action="spades-tricks">${trickOptions}</select>
        </div>
        <div class="grid two ${m.touched ? "" : "hidden"}">
          <div class="mini-pill">${escapeHtml(g.teams[0])}: ${signed(preview.scores[0])}</div>
          <div class="mini-pill">${escapeHtml(g.teams[1])}: ${signed(preview.scores[1])}</div>
        </div>
        ${actionButtons()}
      </section>
    `;
  }

  function heartsPanel() {
    const g = game();
    const m = g.hearts;
    const preview = scoreHearts(m.points);
    return `
      <section class="panel">
        <h2>Hearts Hand Entry</h2>
        <div class="grid two">
          ${g.teams.map((team, index) => `
            <div class="field">
              <label for="hearts-${index}">${escapeHtml(team)} points</label>
              <input id="hearts-${index}" type="number" min="0" max="26" inputmode="numeric" data-action="hearts-points" data-team="${index}" value="${m.points[index] || 0}" />
              <span class="mini-pill ${m.touched ? "" : "hidden"}">${signed(preview[index] || 0)}</span>
            </div>
          `).join("")}
        </div>
        ${actionButtons()}
      </section>
    `;
  }

  function actionButtons() {
    const g = game();
    return `
      <div class="actions">
        <button class="primary" data-action="submit">Submit Hand</button>
        <button class="secondary" data-action="undo" ${g.history.length ? "" : "disabled"} title="Undo last hand">Undo</button>
        <button class="secondary" data-action="redo" ${g.undone.length ? "" : "disabled"} title="Redo hand">Redo</button>
      </div>
    `;
  }

  function scorePanel() {
    if (state.gameKey === "spades") return spadesPanel();
    if (state.gameKey === "hearts") return heartsPanel();
    return fiveHundredPanel();
  }

  function tablePanel() {
    if (state.gameKey === "spades") {
      return `
        <section class="panel rules">
          <h2>Spades Scoring</h2>
          <p>Each team bids 0 to 13. If a team makes its bid, it scores 10 points per bid trick plus 1 point per overtrick. If it fails, it loses 10 points per bid trick.</p>
          <p>Overtricks are bags. Every 10 bags costs 100 points, then the bag count drops by 10. Nil and blind nil are not included yet.</p>
        </section>
      `;
    }
    if (state.gameKey === "hearts") {
      return `
        <section class="panel rules">
          <h2>Hearts Scoring</h2>
          <p>Each heart is 1 point. The queen of spades is 13 points. A hand has 26 total points. Lowest score wins when any player reaches 100.</p>
          <p>If one player takes all 26 points, they shoot the moon: that player scores 0 and every other player scores 26.</p>
        </section>
      `;
    }
    const rows = [6, 7, 8, 9, 10].map((bid) => `
      <tr>
        <td>${bid}</td>
        <td>${SCORE_500.S[bid]}</td>
        <td>${SCORE_500.C[bid]}</td>
        <td class="red-text">${SCORE_500.D[bid]}</td>
        <td class="red-text">${SCORE_500.H[bid]}</td>
        <td>${SCORE_500.NT[bid]}</td>
      </tr>
    `).join("");
    return `
      <section class="panel">
        <h2>500 Scoring Table</h2>
        <table class="score-table" aria-label="Five Hundred scoring table">
          <thead>
            <tr><th>Bid</th><th>♠</th><th>♣</th><th class="red-text">♦</th><th class="red-text">♥</th><th>NT</th></tr>
          </thead>
          <tbody>
            ${rows}
            <tr><td>Misere</td><td colspan="5">+250 if no tricks, otherwise -250</td></tr>
            <tr><td>Open Misere</td><td colspan="5">+500 if no tricks, otherwise -500</td></tr>
          </tbody>
        </table>
      </section>
    `;
  }

  function historyPanel() {
    const g = game();
    const items = g.history.length
      ? g.history.map((hand) => `
        <div class="history-item">
          <span class="mini-pill">${escapeHtml(GAME_INFO[state.gameKey].label)}</span>
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

  function rulesPanel() {
    if (state.gameKey === "spades") {
      return `
        <section class="panel rules">
          <h2>Spades Rules</h2>
          <h3>Players and Deal</h3>
          <p>Four players play as two partnerships. A standard 52-card deck is dealt evenly, so each player receives 13 cards. Spades are always trump.</p>
          <h3>Bidding</h3>
          <p>Each side declares how many tricks it expects to take. This scorer records one total partnership bid per team.</p>
          <h3>Play</h3>
          <p>Players must follow suit if able. If they cannot follow suit, they may play any card. A spade beats non-spades. Highest card in the led suit wins unless a spade is played.</p>
          <h3>Scoring</h3>
          <p>Making the bid scores 10 times the bid plus one point per overtrick. Missing the bid loses 10 times the bid. Overtricks become bags; every 10 bags is a 100-point penalty.</p>
        </section>
      `;
    }
    if (state.gameKey === "hearts") {
      return `
        <section class="panel rules">
          <h2>Hearts Rules</h2>
          <h3>Players and Deal</h3>
          <p>Four players use a standard 52-card deck. Each player receives 13 cards. The goal is to avoid point cards.</p>
          <h3>Point Cards</h3>
          <p>Each heart is worth 1 point. The queen of spades is worth 13 points. There are 26 points in each hand.</p>
          <h3>Play</h3>
          <p>Players follow suit if able. The highest card in the led suit wins the trick. Hearts generally cannot be led until hearts have been broken.</p>
          <h3>Scoring</h3>
          <p>Points taken are added to each player's total. Lowest score wins when any player reaches 100. If one player takes all 26 points, they shoot the moon and the other players each receive 26.</p>
        </section>
      `;
    }
    return `
      <section class="panel rules">
        <h2>500 Rules</h2>
        <h3>Players and Deck</h3>
        <p>Four players play as two partnerships. A common AU/NZ setup uses a 43-card deck: remove the 2s, 3s, and black 4s from a standard deck, then add the Joker. Ten cards are dealt to each player and three cards form the kitty.</p>
        <h3>Card Rank</h3>
        <p>In a trump suit, the Joker is highest, followed by the right bower, the left bower, ace, king, queen, 10, 9, 8, 7, 6, 5, and 4 where present. In No Trump, the Joker is highest, then ace down in the led suit.</p>
        <h3>Bidding</h3>
        <p>Players bid for 6 to 10 tricks in a suit or No Trump. At the same trick level, the order is spades, clubs, diamonds, hearts, then No Trump. Misere and Open Misere are contracts to take no tricks.</p>
        <h3>Play</h3>
        <p>The high bidder takes the kitty, discards back to ten cards, and leads. Players follow suit if able. Trump cards beat non-trumps, and the highest legal card wins the trick.</p>
        <h3>Scoring</h3>
        <p>If the bidding team makes the contract, it scores the table value. If it fails, it loses that value. The defending team scores 10 points per trick taken. First team to 500 wins.</p>
      </section>
    `;
  }

  function activePanel() {
    if (state.screen === "table") return tablePanel();
    if (state.screen === "history") return historyPanel();
    if (state.screen === "rules") return rulesPanel();
    return scorePanel();
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

  function render() {
    const win = winnerText();
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
            <p>${escapeHtml(GAME_INFO[state.gameKey].fullName)} scoring, saved offline, ready for Android.</p>
          </div>
          <div class="card-stack" aria-hidden="true">
            <div class="playing-card card-back">
              <span class="card-pattern">◆</span>
            </div>
            <div class="playing-card card-mid red-card">
              <span class="corner top">Q<br>♥</span>
              <span class="pip">♥</span>
              <span class="corner bottom">Q<br>♥</span>
            </div>
            <div class="playing-card card-front">
              <span class="corner top">A<br>♠</span>
              <span class="pip">♠</span>
              <span class="corner bottom">A<br>♠</span>
            </div>
          </div>
        </header>
        ${gamePicker()}
        ${scoreCards()}
        ${win ? `
          <section class="winner">
            <div><strong>${escapeHtml(win)}</strong><span>Target score: ${game().target}</span></div>
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
    const g = game();
    if (action === "game-select") setState({ gameKey: el.value, screen: "score" });
    if (action === "team-name") {
      const teams = g.teams.slice();
      teams[Number(el.dataset.team)] = el.value;
      state.games[state.gameKey] = { ...g, teams };
      saveState();
    }
    if (action === "spades-bid") {
      const bids = g.spades.bids.slice();
      bids[Number(el.dataset.team)] = Number(el.value);
      state.games[state.gameKey] = { ...g, spades: { ...g.spades, bids, touched: true } };
      saveState();
    }
    if (action === "hearts-points") {
      const points = g.hearts.points.slice();
      points[Number(el.dataset.team)] = Number(el.value);
      state.games[state.gameKey] = { ...g, hearts: { ...g.hearts, points, touched: true } };
      saveState();
    }
  });

  app.addEventListener("change", (event) => {
    const el = event.target;
    const action = el.dataset.action;
    const g = game();
    if (action === "team-name") {
      const teams = g.teams.slice();
      teams[Number(el.dataset.team)] = el.value || `Player ${Number(el.dataset.team) + 1}`;
      updateGame({ teams });
    }
    if (action === "500-bid") updateMode("fiveHundred", { ...g.fiveHundred, bid: Number(el.value), tricks: Math.max(Number(el.value), Number(g.fiveHundred.tricks)), touched: true });
    if (action === "500-tricks") updateMode("fiveHundred", { ...g.fiveHundred, tricks: Number(el.value), touched: true });
    if (action === "spades-tricks") updateMode("spades", { ...g.spades, tricksTeam1: Number(el.value), touched: true });
    if (action === "spades-bid") render();
    if (action === "hearts-points") render();
  });

  app.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button || button.disabled) return;
    const action = button.dataset.action;
    const g = game();
    if (action === "theme") setState({ darkMode: !state.darkMode });
    if (action === "screen") setState({ screen: button.dataset.screen });
    if (action === "500-type") {
      const type = button.dataset.type;
      updateMode("fiveHundred", { ...g.fiveHundred, contractType: type, tricks: type === "normal" ? Math.max(Number(g.fiveHundred.bid), Number(g.fiveHundred.tricks)) : 0, touched: true });
    }
    if (action === "500-team") updateMode("fiveHundred", { ...g.fiveHundred, contractTeam: Number(button.dataset.team), touched: true });
    if (action === "500-suit") updateMode("fiveHundred", { ...g.fiveHundred, suit: button.dataset.suit, touched: true });
    if (action === "submit") submitHand();
    if (action === "undo") undoHand();
    if (action === "redo") redoHand();
    if (action === "new-game") newGame(true);
    if (action === "reset") resetAll();
  });

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch(() => {});
    });
  }

  render();
})();
