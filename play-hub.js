const CORE_KEY = "multiGameScorer:v6";
const PLAY_KEY = "multiGameScorer:play:v1";

const COLOUR_HEX = {
  emerald: "#16845d", blue: "#3277c7", violet: "#7a58bd", amber: "#b47716",
  rose: "#b84661", teal: "#167c82", slate: "#5e6b78", orange: "#c45d22",
  cyan: "#1b8fb8", indigo: "#4f5aad", lime: "#6f8f2a", pink: "#c45695",
  brown: "#7a523a", red: "#c23b31", navy: "#264a73", gold: "#aa8500"
};
const COLOUR_KEYS = Object.keys(COLOUR_HEX);
const DICE_GLYPHS = ["⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];

const CATEGORIES = [
  ["ones", "Ones"], ["twos", "Twos"], ["threes", "Threes"], ["fours", "Fours"],
  ["fives", "Fives"], ["sixes", "Sixes"], ["threeKind", "3 of a kind"],
  ["fourKind", "4 of a kind"], ["fullHouse", "Full house"], ["smallStraight", "Small straight"],
  ["largeStraight", "Large straight"], ["fiveKind", "Five of a kind"], ["chance", "Chance"]
];
const UPPER_KEYS = ["ones", "twos", "threes", "fours", "fives", "sixes"];

let overlay = null;
let setupSelection = new Set();
let queued = false;

function readCore() {
  try { return JSON.parse(localStorage.getItem(CORE_KEY)) || {}; } catch { return {}; }
}

function readPlay() {
  try { return JSON.parse(localStorage.getItem(PLAY_KEY)) || {}; } catch { return {}; }
}

function writePlay(state) {
  localStorage.setItem(PLAY_KEY, JSON.stringify(state));
}

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[char]));
}

function injectHomeHub() {
  const home = document.querySelector(".home-shell");
  const summary = home?.querySelector(".home-summary");
  if (!home || !summary || home.querySelector(".play-home-section")) return;

  const section = document.createElement("section");
  section.className = "section-block play-home-section";
  section.innerHTML = `
    <div class="section-heading-row">
      <div><span class="eyebrow">Game night</span><h2>Play & rules</h2></div>
    </div>
    <div class="play-home-grid">
      <button class="play-home-card" type="button" data-play-hub="five-dice">
        <span class="play-home-mark">⚄</span><span><strong>Five Dice</strong><small>Pass the phone · 2–6 players · offline</small></span>
      </button>
      <button class="play-home-card" type="button" data-play-hub="rules">
        <span class="play-home-mark">♠</span><span><strong>Rules Library</strong><small>Texas Hold’em and game-night reference</small></span>
      </button>
    </div>`;
  summary.insertAdjacentElement("afterend", section);
}

function ensureOverlay() {
  if (overlay?.isConnected) return overlay;
  overlay = document.createElement("div");
  overlay.className = "play-hub-overlay";
  overlay.hidden = true;
  overlay.addEventListener("click", handleOverlayClick);
  document.body.appendChild(overlay);
  return overlay;
}

function closeOverlay() {
  if (!overlay) return;
  overlay.hidden = true;
  overlay.innerHTML = "";
  document.documentElement.classList.remove("play-hub-open");
}

function openOverlay(html, className = "") {
  const node = ensureOverlay();
  node.className = `play-hub-overlay ${className}`.trim();
  node.innerHTML = html;
  node.hidden = false;
  document.documentElement.classList.add("play-hub-open");
  window.scrollTo(0, 0);
}

function playerColour(player, index = 0) {
  return COLOUR_HEX[player?.color] || COLOUR_HEX[COLOUR_KEYS[index % COLOUR_KEYS.length]];
}

