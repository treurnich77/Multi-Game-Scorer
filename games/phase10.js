import { actionButtons, clone, escapeHtml, signed } from "./shared.js";

const emptyMode = (count) => ({
  points: Array.from({ length: count }, () => 0),
  completed: Array.from({ length: count }, () => false)
});

export const phase10 = {
  key: "phase10",
  label: "Phase 10",
  fullName: "Phase 10",
  target: 10,

  createState() {
    return {
      teams: ["Player 1", "Player 2", "Player 3", "Player 4"],
      scores: [0, 0, 0, 0],
      phases: [1, 1, 1, 1],
      history: [],
      undone: [],
      target: 10,
      mode: emptyMode(4)
    };
  },

  scoreCardMeta(g, index) {
    return [`Phase: ${Math.min(g.phases[index], 10)}`];
  },

  winner(g) {
    const finishers = g.teams.map((_, index) => index).filter((index) => g.phases[index] > 10);
    if (!finishers.length) return "";
    const low = Math.min(...finishers.map((index) => g.scores[index]));
    const leaders = finishers.filter((index) => g.scores[index] === low);
    return leaders.length === 1 ? `${g.teams[leaders[0]]} wins` : "Tie game";
  },

  renderEntry(g) {
    return `
      <section class="panel">
        <h2>Phase 10 Round Entry</h2>
        <div class="round-entry-grid">
          ${g.teams.map((team, index) => `
            <section class="round-player">
              <h3>${escapeHtml(team)}</h3>
              <div class="mini-pill">Current phase: ${Math.min(g.phases[index], 10)}</div>
              <div class="field">
                <label for="phase-points-${index}">Round points</label>
                <input id="phase-points-${index}" type="number" min="0" inputmode="numeric" data-action="phase-points" data-team="${index}" value="${g.mode.points[index]}" />
              </div>
              <button class="chip ${g.mode.completed[index] ? "active" : ""}" data-action="phase-complete" data-team="${index}" aria-pressed="${g.mode.completed[index]}">Completed phase</button>
            </section>
          `).join("")}
        </div>
        ${actionButtons(g)}
        <div class="actions">
          <button class="secondary" data-action="phase-add-player" ${g.teams.length >= 8 ? "disabled" : ""}>Add Player</button>
          <button class="secondary" data-action="phase-remove-player" ${g.teams.length <= 2 ? "disabled" : ""}>Remove Player</button>
        </div>
      </section>
    `;
  },

  renderTable() {
    return `
      <section class="panel rules">
        <h2>Phase 10 Scoring</h2>
        <p>Enter each player's remaining-card points for the round. If a player completed their current phase, mark Completed phase and they advance after submission.</p>
        <p>When someone completes Phase 10, the player furthest through the phases with the lowest score wins.</p>
      </section>
    `;
  },

  renderRules() {
    return `
      <section class="panel rules">
        <h2>Phase 10 Rules</h2>
        <p>Players work through phases 1 to 10. At the end of each round, enter leftover-card points and mark who completed their phase.</p>
      </section>
    `;
  },

  handleInput(g, el) {
    if (el.dataset.action !== "phase-points") return null;
    const points = g.mode.points.slice();
    points[Number(el.dataset.team)] = Math.max(0, Number(el.value) || 0);
    return { mode: { ...g.mode, points } };
  },

  handleChange(g, el) {
    return this.handleInput(g, el);
  },

  handleClick(g, button) {
    if (button.dataset.action === "phase-complete") {
      const completed = g.mode.completed.slice();
      completed[Number(button.dataset.team)] = !completed[Number(button.dataset.team)];
      return { mode: { ...g.mode, completed } };
    }
    if (button.dataset.action === "phase-add-player") {
      const next = g.teams.length + 1;
      return {
        teams: [...g.teams, `Player ${next}`],
        scores: [...g.scores, 0],
        phases: [...g.phases, 1],
        mode: { points: [...g.mode.points, 0], completed: [...g.mode.completed, false] }
      };
    }
    if (button.dataset.action === "phase-remove-player") {
      return {
        teams: g.teams.slice(0, -1),
        scores: g.scores.slice(0, -1),
        phases: g.phases.slice(0, -1),
        mode: { points: g.mode.points.slice(0, -1), completed: g.mode.completed.slice(0, -1) }
      };
    }
    return null;
  },

  submit(g) {
    const scores = g.scores.map((score, index) => score + (Number(g.mode.points[index]) || 0));
    const phases = g.phases.map((phase, index) => g.mode.completed[index] ? phase + 1 : phase);
    const deltas = g.mode.points.map((value) => Number(value) || 0);
    const hand = {
      summary: "Phase 10 round",
      detail: g.teams.map((team, index) => `${team} ${signed(deltas[index])}${g.mode.completed[index] ? ", advanced" : ""}`).join("; "),
      deltas,
      scoresBefore: g.scores,
      scoresAfter: scores,
      modeBefore: clone(g.mode),
      gameBefore: clone(g),
      gameAfter: { ...clone(g), scores, phases, mode: emptyMode(g.teams.length) }
    };
    return { scores, phases, mode: emptyMode(g.teams.length), history: [hand, ...g.history].slice(0, 100), undone: [] };
  }
};
