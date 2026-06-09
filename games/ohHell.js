import { actionButtons, clone, escapeHtml, numberOptions, signed } from "./shared.js";

const emptyRound = (count) => ({
  cards: 10,
  bids: Array.from({ length: count }, () => 0),
  tricks: Array.from({ length: count }, () => 0)
});

function scoreRound(bid, tricks) {
  return Number(bid) === Number(tricks) ? 10 + Number(bid) : 0;
}

export const ohHell = {
  key: "ohHell",
  label: "Oh Hell",
  fullName: "Oh Hell",
  target: 0,

  createState() {
    return {
      teams: ["Player 1", "Player 2", "Player 3", "Player 4"],
      scores: [0, 0, 0, 0],
      history: [],
      undone: [],
      target: 0,
      mode: emptyRound(4)
    };
  },

  scoreCardMeta() {
    return [];
  },

  winner() {
    return "";
  },

  renderEntry(g) {
    const totalBids = g.mode.bids.reduce((sum, value) => sum + Number(value || 0), 0);
    const totalTricks = g.mode.tricks.reduce((sum, value) => sum + Number(value || 0), 0);
    const complete = totalTricks === Number(g.mode.cards);
    const deltas = g.teams.map((_, index) => scoreRound(g.mode.bids[index], g.mode.tricks[index]));
    return `
      <section class="panel">
        <h2>Oh Hell Round Entry</h2>
        <div class="field">
          <label for="oh-cards">Cards Dealt</label>
          <select id="oh-cards" data-action="oh-cards">${numberOptions(20, g.mode.cards, 1)}</select>
        </div>
        <div class="score-warning ${complete ? "hidden" : ""}">Tricks entered: ${totalTricks}/${g.mode.cards}. Enter all tricks before submitting.</div>
        <div class="canasta-note">Total bids: ${totalBids}. Scoring: exact bid = 10 + bid; missed bid = 0.</div>
        <div class="round-entry-grid">
          ${g.teams.map((team, index) => `
            <section class="round-player">
              <h3>${escapeHtml(team)}</h3>
              <div class="grid two">
                <div class="field">
                  <label for="oh-bid-${index}">Bid</label>
                  <select id="oh-bid-${index}" data-action="oh-bid" data-team="${index}">${numberOptions(g.mode.cards, g.mode.bids[index])}</select>
                </div>
                <div class="field">
                  <label for="oh-tricks-${index}">Tricks</label>
                  <select id="oh-tricks-${index}" data-action="oh-tricks" data-team="${index}">${numberOptions(g.mode.cards, g.mode.tricks[index])}</select>
                </div>
              </div>
              <div class="round-total">${signed(deltas[index])}</div>
            </section>
          `).join("")}
        </div>
        ${actionButtons(g).replace('data-action="submit"', `data-action="submit" ${complete ? "" : "disabled"}`)}
        <div class="actions">
          <button class="secondary" data-action="oh-add-player" ${g.teams.length >= 8 ? "disabled" : ""}>Add Player</button>
          <button class="secondary" data-action="oh-remove-player" ${g.teams.length <= 3 ? "disabled" : ""}>Remove Player</button>
        </div>
      </section>
    `;
  },

  renderTable() {
    return `
      <section class="panel rules">
        <h2>Oh Hell Scoring</h2>
        <p>Each player bids a number of tricks. If they take exactly that number, they score 10 plus their bid. Otherwise they score 0.</p>
      </section>
    `;
  },

  renderRules() {
    return `
      <section class="panel rules">
        <h2>Oh Hell Rules</h2>
        <p>Each round has a set number of cards. Players bid tricks, then score only if their tricks taken exactly match their bid.</p>
      </section>
    `;
  },

  handleChange(g, el) {
    const action = el.dataset.action;
    const mode = clone(g.mode);
    if (action === "oh-cards") {
      mode.cards = Number(el.value);
      mode.bids = mode.bids.map((value) => Math.min(value, mode.cards));
      mode.tricks = mode.tricks.map((value) => Math.min(value, mode.cards));
      return { mode };
    }
    if (action === "oh-bid" || action === "oh-tricks") {
      const field = action === "oh-bid" ? "bids" : "tricks";
      mode[field][Number(el.dataset.team)] = Number(el.value);
      return { mode };
    }
    return null;
  },

  handleClick(g, button) {
    if (button.dataset.action === "oh-add-player") {
      const next = g.teams.length + 1;
      return {
        teams: [...g.teams, `Player ${next}`],
        scores: [...g.scores, 0],
        mode: { ...g.mode, bids: [...g.mode.bids, 0], tricks: [...g.mode.tricks, 0] }
      };
    }
    if (button.dataset.action === "oh-remove-player") {
      return {
        teams: g.teams.slice(0, -1),
        scores: g.scores.slice(0, -1),
        mode: { ...g.mode, bids: g.mode.bids.slice(0, -1), tricks: g.mode.tricks.slice(0, -1) }
      };
    }
    return null;
  },

  submit(g) {
    const totalTricks = g.mode.tricks.reduce((sum, value) => sum + Number(value || 0), 0);
    if (totalTricks !== Number(g.mode.cards)) return {};
    const deltas = g.teams.map((_, index) => scoreRound(g.mode.bids[index], g.mode.tricks[index]));
    const scores = g.scores.map((score, index) => score + deltas[index]);
    const hand = {
      summary: `${g.mode.cards}-card round`,
      detail: deltas.map((delta, index) => `${g.teams[index]} ${signed(delta)}`).join(", "),
      deltas,
      scoresBefore: g.scores,
      scoresAfter: scores,
      modeBefore: clone(g.mode)
    };
    return {
      scores,
      mode: { ...g.mode, bids: g.teams.map(() => 0), tricks: g.teams.map(() => 0) },
      history: [hand, ...g.history].slice(0, 100),
      undone: []
    };
  }
};
