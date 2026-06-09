import { actionButtons, clone, escapeHtml, numberOptions, signed } from "./shared.js";

function scoreHand(bids, tricksTeam1, bags) {
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

export const spades = {
  key: "spades",
  label: "Spades",
  fullName: "Spades",
  target: 500,

  createState() {
    return {
      teams: ["Team 1", "Team 2"],
      scores: [0, 0],
      history: [],
      undone: [],
      target: 500,
      mode: {
        bids: [0, 0],
        tricksTeam1: 0,
        bags: [0, 0],
        touched: false
      }
    };
  },

  scoreCardMeta(g, index) {
    return [`Bags: ${g.mode.bags[index] || 0}`];
  },

  winner(g) {
    const top = Math.max(...g.scores);
    if (top < g.target) return "";
    const leaders = g.teams.filter((_, index) => g.scores[index] === top);
    return leaders.length === 1 ? `${leaders[0]} wins` : "Tie game";
  },

  renderEntry(g) {
    const m = g.mode;
    const preview = scoreHand(m.bids, m.tricksTeam1, m.bags);
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
          <select id="spades-tricks" data-action="spades-tricks">${numberOptions(13, m.tricksTeam1)}</select>
        </div>
        <div class="grid two ${m.touched ? "" : "hidden"}">
          <div class="mini-pill">${escapeHtml(g.teams[0])}: ${signed(preview.scores[0])}</div>
          <div class="mini-pill">${escapeHtml(g.teams[1])}: ${signed(preview.scores[1])}</div>
        </div>
        ${actionButtons(g)}
      </section>
    `;
  },

  renderTable() {
    return `
      <section class="panel rules">
        <h2>Spades Scoring</h2>
        <p>Each team bids 0 to 13. If a team makes its bid, it scores 10 points per bid trick plus 1 point per overtrick. If it fails, it loses 10 points per bid trick.</p>
        <p>Overtricks are bags. Every 10 bags costs 100 points, then the bag count drops by 10. Nil and blind nil are not included yet.</p>
      </section>
    `;
  },

  renderRules() {
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
  },

  handleInput(g, el) {
    if (el.dataset.action !== "spades-bid") return null;
    const bids = g.mode.bids.slice();
    bids[Number(el.dataset.team)] = Number(el.value);
    return { mode: { ...g.mode, bids, touched: true } };
  },

  handleChange(g, el) {
    if (el.dataset.action === "spades-tricks") return { mode: { ...g.mode, tricksTeam1: Number(el.value), touched: true } };
    if (el.dataset.action === "spades-bid") return { mode: { ...g.mode, touched: true } };
    return null;
  },

  submit(g) {
    const m = g.mode;
    const result = scoreHand(m.bids, m.tricksTeam1, m.bags);
    const scores = g.scores.map((score, index) => score + result.scores[index]);
    const hand = {
      summary: `Bids ${m.bids[0]} and ${m.bids[1]}`,
      detail: `${g.teams[0]} took ${result.tricks[0]}, ${g.teams[1]} took ${result.tricks[1]}`,
      deltas: result.scores,
      scoresBefore: g.scores,
      scoresAfter: scores,
      modeBefore: clone(m)
    };
    return {
      scores,
      mode: { bids: [0, 0], tricksTeam1: 0, bags: result.nextBags, touched: false },
      history: [hand, ...g.history].slice(0, 100),
      undone: []
    };
  }
};
