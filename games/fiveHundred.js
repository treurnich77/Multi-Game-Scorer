import { actionButtons, clone, escapeHtml, numberOptions, signed } from "./shared.js";

const SUITS = [
  { key: "S", label: "♠", name: "Spades", red: false },
  { key: "C", label: "♣", name: "Clubs", red: false },
  { key: "D", label: "♦", name: "Diamonds", red: true },
  { key: "H", label: "♥", name: "Hearts", red: true },
  { key: "NT", label: "NT", name: "No Trump", red: false }
];

const SCORE_TABLE = {
  S: { 6: 40, 7: 140, 8: 240, 9: 340, 10: 440 },
  C: { 6: 60, 7: 160, 8: 260, 9: 360, 10: 460 },
  D: { 6: 80, 7: 180, 8: 280, 9: 380, 10: 480 },
  H: { 6: 100, 7: 200, 8: 300, 9: 400, 10: 500 },
  NT: { 6: 120, 7: 220, 8: 320, 9: 420, 10: 520 }
};

function score(contractType, suit, bid, tricks) {
  if (contractType === "misere") return tricks === 0 ? 250 : -250;
  if (contractType === "openMisere") return tricks === 0 ? 500 : -500;
  const value = SCORE_TABLE[suit][bid];
  return tricks >= bid ? value : -value;
}

function describe(m) {
  if (m.contractType === "misere") return "Misere";
  if (m.contractType === "openMisere") return "Open Misere";
  const suit = SUITS.find((item) => item.key === m.suit);
  return `${m.bid} ${suit ? suit.label : m.suit}`;
}

export const fiveHundred = {
  key: "fiveHundred",
  label: "500",
  fullName: "Five Hundred",
  target: 500,

  createState() {
    return {
      teams: ["Us", "Them"],
      scores: [0, 0],
      history: [],
      undone: [],
      target: 500,
      dealer: 0,
      mode: {
        contractTeam: 0,
        contractType: "normal",
        suit: "S",
        bid: 6,
        tricks: 6,
        touched: false
      }
    };
  },

  scoreCardMeta() {
    return [];
  },

  winner(g) {
    const top = Math.max(...g.scores);
    if (top < g.target) return "";
    const leaders = g.teams.filter((_, index) => g.scores[index] === top);
    return leaders.length === 1 ? `${leaders[0]} wins` : "Tie game";
  },

  renderEntry(g) {
    const m = g.mode;
    const defendingTeam = m.contractTeam === 0 ? 1 : 0;
    const contractPreview = score(m.contractType, m.suit, Number(m.bid), Number(m.tricks));
    const defenderPreview = Math.max(0, 10 - Number(m.tricks)) * 10;
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
              <select id="bid" data-action="500-bid">${numberOptions(10, m.bid, 6)}</select>
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
            <select id="tricks" data-action="500-tricks">${numberOptions(10, m.tricks)}</select>
          </div>
          <div class="grid two ${m.touched ? "" : "hidden"}">
            <div class="mini-pill">${escapeHtml(g.teams[m.contractTeam])}: ${signed(contractPreview)}</div>
            <div class="mini-pill">${escapeHtml(g.teams[defendingTeam])}: +${defenderPreview}</div>
          </div>
        </div>
        ${actionButtons(g)}
      </section>
    `;
  },

  renderTable() {
    const rows = [6, 7, 8, 9, 10].map((bid) => `
      <tr>
        <td>${bid}</td>
        <td>${SCORE_TABLE.S[bid]}</td>
        <td>${SCORE_TABLE.C[bid]}</td>
        <td class="red-text">${SCORE_TABLE.D[bid]}</td>
        <td class="red-text">${SCORE_TABLE.H[bid]}</td>
        <td>${SCORE_TABLE.NT[bid]}</td>
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
  },

  renderRules() {
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
  },

  handleChange(g, el) {
    const m = g.mode;
    if (el.dataset.action === "500-bid") return { mode: { ...m, bid: Number(el.value), tricks: Math.max(Number(el.value), Number(m.tricks)), touched: true } };
    if (el.dataset.action === "500-tricks") return { mode: { ...m, tricks: Number(el.value), touched: true } };
    return null;
  },

  handleClick(g, button) {
    const m = g.mode;
    if (button.dataset.action === "500-type") {
      const contractType = button.dataset.type;
      return { mode: { ...m, contractType, tricks: contractType === "normal" ? Math.max(Number(m.bid), Number(m.tricks)) : 0, touched: true } };
    }
    if (button.dataset.action === "500-team") return { mode: { ...m, contractTeam: Number(button.dataset.team), touched: true } };
    if (button.dataset.action === "500-suit") return { mode: { ...m, suit: button.dataset.suit, touched: true } };
    return null;
  },

  submit(g) {
    const m = g.mode;
    const contractPoints = score(m.contractType, m.suit, Number(m.bid), Number(m.tricks));
    const defendingTeam = m.contractTeam === 0 ? 1 : 0;
    const defenderPoints = Math.max(0, 10 - Number(m.tricks)) * 10;
    const scores = g.scores.slice();
    scores[m.contractTeam] += contractPoints;
    scores[defendingTeam] += defenderPoints;
    const hand = {
      summary: `${describe(m)} by ${g.teams[m.contractTeam]}`,
      detail: `${m.tricks} tricks won`,
      deltas: [m.contractTeam === 0 ? contractPoints : defenderPoints, m.contractTeam === 1 ? contractPoints : defenderPoints],
      scoresBefore: g.scores,
      scoresAfter: scores,
      modeBefore: clone(m)
    };
    return {
      scores,
      dealer: (g.dealer + 1) % 4,
      mode: { ...m, tricks: m.contractType === "normal" ? Number(m.bid) : 0, touched: false },
      history: [hand, ...g.history].slice(0, 100),
      undone: []
    };
  }
};
