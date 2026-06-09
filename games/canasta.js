import { actionButtons, clone, escapeHtml, signed } from "./shared.js";

const VARIANTS = {
  standard: { label: "Standard", target: 5000, redThreeMax: 4, redThreeAllBonus: 800 },
  samba: { label: "Samba", target: 10000, redThreeMax: 6, redThreeAllBonus: 1000 }
};

const emptyTeamRound = () => ({
  cardPoints: 0,
  naturalCanastas: 0,
  mixedCanastas: 0,
  sambas: 0,
  redThrees: 0,
  blackThreeBonus: 0,
  wentOut: false,
  concealed: false
});

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}

function bonusForTeam(team, variantKey) {
  const variant = VARIANTS[variantKey];
  const redThreeScore = team.redThrees === variant.redThreeMax
    ? variant.redThreeAllBonus
    : team.redThrees * 100;
  return {
    cardPoints: Number(team.cardPoints) || 0,
    naturalCanastas: team.naturalCanastas * 500,
    mixedCanastas: team.mixedCanastas * 300,
    sambas: variantKey === "samba" ? team.sambas * 1500 : 0,
    redThrees: redThreeScore,
    blackThreeBonus: Number(team.blackThreeBonus) || 0,
    wentOut: team.wentOut ? 100 : 0,
    concealed: team.concealed ? 100 : 0
  };
}

function totalForTeam(team, variantKey) {
  const parts = bonusForTeam(team, variantKey);
  return Object.values(parts).reduce((sum, value) => sum + value, 0);
}

function variantTarget(variantKey) {
  return VARIANTS[variantKey].target;
}

function downRequirement(score, variantKey) {
  if (score < 0) return 15;
  if (score < 1500) return 50;
  if (score < 3000) return 90;
  if (variantKey === "samba" && score >= 7000) return 150;
  return 120;
}

function renderNumberField(teamIndex, field, label, value, max = 9999) {
  return `
    <div class="field">
      <label for="canasta-${field}-${teamIndex}">${label}</label>
      <input id="canasta-${field}-${teamIndex}" type="number" min="0" max="${max}" inputmode="numeric" data-action="canasta-number" data-team="${teamIndex}" data-field="${field}" value="${value}" />
    </div>
  `;
}

function renderToggle(teamIndex, field, label, active) {
  return `
    <button class="chip ${active ? "active" : ""}" data-action="canasta-toggle" data-team="${teamIndex}" data-field="${field}" aria-pressed="${active}">
      ${label}
    </button>
  `;
}