function fiveDiceSetup() {
  const players = (readCore().players || []).slice().sort((a, b) => a.name.localeCompare(b.name));
  if (!setupSelection.size && players.length >= 2) {
    setupSelection.add(players[0].id);
    setupSelection.add(players[1].id);
  }

  openOverlay(`
    <main class="play-hub-shell">
      <header class="play-hub-header"><button type="button" class="play-back" data-play-action="close">← Home</button><div><span class="eyebrow">Offline play</span><h1>Five Dice</h1></div></header>
      <section class="play-card">
        <h2>Who’s playing?</h2>
        <p>Choose 2–6 people. Saved player colours carry into the turn screen.</p>
        ${players.length ? `<div class="play-player-picks">${players.map((player, index) => `
          <label class="play-player-pick" style="--pick-colour:${playerColour(player, index)}">
            <input type="checkbox" data-five-player="${esc(player.id)}" ${setupSelection.has(player.id) ? "checked" : ""} />
            <span>${esc(player.name)}</span>
          </label>`).join("")}</div>` : `<p class="play-empty">No saved players yet. Use guest names below.</p>`}
        <div class="guest-grid">
          <label>Guest 1<input type="text" id="five-guest-1" maxlength="24" placeholder="Optional name" /></label>
          <label>Guest 2<input type="text" id="five-guest-2" maxlength="24" placeholder="Optional name" /></label>
        </div>
        <div class="play-inline-actions">
          <button type="button" class="primary" data-play-action="start-five">Start Five Dice</button>
          ${readPlay().fiveDice?.players?.length ? `<button type="button" class="secondary" data-play-action="resume-five">Resume saved game</button>` : ""}
        </div>
        <div class="play-note">13 scoring turns each · three rolls per turn · tap dice to hold them</div>
        <div class="play-error" aria-live="polite"></div>
      </section>
      <section class="play-card compact-rules"><h3>How it scores</h3><p>Fill each category once. Ones through Sixes total matching dice. Three/Four of a Kind score the dice total. Full House is 25, Small Straight 30, Large Straight 40, Five of a Kind 50, and Chance is the dice total. Score 63+ in the top six categories for a 35-point bonus.</p></section>
    </main>`);
}

function newScoreCard() {
  return Object.fromEntries(CATEGORIES.map(([key]) => [key, null]));
}

function buildPlayersForFive() {
  const corePlayers = readCore().players || [];
  const selected = corePlayers.filter((player) => setupSelection.has(player.id));
  const guests = [document.getElementById("five-guest-1")?.value, document.getElementById("five-guest-2")?.value]
    .map((name) => String(name || "").trim()).filter(Boolean);

  const names = selected.map((player) => player.name).concat(guests);
  const folded = names.map((name) => name.toLocaleLowerCase());
  if (names.length < 2 || names.length > 6) return { error: "Choose between 2 and 6 players." };
  if (new Set(folded).size !== folded.length) return { error: "Each player needs a different name." };

  const used = new Set(selected.map((player) => player.color).filter(Boolean));
  let guestColourIndex = 0;
  const guestPlayers = guests.map((name, index) => {
    while (used.has(COLOUR_KEYS[guestColourIndex % COLOUR_KEYS.length])) guestColourIndex += 1;
    const color = COLOUR_KEYS[guestColourIndex % COLOUR_KEYS.length];
    used.add(color);
    guestColourIndex += 1;
    return { id: `guest_${Date.now()}_${index}`, name, color };
  });

  return { players: selected.map((player) => ({ id: player.id, name: player.name, color: player.color })).concat(guestPlayers) };
}

function startFiveDice() {
  const built = buildPlayersForFive();
  if (built.error) {
    const error = overlay?.querySelector(".play-error");
    if (error) error.textContent = built.error;
    return;
  }

  const game = {
    version: 1,
    players: built.players.map((player) => ({ ...player, scores: newScoreCard() })),
    current: 0,
    dice: [1, 1, 1, 1, 1],
    held: [false, false, false, false, false],
    rolls: 0,
    phase: "turn",
    startedAt: new Date().toISOString()
  };
  writePlay({ ...readPlay(), fiveDice: game });
  renderFiveDice(game);
}

function counts(dice) {
  const map = new Map();
  dice.forEach((die) => map.set(die, (map.get(die) || 0) + 1));
  return map;
}

