import { clone, escapeHtml, signed } from "./shared.js";

const CARD_VALUES = [
  { key: "A", label: "A", value: 1 },
  { key: "2", label: "2", value: 2 },
  { key: "3", label: "3", value: 3 },
  { key: "4", label: "4", value: 4 },
  { key: "5", label: "5", value: 5 },
  { key: "6", label: "6", value: 6 },
  { key: "7", label: "7", value: 7 },
  { key: "8", label: "8", value: 8 },
  { key: "9", label: "9", value: 9 },
  { key: "10", label: "10", value: 10 },
  { key: "J", label: "J", value: 10 },
  { key: "Q", label: "Q", value: 10 },
  { key: "K", label: "K", value: 0 },
  { key: "JK", label: "Joker", value: -3 }
];

const emptyHand = () => ["", "", "", "", "", ""];
const emptyClosed = () => [false, false, false];
const COLUMNS = [[0, 3], [1, 4], [2, 5]];

function cardValue(key) {
  const card = CARD_VALUES.find((item) => item.key === key);
  return card ? card.value : 0;
}

function handComplete(hand, closed = emptyClosed()) {
  return COLUMNS.every(([top, bottom], columnIndex) => closed[columnIndex] || (hand[top] && hand[bottom]));
}

function scoreHand(hand, closed = emptyClosed()) {
  if (!handComplete(hand, closed)) return null;
  let total = 0;
  for (const [columnIndex, [top, bottom]] of COLUMNS.entries()) {
    if (closed[columnIndex]) continue;
    if (hand[top] === hand[bottom]) continue;
    total += cardValue(hand[top]) + cardValue(hand[bottom]);
  }
  return total;
}

function activeIndexes(g) {
  return g.teams.map((_, index) => index).filter((index) => !g.eliminated[index]);
}

function closedFor(g, index) {
  return (g.mode.closed && g.mode.closed[index]) || emptyClosed();
}

function applyGolfScore(current, roundScore) {
  const raw = current + roundScore;
  if (raw === 100) return { score: 70, note: "landed on 100 and drops to 70" };
  if (raw >= 101) return { score: raw, note: "eliminated" };
  return { score: raw, note: "" };
}

function cardOptions(selected) {
  return `
    <option value="" ${selected ? "" : "selected"}>?</option>
    ${CARD_VALUES.map((card) => `<option value="${card.key}" ${selected === card.key ? "selected" : ""}>${card.label}</option>`).join("")}
  `;
}

function golfActions(g, complete) {
  return `
    <div class="actions">
      <button class="primary" data-action="submit" ${complete ? "" : "disabled"}>Submit Round</button>
      <button class="secondary" data-action="undo" ${g.history.length ? "" : "disabled"} title="Undo last round">Undo</button>
      <button class="secondary" data-action="redo" ${g.undone.length ? "" : "disabled"} title="Redo round">Redo</button>
      <button class="secondary" data-action="golf-add-player" ${g.teams.length >= 8 ? "disabled" : ""}>Add Player</button>
      <button class="secondary" data-action="golf-remove-player" ${g.teams.length <= 2 ? "disabled" : ""}>Remove Player</button>
    </div>
  `;
}