export const canasta = {
  key: "canasta",
  label: "Canasta",
  fullName: "Canasta",
  target: 5000,

  createState() {
    return {
      teams: ["Team 1", "Team 2"],
      scores: [0, 0],
      history: [],
      undone: [],
      target: 5000,
      mode: {
        variant: "standard",
        teams: [emptyTeamRound(), emptyTeamRound()]
      }
    };
  },

  scoreCardMeta(g, index) {
    return [`Down: ${downRequirement(g.scores[index], g.mode.variant)}`];
  },

  winner(g) {
    const top = Math.max(...g.scores);
    if (top < g.target) return "";
    const leaders = g.teams.filter((_, index) => g.scores[index] === top);
    return leaders.length === 1 ? `${leaders[0]} wins` : "Tie game";
  },

  renderEntry(g) {
    const m = g.mode;
    const variant = VARIANTS[m.variant];
    const totals = m.teams.map((team) => totalForTeam(team, m.variant));
    return `
      <section class="panel">
        <h2>Canasta Round Entry</h2>
        <fieldset class="field">
          <legend>Canasta Type</legend>
          <div class="segmented">
            ${Object.entries(VARIANTS).map(([key, item]) => `
              <button class="chip ${m.variant === key ? "active" : ""}" data-action="canasta-variant" data-variant="${key}">
                ${item.label}
              </button>
            `).join("")}
          </div>
        </fieldset>
        <div class="canasta-note">Target: ${variant.target}. Red threes: ${variant.redThreeMax} available; all red threes score ${variant.redThreeAllBonus}.</div>
        <div class="canasta-grid">
          ${m.teams.map((roundTeam, index) => {
            const parts = bonusForTeam(roundTeam, m.variant);
            return `
              <section class="canasta-team">
                <h3>${escapeHtml(g.teams[index])}</h3>
                ${renderNumberField(index, "cardPoints", "Card and meld points", roundTeam.cardPoints)}
                <div class="grid two">
                  ${renderNumberField(index, "naturalCanastas", "Natural canastas", roundTeam.naturalCanastas, 20)}
                  ${renderNumberField(index, "mixedCanastas", "Mixed canastas", roundTeam.mixedCanastas, 20)}
                </div>
                <div class="${m.variant === "samba" ? "" : "hidden"}">
                  ${renderNumberField(index, "sambas", "Sambas", roundTeam.sambas, 20)}
                </div>
                <div class="grid two">
                  ${renderNumberField(index, "redThrees", "Red threes", roundTeam.redThrees, variant.redThreeMax)}
                  ${renderNumberField(index, "blackThreeBonus", "Black three bonus", roundTeam.blackThreeBonus, 1000)}
                </div>
                <div class="segmented">
                  ${renderToggle(index, "wentOut", "Went out", roundTeam.wentOut)}
                  ${renderToggle(index, "concealed", "Concealed", roundTeam.concealed)}
                </div>
                <div class="canasta-breakdown">
                  <span>Cards ${signed(parts.cardPoints)}</span>
                  <span>Natural ${signed(parts.naturalCanastas)}</span>
                  <span>Mixed ${signed(parts.mixedCanastas)}</span>
                  ${m.variant === "samba" ? `<span>Sambas ${signed(parts.sambas)}</span>` : ""}
                  <span>Red 3s ${signed(parts.redThrees)}</span>
                  <span>Other ${signed(parts.blackThreeBonus + parts.wentOut + parts.concealed)}</span>
                </div>
                <div class="round-total">${signed(totals[index])}</div>
              </section>
            `;
          }).join("")}
        </div>
        ${actionButtons(g)}
      </section>
    `;
  },

  renderTable(g) {
    const variantKey = g.mode.variant;
    const variant = VARIANTS[variantKey];
    return `
      <section class="panel rules">
        <h2>${variant.label} Canasta Scoring</h2>
        <p>Natural canasta: 500. Mixed canasta: 300. Red threes are 100 each, or ${variant.redThreeAllBonus} for all ${variant.redThreeMax}. Going out: 100. Concealed out: add 100.</p>
        <p>Opening meld/down requirement: below 0 = 15, 0-1499 = 50, 1500-2999 = 90, 3000+ = 120${variantKey === "samba" ? ", and 7000+ = 150" : ""}.</p>
        ${variantKey === "samba" ? "<p>Samba sequence: 1500. Samba games commonly play to 10,000.</p>" : "<p>Standard Canasta commonly plays to 5,000.</p>"}
        <p>Enter card and meld points as the table count, then use the bonus fields for the rest.</p>
      </section>
    `;
  },

  renderRules(g) {
    const variant = VARIANTS[g.mode.variant];
    return `
      <section class="panel rules">
        <h2>${variant.label} Canasta Rules</h2>
        <h3>Round Scoring</h3>
        <p>At the end of a round, count card and meld points, then add bonuses for canastas, red threes, going out, and any house-rule bonuses.</p>
        <h3>Going Down</h3>
        <p>The team score cards show the current opening meld requirement as Down. Common thresholds are below 0 = 15, 0-1499 = 50, 1500-2999 = 90, and 3000+ = 120${g.mode.variant === "samba" ? ", with 7000+ = 150 in Samba" : ""}.</p>
        <h3>Canastas</h3>
        <p>A natural canasta scores 500. A mixed canasta scores 300.</p>
        <h3>Red Threes</h3>
        <p>Red threes are usually worth 100 each. In this scorer, collecting all ${variant.redThreeMax} red threes scores ${variant.redThreeAllBonus}.</p>
        ${g.mode.variant === "samba" ? "<h3>Samba</h3><p>Samba adds sequence melds called sambas. Each samba scores 1500, and the game target is 10,000.</p>" : ""}
        <h3>House Rules</h3>
        <p>Canasta varies by table. Use the black three bonus field for black-three bonuses or table-specific extras.</p>
      </section>
    `;
  },

  handleInput(g, el) {
    if (el.dataset.action !== "canasta-number") return null;
    const teams = clone(g.mode.teams);
    const teamIndex = Number(el.dataset.team);
    const field = el.dataset.field;
    const max = field === "redThrees" ? VARIANTS[g.mode.variant].redThreeMax : 9999;
    teams[teamIndex][field] = clamp(el.value, 0, max);
    return { mode: { ...g.mode, teams } };
  },

  handleChange(g, el) {
    return this.handleInput(g, el);
  },

  handleClick(g, button) {
    if (button.dataset.action === "canasta-variant") {
      const variant = button.dataset.variant;
      const teams = clone(g.mode.teams).map((team) => ({
        ...team,
        redThrees: clamp(team.redThrees, 0, VARIANTS[variant].redThreeMax),
        sambas: variant === "samba" ? team.sambas : 0
      }));
      return { mode: { ...g.mode, variant, teams }, target: variantTarget(variant) };
    }
    if (button.dataset.action === "canasta-toggle") {
      const teams = clone(g.mode.teams);
      const teamIndex = Number(button.dataset.team);
      const field = button.dataset.field;
      teams[teamIndex][field] = !teams[teamIndex][field];
      return { mode: { ...g.mode, teams } };
    }
    return null;
  },

  submit(g) {
    const deltas = g.mode.teams.map((team) => totalForTeam(team, g.mode.variant));
    const scores = g.scores.map((score, index) => score + deltas[index]);
    const hand = {
      summary: `${VARIANTS[g.mode.variant].label} Canasta round`,
      detail: `${g.teams[0]} ${signed(deltas[0])}, ${g.teams[1]} ${signed(deltas[1])}`,
      deltas,
      scoresBefore: g.scores,
      scoresAfter: scores,
      modeBefore: clone(g.mode)
    };
    return {
      scores,
      mode: { ...g.mode, teams: [emptyTeamRound(), emptyTeamRound()] },
      history: [hand, ...g.history].slice(0, 100),
      undone: []
    };
  }
};