function categoryScore(key, dice) {
  const count = counts(dice);
  const total = dice.reduce((sum, die) => sum + die, 0);
  const upperIndex = UPPER_KEYS.indexOf(key);
  if (upperIndex !== -1) {
    const face = upperIndex + 1;
    return dice.filter((die) => die === face).reduce((sum, die) => sum + die, 0);
  }
  if (key === "threeKind") return [...count.values()].some((value) => value >= 3) ? total : 0;
  if (key === "fourKind") return [...count.values()].some((value) => value >= 4) ? total : 0;
  if (key === "fullHouse") {
    const values = [...count.values()].sort();
    return values.length === 2 && values[0] === 2 && values[1] === 3 ? 25 : 0;
  }
  const unique = [...new Set(dice)].sort((a, b) => a - b).join("");
  if (key === "smallStraight") return ["1234", "2345", "3456"].some((run) => [...run].every((digit) => unique.includes(digit))) ? 30 : 0;
  if (key === "largeStraight") return unique === "12345" || unique === "23456" ? 40 : 0;
  if (key === "fiveKind") return [...count.values()].some((value) => value === 5) ? 50 : 0;
  if (key === "chance") return total;
  return 0;
}

function upperSubtotal(scores) {
  return UPPER_KEYS.reduce((sum, key) => sum + (Number(scores[key]) || 0), 0);
}

function totalScore(scores) {
  const base = CATEGORIES.reduce((sum, [key]) => sum + (Number(scores[key]) || 0), 0);
  return base + (upperSubtotal(scores) >= 63 ? 35 : 0);
}

function allFilled(scores) {
  return CATEGORIES.every(([key]) => scores[key] !== null);
}

function turnBackground(player, index) {
  const hex = playerColour(player, index);
  return `--turn-colour:${hex};--turn-wash:${hex}24`;
}

function scoreButtons(player, game) {
  return CATEGORIES.map(([key, label]) => {
    const used = player.scores[key] !== null;
    const preview = game.rolls ? categoryScore(key, game.dice) : "—";
    return `<button type="button" class="five-score-choice ${used ? "used" : ""}" data-five-score="${key}" ${used || !game.rolls ? "disabled" : ""}><span>${label}</span><strong>${used ? player.scores[key] : preview}</strong></button>`;
  }).join("");
}

function scoreboard(game) {
  return game.players.map((player, index) => `
    <div class="five-player-total ${index === game.current ? "active" : ""}" style="--player-colour:${playerColour(player, index)}">
      <span>${esc(player.name)}</span><strong>${totalScore(player.scores)}</strong>
    </div>`).join("");
}

function renderFiveDice(game = readPlay().fiveDice) {
  if (!game?.players?.length) return fiveDiceSetup();
  const player = game.players[game.current] || game.players[0];
  const colour = playerColour(player, game.current);

  if (game.phase === "finished") {
    const ranked = game.players.map((item, index) => ({ ...item, total: totalScore(item.scores), index })).sort((a, b) => b.total - a.total);
    const top = ranked[0]?.total ?? 0;
    const winners = ranked.filter((item) => item.total === top).map((item) => item.name);
    openOverlay(`
      <main class="play-hub-shell five-dice-screen" style="${turnBackground(player, game.current)}">
        <header class="play-hub-header"><button type="button" class="play-back" data-play-action="close">← Home</button><div><span class="eyebrow">Five Dice</span><h1>Game complete</h1></div></header>
        <section class="five-finish-card"><span class="winner-kicker">Winner</span><h2>${esc(winners.join(" & "))}</h2><strong>${top} points</strong></section>
        <section class="play-card"><div class="five-final-list">${ranked.map((item) => `<div><span>${esc(item.name)}</span><strong>${item.total}</strong></div>`).join("")}</div><div class="play-inline-actions"><button class="primary" type="button" data-play-action="new-five">Play again</button><button class="secondary" type="button" data-play-action="close">Done</button></div></section>
      </main>`, "five-overlay");
    return;
  }

  if (game.phase === "pass") {
    openOverlay(`
      <main class="play-hub-shell five-dice-screen pass-screen" style="${turnBackground(player, game.current)}">
        <header class="play-hub-header"><button type="button" class="play-back" data-play-action="close">← Home</button><div><span class="eyebrow">Pass the phone</span><h1>Five Dice</h1></div></header>
        <section class="pass-card"><span>Next player</span><h2 style="color:${colour}">${esc(player.name)}</h2><p>Hand the phone over. Tap ready when ${esc(player.name)} has it.</p><button class="primary large-ready" type="button" data-play-action="ready-five">I’m ready</button></section>
        <section class="five-score-strip">${scoreboard(game)}</section>
      </main>`, "five-overlay");
    return;
  }

  const rollsLeft = Math.max(0, 3 - game.rolls);
  openOverlay(`
    <main class="play-hub-shell five-dice-screen" style="${turnBackground(player, game.current)}">
      <header class="play-hub-header"><button type="button" class="play-back" data-play-action="close">← Home</button><div><span class="eyebrow">Turn ${CATEGORIES.filter(([key]) => player.scores[key] !== null).length + 1} of 13</span><h1>${esc(player.name)}</h1></div></header>
      <section class="five-score-strip">${scoreboard(game)}</section>
      <section class="five-turn-card">
        <div class="dice-row">${game.dice.map((die, index) => `<button type="button" class="die-button ${game.held[index] ? "held" : ""}" data-die-index="${index}" ${!game.rolls ? "disabled" : ""} aria-label="Die ${index + 1}: ${die}${game.held[index] ? ", held" : ""}"><span>${DICE_GLYPHS[die - 1]}</span><small>${game.held[index] ? "HELD" : "tap to hold"}</small></button>`).join("")}</div>
        <button type="button" class="primary roll-button" data-play-action="roll-five" ${rollsLeft === 0 ? "disabled" : ""}>${game.rolls === 0 ? "Roll dice" : rollsLeft ? `Roll again · ${rollsLeft} left` : "Choose a score"}</button>
        <div class="five-tip">${game.rolls ? "Hold any dice you want to keep, then roll again or score the turn." : "Roll all five dice to begin."}</div>
      </section>
      <section class="play-card five-score-card">
        <div class="five-score-head"><h2>Choose a score</h2><span>Top ${upperSubtotal(player.scores)}/63 ${upperSubtotal(player.scores) >= 63 ? "· +35 bonus" : ""}</span></div>
        <div class="five-score-grid">${scoreButtons(player, game)}</div>
      </section>
    </main>`, "five-overlay");
}

