import { actionButtons, clone, escapeHtml, numberOptions, signed } from "./shared.js";

const QUICK_POINTS = [1, 2, 3, 4, 5, 6, 8, 10, 12, 14, 15, 16, 24, 28, 29];
const TARGET = 121;

function boardHoles(score) {
  return Array.from({ length: TARGET }, (_, index) => {
    const hole = index + 1;
    const filled = score >= hole;
    const active = score === hole;
    const marker = hole % 5 === 0 ? "marker" : "";
    return `<span class="crib-hole ${filled ? "filled" : ""} ${active ? "active" : ""} ${marker}" title="${hole}"></span>`;
  }).join("");
}

export const cribbage = {
  key: "cribbage",
  label: "Cribbage",
  fullName: "Cribbage",
  target: TARGET,

  createState() {
    return {
      teams: ["Player 1", "Player 2"],
      scores: [0, 0],
      history: [],
      undone: [],
      target: TARGET,
      mode: {
        player: 0,
        points: 2
      }
    };
  },

  scoreCardMeta(g, index) {
    return [`To go: ${Math.max(0, TARGET - g.scores[index])}`];
  },

  winner(g) {
    const top = Math.max(...g.scores);
    if (top < TARGET) return "";
    const leaders = g.teams.filter((_, index) => g.scores[index] === top);
    return leaders.length === 1 ? `${leaders[0]} wins` : "Tie game";
  },

  renderEntry(g) {
    const m = g.mode;
    const preview = Math.min(TARGET, g.scores[m.player] + Number(m.points || 0));
    return `
      <section class="panel">
        <h2>Cribbage Board</h2>
        <div class="crib-board" aria-label="Cribbage peg board">
          ${g.teams.map((team, index) => `
            <section class="crib-track">
              <div class="crib-track-head">
                <strong>${escapeHtml(team)}</strong>
                <span>${g.scores[index]} / ${TARGET}</span>
              </div>
              <div class="crib-holes">${boardHoles(g.scores[index])}</div>
            </section>
          `).join("")}
        </div>

        <fieldset class="field">
          <legend>Player</legend>
          <div class="segmented">
            ${g.teams.map((team, index) => `
              <button class="chip ${m.player === index ? "active" : ""}" data-action="crib-player" data-team="${index}">
                ${escapeHtml(team)}
              </button>
            `).join("")}
          </div>
        </fieldset>

        <div class="field">
          <label for="crib-points">Points to peg</label>
          <select id="crib-points" data-action="crib-points">${numberOptions(29, m.points, 1)}</select>
        </div>

        <div class="quick-points" aria-label="Quick cribbage points">
          ${QUICK_POINTS.map((value) => `
            <button class="quick-point ${Number(m.points) === value ? "active" : ""}" data-action="crib-quick" data-points="${value}">
              ${value}
            </button>
          `).join("")}
        </div>

        <div class="canasta-note">${escapeHtml(g.teams[m.player])}: ${g.scores[m.player]} → ${preview}</div>
        ${actionButtons(g).replace("Submit Hand", "Peg Points")}
      </section>
    `;
  },

  renderTable() {
    return `
      <section class="panel rules">
        <h2>Cribbage Board</h2>
        <p>Cribbage is usually played to 121. Use the point selector or quick buttons to peg points for a player.</p>
        <p>Common peg amounts include 1 for go, 2 for pair/fifteen, 3 for run, 4 for double pair, and larger totals for hand or crib counts.</p>
      </section>
    `;
  },

  renderRules() {
    return `
      <section class="panel rules">
        <h2>Cribbage Rules</h2>
        <h3>Goal</h3>
        <p>First player to 121 wins.</p>
        <h3>Scoring</h3>
        <p>This board works like a physical cribbage board: count points at the table, then peg them for the correct player.</p>
        <h3>Common Scores</h3>
        <p>Fifteens score 2, pairs score 2, runs score their length, flushes usually score 4 or 5, nobs scores 1, and go scores 1.</p>
      </section>
    `;
  },

  handleChange(g, el) {
    if (el.dataset.action === "crib-points") return { mode: { ...g.mode, points: Number(el.value) } };
    return null;
  },

  handleClick(g, button) {
    if (button.dataset.action === "crib-player") return { mode: { ...g.mode, player: Number(button.dataset.team) } };
    if (button.dataset.action === "crib-quick") return { mode: { ...g.mode, points: Number(button.dataset.points) } };
    return null;
  },

  submit(g) {
    const player = g.mode.player;
    const points = Number(g.mode.points) || 0;
    const scores = g.scores.slice();
    const before = scores[player];
    scores[player] = Math.min(TARGET, scores[player] + points);
    const deltas = g.scores.map(() => 0);
    deltas[player] = scores[player] - before;
    const hand = {
      summary: `${g.teams[player]} pegs ${points}`,
      detail: `${before} to ${scores[player]}`,
      deltas,
      scoresBefore: g.scores,
      scoresAfter: scores,
      modeBefore: clone(g.mode)
    };
    return {
      scores,
      history: [hand, ...g.history].slice(0, 100),
      undone: []
    };
  }
};
