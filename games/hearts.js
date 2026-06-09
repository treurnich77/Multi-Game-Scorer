import { clone, escapeHtml, signed } from "./shared.js";

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}

function scoreHand(mode) {
  const hearts = mode.hearts.map((value) => clamp(value, 0, 13));
  const queenOwner = mode.queenOwner;
  const raw = hearts.map((count, index) => count + (queenOwner === index ? 13 : 0));
  const moonShooter = raw.findIndex((value, index) => value === 26 && hearts[index] === 13 && queenOwner === index);
  if (moonShooter >= 0) {
    return {
      hearts,
      queenOwner,
      moonShooter,
      deltas: raw.map((_, index) => (index === moonShooter ? 0 : 26))
    };
  }
  return { hearts, queenOwner, moonShooter: -1, deltas: raw };
}

function totalHearts(mode) {
  return mode.hearts.reduce((sum, value) => sum + clamp(value, 0, 13), 0);
}

function isComplete(mode) {
  return totalHearts(mode) === 13 && mode.queenOwner != null;
}

function heartsActions(g, complete) {
  return `
    <div class="actions">
      <button class="primary" data-action="submit" ${complete ? "" : "disabled"}>Submit Hand</button>
      <button class="secondary" data-action="undo" ${g.history.length ? "" : "disabled"} title="Undo last hand">Undo</button>
      <button class="secondary" data-action="redo" ${g.undone.length ? "" : "disabled"} title="Redo hand">Redo</button>
    </div>
  `;
}

export const hearts = {
  key: "hearts",
  label: "Hearts",
  fullName: "Hearts",
  target: 100,

  createState() {
    return {
      teams: ["You", "Player 2", "Player 3", "Player 4"],
      scores: [0, 0, 0, 0],
      history: [],
      undone: [],
      target: 100,
      mode: {
        hearts: [0, 0, 0, 0],
        queenOwner: null,
        touched: false
      }
    };
  },

  scoreCardMeta() {
    return [];
  },

  winner(g) {
    const out = g.scores.some((score) => score >= g.target);
    if (!out) return "";
    const lowScore = Math.min(...g.scores);
    const leaders = g.teams.filter((_, index) => g.scores[index] === lowScore);
    return leaders.length === 1 ? `${leaders[0]} wins` : "Tie for low score";
  },

  renderEntry(g) {
    const m = g.mode;
    const preview = scoreHand(m);
    const heartsTotal = totalHearts(m);
    const complete = isComplete(m);
    const remainingHearts = Math.max(0, 13 - heartsTotal);
    const missingQueen = m.queenOwner == null;
    const warning = heartsTotal > 13 ? `<div class="score-warning">Only 13 hearts exist in the deck.</div>` : "";
    const incomplete = !complete
      ? `<div class="score-warning">${remainingHearts ? `${remainingHearts} heart${remainingHearts === 1 ? "" : "s"} still unassigned.` : ""}${remainingHearts && missingQueen ? " " : ""}${missingQueen ? "Assign the queen of spades." : ""}</div>`
      : "";
    const moon = preview.moonShooter >= 0 ? `<div class="moon-banner">${escapeHtml(g.teams[preview.moonShooter])} shoots the moon. Everyone else takes 26.</div>` : "";
    return `
      <section class="panel">
        <h2>Hearts Hand Entry</h2>
        <div class="hearts-summary">
          <span>${heartsTotal}/13 hearts</span>
          <span>Queen of Spades: ${m.queenOwner == null ? "none" : escapeHtml(g.teams[m.queenOwner])}</span>
          <span>Total: ${heartsTotal + (m.queenOwner == null ? 0 : 13)}/26 points</span>
        </div>
        ${warning}
        ${incomplete}
        ${moon}
        <div class="hearts-grid">
          ${g.teams.map((team, index) => `
            <section class="hearts-player">
              <h3>${escapeHtml(team)}</h3>
              <div class="heart-counter" aria-label="${escapeHtml(team)} hearts taken">
                <button data-action="hearts-dec" data-team="${index}" aria-label="Remove heart from ${escapeHtml(team)}">−</button>
                <output><strong>${m.hearts[index]}</strong><span>♥</span></output>
                <button data-action="hearts-inc" data-team="${index}" aria-label="Add heart to ${escapeHtml(team)}">+</button>
              </div>
              <button class="queen-card ${m.queenOwner === index ? "active" : ""}" data-action="hearts-queen" data-team="${index}" aria-pressed="${m.queenOwner === index}">
                <span>Q</span><span>♠</span>
              </button>
              <div class="mini-pill ${m.touched ? "" : "hidden"}">${signed(preview.deltas[index] || 0)}</div>
            </section>
          `).join("")}
        </div>
        ${heartsActions(g, complete)}
      </section>
    `;
  },

  renderTable() {
    return `
      <section class="panel rules">
        <h2>Hearts Scoring</h2>
        <p>Tap hearts onto each player instead of counting manually. Each heart is 1 point. Tap the queen of spades card for whoever was caught with it; it adds 13 points.</p>
        <p>If one player takes all 13 hearts and the queen of spades, they shoot the moon. That player scores 0 and every other player scores 26.</p>
      </section>
    `;
  },

  renderRules() {
    return `
      <section class="panel rules">
        <h2>Hearts Rules</h2>
        <h3>Players and Deal</h3>
        <p>Four players use a standard 52-card deck. Each player receives 13 cards. The goal is to avoid point cards.</p>
        <h3>Point Cards</h3>
        <p>Each heart is worth 1 point. The queen of spades is worth 13 points. There are 26 possible points in each hand.</p>
        <h3>Play</h3>
        <p>Players follow suit if able. The highest card in the led suit wins the trick. Hearts generally cannot be led until hearts have been broken.</p>
        <h3>Shooting the Moon</h3>
        <p>If one player captures every heart and the queen of spades, that player scores 0 and every other player receives 26 points.</p>
        <h3>Winning</h3>
        <p>Points taken are added to each player's total. Lowest score wins when any player reaches 100.</p>
      </section>
    `;
  },

  handleClick(g, button) {
    const action = button.dataset.action;
    const index = Number(button.dataset.team);
    const mode = clone(g.mode);
    if (action === "hearts-inc") {
      mode.hearts[index] = clamp(mode.hearts[index] + 1, 0, 13);
      mode.touched = true;
      return { mode };
    }
    if (action === "hearts-dec") {
      mode.hearts[index] = clamp(mode.hearts[index] - 1, 0, 13);
      mode.touched = true;
      return { mode };
    }
    if (action === "hearts-queen") {
      mode.queenOwner = mode.queenOwner === index ? null : index;
      mode.touched = true;
      return { mode };
    }
    return null;
  },

  submit(g) {
    if (!isComplete(g.mode)) return {};
    const result = scoreHand(g.mode);
    const scores = g.scores.map((score, index) => score + result.deltas[index]);
    const hand = {
      summary: result.moonShooter >= 0 ? `${g.teams[result.moonShooter]} shot the moon` : "Hearts hand",
      detail: result.deltas.map((delta, index) => `${g.teams[index]} ${signed(delta)}`).join(", "),
      deltas: result.deltas,
      scoresBefore: g.scores,
      scoresAfter: scores,
      modeBefore: clone(g.mode)
    };
    return {
      scores,
      mode: { hearts: [0, 0, 0, 0], queenOwner: null, touched: false },
      history: [hand, ...g.history].slice(0, 100),
      undone: []
    };
  }
};