function rollFiveDice() {
  const play = readPlay();
  const game = play.fiveDice;
  if (!game || game.phase !== "turn" || game.rolls >= 3) return;
  game.dice = game.dice.map((die, index) => game.held[index] ? die : Math.floor(Math.random() * 6) + 1);
  game.rolls += 1;
  writePlay({ ...play, fiveDice: game });
  renderFiveDice(game);
}

function toggleDie(index) {
  const play = readPlay();
  const game = play.fiveDice;
  if (!game || game.phase !== "turn" || !game.rolls) return;
  game.held[index] = !game.held[index];
  writePlay({ ...play, fiveDice: game });
  renderFiveDice(game);
}

function scoreFiveDice(key) {
  const play = readPlay();
  const game = play.fiveDice;
  if (!game || game.phase !== "turn" || !game.rolls) return;
  const player = game.players[game.current];
  if (!player || player.scores[key] !== null) return;
  player.scores[key] = categoryScore(key, game.dice);

  if (game.players.every((item) => allFilled(item.scores))) {
    game.phase = "finished";
  } else {
    game.current = (game.current + 1) % game.players.length;
    while (allFilled(game.players[game.current].scores)) game.current = (game.current + 1) % game.players.length;
    game.dice = [1, 1, 1, 1, 1];
    game.held = [false, false, false, false, false];
    game.rolls = 0;
    game.phase = "pass";
  }
  writePlay({ ...play, fiveDice: game });
  renderFiveDice(game);
}

function readyFiveDice() {
  const play = readPlay();
  const game = play.fiveDice;
  if (!game || game.phase !== "pass") return;
  game.phase = "turn";
  writePlay({ ...play, fiveDice: game });
  renderFiveDice(game);
}