export const golf = {
  key: "golf",
  label: "Golf",
  fullName: "Golf",
  target: 101,

  createState() {
    return {
      teams: ["Player 1", "Player 2", "Player 3", "Player 4"],
      scores: [0, 0, 0, 0],
      eliminated: [false, false, false, false],
      history: [],
      undone: [],
      target: 101,
      mode: {
        hands: [emptyHand(), emptyHand(), emptyHand(), emptyHand()],
        closed: [emptyClosed(), emptyClosed(), emptyClosed(), emptyClosed()]
      }
    };
  },

  scoreCardMeta(g, index) {
    if (g.eliminated[index]) return ["Out"];
    return [`Out at: ${Math.max(0, 101 - g.scores[index])}`];
  },

  winner(g) {
    const active = activeIndexes(g);
    if (active.length === 1 && g.eliminated.some(Boolean)) return `${g.teams[active[0]]} wins`;
    return "";
  },

  renderEntry(g) {
    const active = activeIndexes(g);
    const complete = active.length > 0 && active.every((index) => handComplete(g.mode.hands[index], closedFor(g, index)));
    return `
      <section class="panel">
        <h2>Golf Round Entry</h2>
        <div class="canasta-note">6-card Golf: matching vertical columns cancel. Kings score 0. Jokers score -3. At 101 you are out; landing exactly on 100 drops back to 70.</div>
        <div class="golf-grid">
          ${g.teams.map((team, playerIndex) => {
            const hand = g.mode.hands[playerIndex] || emptyHand();
            const closed = closedFor(g, playerIndex);
            const roundScore = scoreHand(hand, closed);
            const projected = roundScore == null ? null : applyGolfScore(g.scores[playerIndex], roundScore);
            return `
              <section class="golf-player ${g.eliminated[playerIndex] ? "eliminated" : ""}">
                <h3>${escapeHtml(team)}</h3>
                ${g.eliminated[playerIndex] ? `
                  <div class="score-warning">Eliminated at ${g.scores[playerIndex]}.</div>
                ` : `
                  <div class="golf-hand" aria-label="${escapeHtml(team)} six card golf hand">
                    ${COLUMNS.map(([top, bottom], columnIndex) => `
                      <div class="golf-column ${closed[columnIndex] ? "closed" : ""}">
                        <select data-action="golf-card" data-team="${playerIndex}" data-card="${top}" ${closed[columnIndex] ? "disabled" : ""} aria-label="${escapeHtml(team)} column ${columnIndex + 1} top card">
                          ${cardOptions(hand[top])}
                        </select>
                        <select data-action="golf-card" data-team="${playerIndex}" data-card="${bottom}" ${closed[columnIndex] ? "disabled" : ""} aria-label="${escapeHtml(team)} column ${columnIndex + 1} bottom card">
                          ${cardOptions(hand[bottom])}
                        </select>
                        <button class="golf-close ${closed[columnIndex] ? "active" : ""}" data-action="golf-close" data-team="${playerIndex}" data-column="${columnIndex}" aria-pressed="${closed[columnIndex]}">
                          Closed
                        </button>
                      </div>
                    `).join("")}
                  </div>
                  <div class="golf-columns">
                    ${COLUMNS.map(([top, bottom], columnIndex) => `
                      <span>Col ${columnIndex + 1} ${closed[columnIndex] ? "closed" : hand[top] && hand[bottom] && hand[top] === hand[bottom] ? "cancels" : ""}</span>
                    `).join("")}
                  </div>
                  <div class="round-total">${roundScore == null ? "Incomplete" : signed(roundScore)}</div>
                  ${projected ? `<div class="mini-pill">After round: ${projected.score}${projected.note ? ` (${projected.note})` : ""}</div>` : ""}
                `}
              </section>
            `;
          }).join("")}
        </div>
        ${golfActions(g, complete)}
      </section>
    `;
  },

  renderTable() {
    return `
      <section class="panel rules">
        <h2>Golf Scoring</h2>
        <p>Aces are 1. Number cards score face value. Jacks and queens are 10. Kings are 0. Jokers are -3.</p>
        <p>Each vertical column cancels to 0 if both cards match. Add the three columns for the round score.</p>
        <p>If a matched column has already been collected back into the draw pile, mark that column Closed. Closed columns count as 0 and do not need cards entered.</p>
        <p>At 101 or more a player is eliminated. Landing exactly on 100 drops the player back to 70.</p>
      </section>
    `;
  },

  renderRules() {
    return `
      <section class="panel rules">
        <h2>Golf Rules</h2>
        <h3>Layout</h3>
        <p>Each player has six cards in two rows of three. The scorer treats each vertical pair as a column.</p>
        <h3>Matching Columns</h3>
        <p>If the two cards in a column match, that column scores 0. Otherwise, both cards count.</p>
        <p>If a matching column was already collected during play, use Closed for that column. It scores 0 and no cards are required for that column.</p>
        <h3>Card Values</h3>
        <p>Kings are 0. Jokers are -3. Aces are 1, number cards score face value, and jacks/queens score 10.</p>
        <h3>Elimination</h3>
        <p>Players are eliminated at 101 or more. If a player lands exactly on 100, they drop back to 70.</p>
      </section>
    `;
  },

  handleChange(g, el) {
    if (el.dataset.action !== "golf-card") return null;
    const hands = clone(g.mode.hands);
    hands[Number(el.dataset.team)][Number(el.dataset.card)] = el.value;
    return { mode: { ...g.mode, hands } };
  },

  handleClick(g, button) {
    if (button.dataset.action === "golf-close") {
      const hands = clone(g.mode.hands);
      const closed = clone(g.mode.closed || g.teams.map(() => emptyClosed()));
      const playerIndex = Number(button.dataset.team);
      const columnIndex = Number(button.dataset.column);
      closed[playerIndex][columnIndex] = !closed[playerIndex][columnIndex];
      if (closed[playerIndex][columnIndex]) {
        const [top, bottom] = COLUMNS[columnIndex];
        hands[playerIndex][top] = "";
        hands[playerIndex][bottom] = "";
      }
      return { mode: { ...g.mode, hands, closed } };
    }
    if (button.dataset.action === "golf-add-player") {
      const next = g.teams.length + 1;
      return {
        teams: [...g.teams, `Player ${next}`],
        scores: [...g.scores, 0],
        eliminated: [...g.eliminated, false],
        mode: { ...g.mode, hands: [...g.mode.hands, emptyHand()], closed: [...(g.mode.closed || []), emptyClosed()] }
      };
    }
    if (button.dataset.action === "golf-remove-player") {
      return {
        teams: g.teams.slice(0, -1),
        scores: g.scores.slice(0, -1),
        eliminated: g.eliminated.slice(0, -1),
        mode: { ...g.mode, hands: g.mode.hands.slice(0, -1), closed: (g.mode.closed || []).slice(0, -1) }
      };
    }
    return null;
  },

  submit(g) {
    const gameBefore = clone(g);
    const active = activeIndexes(g);
    if (!active.every((index) => handComplete(g.mode.hands[index], closedFor(g, index)))) return {};
    const scores = g.scores.slice();
    const eliminated = g.eliminated.slice();
    const deltas = g.scores.map(() => 0);
    const notes = [];

    for (const index of active) {
      const roundScore = scoreHand(g.mode.hands[index], closedFor(g, index));
      const next = applyGolfScore(scores[index], roundScore);
      deltas[index] = next.score - scores[index];
      scores[index] = next.score;
      eliminated[index] = scores[index] >= 101;
      notes.push(`${g.teams[index]} ${signed(roundScore)}${next.note ? `, ${next.note}` : ""}`);
    }

    const mode = { hands: g.teams.map(() => emptyHand()), closed: g.teams.map(() => emptyClosed()) };
    const gameAfter = { ...clone(g), scores, eliminated, mode };
    const hand = {
      summary: "Golf round",
      detail: notes.join("; "),
      deltas,
      scoresBefore: g.scores,
      scoresAfter: scores,
      modeBefore: clone(g.mode),
      gameBefore,
      gameAfter
    };
    return {
      scores,
      eliminated,
      mode,
      history: [hand, ...g.history].slice(0, 100),
      undone: []
    };
  }
};
