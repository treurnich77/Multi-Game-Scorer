import { actionButtons, clone, escapeHtml, signed } from "./shared.js";

const emptyMode = (count) => ({
  deltas: Array.from({ length: count }, () => 0),
  target: 100,
  direction: "high"
});

export const general = {
  key: "general",
  label: "General",
  fullName: "General Score Sheet",
  target: 100,

  createState() {
    return {
      teams: ["Player 1", "Player 2", "Player 3", "Player 4"],
      scores: [0, 0, 0, 0],
      history: [],
      undone: [],
      target: 100,
      mode: emptyMode(4)
    };
  },

  scoreCardMeta(g) {
    return [`Target: ${g.target}`];
  },

  winner(g) {
    if (g.mode.direction === "low") {
      const hit = g.scores.some((score) => score >= g.target);
      if (!hit) return "";
      const low = Math.min(...g.scores);
      const leaders = g.teams.filter((_, index) => g.scores[index] === low);
      return leaders.length === 1 ? `${leaders[0]} wins` : "Tie game";
    }
    const top = Math.max(...g.scores);
    if (top < g.target) return "";
    const leaders = g.teams.filter((_, index) => g.scores[index] === top);
    return leaders.length === 1 ? `${leaders[0]} wins` : "Tie game";
  },

  renderEntry(g) {
    return `
      <section class="panel">
        <h2>General Score Sheet</h2>
        <div class="grid two">
          <div class="field">
            <label for="general-target">Target score</label>
            <input id="general-target" type="number" inputmode="numeric" data-action="general-target" value="${g.target}" />
          </div>
          <fieldset class="field">
            <legend>Winner</legend>
            <div class="segmented">
              <button class="chip ${g.mode.direction === "high" ? "active" : ""}" data-action="general-direction" data-direction="high">High score</button>
              <button class="chip ${g.mode.direction === "low" ? "active" : ""}" data-action="general-direction" data-direction="low">Low score</button>
            </div>
          </fieldset>
        </div>
        <div class="round-entry-grid">
          ${g.teams.map((team, index) => `
            <section class="round-player">
              <h3>${escapeHtml(team)}</h3>
              <div class="field">
                <label for="general-delta-${index}">Score to add</label>
                <input id="general-delta-${index}" type="number" inputmode="numeric" data-action="general-delta" data-team="${index}" value="${g.mode.deltas[index]}" />
              </div>
              <div class="mini-pill">After round: ${g.scores[index] + (Number(g.mode.deltas[index]) || 0)}</div>
            </section>
          `).join("")}
        </div>
        ${actionButtons(g)}
        <div class="actions">
          <button class="secondary" data-action="general-add-player" ${g.teams.length >= 12 ? "disabled" : ""}>Add Player</button>
          <button class="secondary" data-action="general-remove-player" ${g.teams.length <= 2 ? "disabled" : ""}>Remove Player</button>
        </div>
      </section>
    `;
  },

  renderTable() {
    return `
      <section class="panel rules">
        <h2>General Scoring</h2>
        <p>Use this for any game where you just need to add scores each round. Set a target and choose whether high score or low score wins.</p>
      </section>
    `;
  },

  renderRules() {
    return this.renderTable();
  },

  handleInput(g, el) {
    if (el.dataset.action === "general-delta") {
      const deltas = g.mode.deltas.slice();
      deltas[Number(el.dataset.team)] = Number(el.value) || 0;
      return { mode: { ...g.mode, deltas } };
    }
    if (el.dataset.action === "general-target") {
      const target = Number(el.value) || 0;
      return { target, mode: { ...g.mode, target } };
    }
    return null;
  },

  handleChange(g, el) {
    return this.handleInput(g, el);
  },

  handleClick(g, button) {
    if (button.dataset.action === "general-direction") return { mode: { ...g.mode, direction: button.dataset.direction } };
    if (button.dataset.action === "general-add-player") {
      const next = g.teams.length + 1;
      return {
        teams: [...g.teams, `Player ${next}`],
        scores: [...g.scores, 0],
        mode: { ...g.mode, deltas: [...g.mode.deltas, 0] }
      };
    }
    if (button.dataset.action === "general-remove-player") {
      return {
        teams: g.teams.slice(0, -1),
        scores: g.scores.slice(0, -1),
        mode: { ...g.mode, deltas: g.mode.deltas.slice(0, -1) }
      };
    }
    return null;
  },

  submit(g) {
    const deltas = g.mode.deltas.map((value) => Number(value) || 0);
    const scores = g.scores.map((score, index) => score + deltas[index]);
    const hand = {
      summary: "Score round",
      detail: g.teams.map((team, index) => `${team} ${signed(deltas[index])}`).join(", "),
      deltas,
      scoresBefore: g.scores,
      scoresAfter: scores,
      modeBefore: clone(g.mode)
    };
    return {
      scores,
      mode: { ...g.mode, deltas: g.teams.map(() => 0) },
      history: [hand, ...g.history].slice(0, 100),
      undone: []
    };
  }
};