function rulesLibrary() {
  openOverlay(`
    <main class="play-hub-shell rules-library-screen">
      <header class="play-hub-header"><button type="button" class="play-back" data-play-action="close">← Home</button><div><span class="eyebrow">Reference</span><h1>Rules Library</h1></div></header>
      <section class="play-card rule-feature-card">
        <span class="rule-badge">Poker</span><h2>Texas Hold’em</h2><p>Two private hole cards per player, five shared community cards, and the best five-card poker hand wins the pot.</p>
      </section>
      <section class="play-card rules-article">
        <h3>Setup</h3><p>Texas Hold’em is commonly played with 2–10 players and a standard 52-card deck. The dealer button moves clockwise after each hand. The player left of the button posts the small blind and the next player posts the big blind.</p>
        <h3>The deal</h3><p>Each player receives two face-down hole cards. Five community cards are eventually dealt face up in the middle of the table. Every player may use any combination of their two hole cards and the five community cards to make their best five-card hand.</p>
        <h3>Betting rounds</h3><p><strong>Pre-flop:</strong> betting begins after the two hole cards are dealt. <strong>Flop:</strong> three community cards are dealt, followed by betting. <strong>Turn:</strong> a fourth community card is dealt, followed by betting. <strong>River:</strong> the fifth and final community card is dealt, followed by the last betting round.</p>
        <h3>Player actions</h3><p>A player may check when no bet is outstanding, bet, call an existing bet, raise, or fold. Betting continues around the table until all remaining players have matched the current bet or everyone but one player has folded.</p>
        <h3>Showdown</h3><p>If two or more players remain after the final betting round, they reveal their cards. The highest-ranking five-card poker hand wins. If two players have exactly equal five-card hands, the pot is split.</p>
        <h3>Hand rankings · highest to lowest</h3>
        <ol class="poker-rankings">
          <li><strong>Royal Flush</strong> — A, K, Q, J, 10 of the same suit.</li>
          <li><strong>Straight Flush</strong> — five consecutive cards of the same suit.</li>
          <li><strong>Four of a Kind</strong> — four cards of the same rank.</li>
          <li><strong>Full House</strong> — three of a kind plus a pair.</li>
          <li><strong>Flush</strong> — five cards of the same suit.</li>
          <li><strong>Straight</strong> — five consecutive cards of mixed suits.</li>
          <li><strong>Three of a Kind</strong> — three cards of the same rank.</li>
          <li><strong>Two Pair</strong> — two different pairs.</li>
          <li><strong>One Pair</strong> — two cards of the same rank.</li>
          <li><strong>High Card</strong> — the highest card when no other hand is made.</li>
        </ol>
        <h3>Important detail</h3><p>You do not have to use both hole cards. You may use both, one, or neither if the five community cards themselves make your best hand.</p>
      </section>
    </main>`);
}

function handleOverlayClick(event) {
  const actionButton = event.target.closest("[data-play-action]");
  if (actionButton) {
    const action = actionButton.dataset.playAction;
    if (action === "close") return closeOverlay();
    if (action === "start-five") return startFiveDice();
    if (action === "resume-five") return renderFiveDice();
    if (action === "roll-five") return rollFiveDice();
    if (action === "ready-five") return readyFiveDice();
    if (action === "new-five") {
      const play = readPlay();
      delete play.fiveDice;
      writePlay(play);
      setupSelection.clear();
      return fiveDiceSetup();
    }
  }

  const playerToggle = event.target.closest("input[data-five-player]");
  if (playerToggle) {
    if (playerToggle.checked) setupSelection.add(playerToggle.dataset.fivePlayer);
    else setupSelection.delete(playerToggle.dataset.fivePlayer);
    return;
  }

  const die = event.target.closest("[data-die-index]");
  if (die) return toggleDie(Number(die.dataset.dieIndex));

  const score = event.target.closest("[data-five-score]");
  if (score) return scoreFiveDice(score.dataset.fiveScore);
}

function handleDocumentClick(event) {
  const button = event.target.closest("[data-play-hub]");
  if (!button) return;
  if (button.dataset.playHub === "five-dice") fiveDiceSetup();
  if (button.dataset.playHub === "rules") rulesLibrary();
}

function queueRefresh() {
  if (queued) return;
  queued = true;
  queueMicrotask(() => {
    queued = false;
    injectHomeHub();
  });
}

const appRoot = document.getElementById("app");
if (appRoot) new MutationObserver(queueRefresh).observe(appRoot, { childList: true });
document.addEventListener("click", handleDocumentClick);
document.addEventListener("keydown", (event) => { if (event.key === "Escape" && !overlay?.hidden) closeOverlay(); });
document.addEventListener("DOMContentLoaded", queueRefresh);
queueRefresh();
