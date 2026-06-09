import { actionButtons, clone, escapeHtml, signed } from "./shared.js";

const OUTCOMES = {
  point: { label: "Made", maker: 1, defenders: 0 },
  march: { label: "March", maker: 2, defenders: 0 },
  euchred: { label: "Euchred", maker: 0, defenders: 2 },
  loner: { label: "Loner", maker: 4, defenders: 0 }
};

export const euchre = {
  key: "euchre",
  label: "Euchre",
  fullName: "Euchre",
  target: 10,

  createState() {
    return {
      teams: ["Team 1", "Team 2"],
      scores: [0, 0],
      history: [],
      undone: [],
      target: 10,
      mode: {
        maker: 0,
        outcome: "point"
      }
    };
  },

  scoreCardMeta(g) {
    return [`Target: ${g.target}`];
  },

  winner(g) {
    const top = Math.max(...g.scores);
    if (top < g.target) return "";
    const leaders = g.teams.filter((_, index) => g.scores[index] === top);
    return leaders.length === 1 ? `${leaders[0]} wins` : "Tie game";
  },

  renderEntry(g) {
    const m = g.mode;
    const defenders = m.maker === 0 ? 1 : 0;
    const outcome = OUTCOMES[m.outcome];
    const preview = [0, 0];
    preview[m.maker] = outcome.maker;
    preview[defenders] = outcome.defenders;
    return `
      <section class="panel">
        <h2>Euchre Hand Entry</h2>
        <fieldset class="field">
          <legend>Maker Team</legend>
          <div class="segmented">
            ${[0, 1].map((index) => `
              <button class="chip ${m.maker === index ? "active" : ""}" data-action="euchre-maker" data-team="${index}">
                ${escapeHtml(g.teams[index])}
              </button>
            `).join("")}
          </div>
        </fieldset>
        <fieldset class="field">
          <legend>Result</legend>
          <div class="segmented">
            ${Object.entries(OUTCOMES).map(([key, item]) => `
              <button class="chip ${m.outcome === key ? "active" : ""}" data-action="euchre-outcome" data-outcome="${key}">
                ${item.label}
              </button>
            `).join("")}
          </div>
        </fieldset>
        <div class="grid two">
          <div class="mini-pill">${escapeHtml(g.teams[0])}: ${signed(preview[0])}</div>
          <div class="mini-pill">${escapeHtml(g.teams[1])}: ${signed(preview[1])}</div>
        </div>
        ${actionButtons(g)}
      </section>
    `;
  },

  renderTable() {
    return `
      <section class="panel rules">
        <h2>Euchre Scoring</h2>
        <p>Maker makes the hand: 1 point. Maker takes all five tricks: 2 points. Maker goes alone and takes all five: 4 points. Maker is euchred: defenders score 2.</p>
        <p>First team to 10 wins.</p>
      </section>
    `;
  },

  renderRules() {
    return `
      <section class="panel rules">
        <h2>Euchre Rules</h2>
        <h3>Teams</h3>
        <p>Four players usually play as two partnerships. One team names trump and becomes the maker team.</p>
        <h3>Scoring</h3>
        <p>The maker team scores 1 for making, 2 for a march, or 4 for a successful loner. If the maker team fails, the defenders score 2.</p>
      </section>
    `;
  },

  handleClick(g, button) {
    if (button.dataset.action === "euchre-maker") return { mode: { ...g.mode, maker: Number(button.dataset.team) } };
    if (button.dataset.action === "euchre-outcome") return { mode: { ...g.mode, outcome: button.dataset.outcome } };
    return null;
  },

  submit(g) {
    const m = g.mode;
    const defenders = m.maker === 0 ? 1 : 0;
    const outcome = OUTCOMES[m.outcome];
    const deltas = [0, 0];
    deltas[m.maker] = outcome.maker;
    deltas[defenders] = outcome.defenders;
    const scores = g.scores.map((score, index) => score + deltas[index]);
    const hand = {
      summary: `${g.teams[m.maker]} ${outcome.label}`,
      detail: `${g.teams[0]} ${signed(deltas[0])}, ${g.teams[1]} ${signed(deltas[1])}`,
      deltas,
      scoresBefore: g.scores,
      scoresAfter: scores,
      modeBefore: clone(g.mode)
    };
    return { scores, history: [hand, ...g.history].slice(0, 100), undone: [] };
  }
};
