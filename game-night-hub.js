const CORE_KEY = "multiGameScorer:v6";
const DICE_KEY = "multiGameScorer:fiveDice:v1";
const COLOUR_HEX = {
  emerald: "#16845d", blue: "#3277c7", violet: "#7a58bd", amber: "#b47716",
  rose: "#b84661", teal: "#167c82", slate: "#5e6b78", orange: "#c45d22",
  cyan: "#1b8fb8", indigo: "#4f5aad", lime: "#6f8f2a", pink: "#c45695",
  brown: "#7a523a", red: "#c23b31", navy: "#264a73", gold: "#aa8500"
};
const FALLBACK_COLOURS = Object.keys(COLOUR_HEX);
const CATEGORIES = [
  ["ones", "Ones"], ["twos", "Twos"], ["threes", "Threes"], ["fours", "Fours"], ["fives", "Fives"], ["sixes", "Sixes"],
  ["threeKind", "Three of a Kind"], ["fourKind", "Four of a Kind"], ["fullHouse", "Full House"],
  ["smallStraight", "Small Straight"], ["largeStraight", "Large Straight"], ["fiveDice", "Five Dice"], ["chance", "Chance"]
];
let diceState = null;
let setupCount = 2;

function readCore() {
  try { return JSON.parse(localStorage.getItem(CORE_KEY)) || {}; } catch { return {}; }
}
function readDice() {
  try { return JSON.parse(localStorage.getItem(DICE_KEY)) || null; } catch { return null; }
}
function writeDice() { if (diceState) localStorage.setItem(DICE_KEY, JSON.stringify(diceState)); }
function clearDice() { localStorage.removeItem(DICE_KEY); diceState = null; }
function escapeText(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[ch]));
}
function playerColour(name, index) {
  const core = readCore();
  const player = (core.players || []).find((p) => p.name?.toLocaleLowerCase() === name.toLocaleLowerCase());
  return COLOUR_HEX[player?.color] || COLOUR_HEX[FALLBACK_COLOURS[index % FALLBACK_COLOURS.length]];
}
function totalFor(player) { return Object.values(player.scores || {}).reduce((sum, value) => sum + Number(value || 0), 0); }
function availableScores(player) { return CATEGORIES.filter(([key]) => player.scores?.[key] == null); }
function counts(dice) {
  const map = {};
  dice.forEach((die) => { map[die] = (map[die] || 0) + 1; });
  return map;
}
function scoreCategory(key, dice) {
  const map = counts(dice);
  const sum = dice.reduce((a, b) => a + b, 0);
  const uniques = [...new Set(dice)].sort((a,b) => a-b).join("");
  if (["ones","twos","threes","fours","fives","sixes"].includes(key)) {
    const face = ["ones","twos","threes","fours","fives","sixes"].indexOf(key) + 1;
    return dice.filter((d) => d === face).reduce((a,b) => a+b, 0);
  }
  if (key === "threeKind") return Object.values(map).some((n) => n >= 3) ? sum : 0;
  if (key === "fourKind") return Object.values(map).some((n) => n >= 4) ? sum : 0;
  if (key === "fullHouse") return Object.values(map).sort().join(",") === "2,3" ? 25 : 0;
  if (key === "smallStraight") return ["1234","2345","3456"].some((seq) => uniques.includes(seq)) ? 30 : 0;
  if (key === "largeStraight") return ["12345","23456"].includes(uniques) ? 40 : 0;
  if (key === "fiveDice") return Object.values(map).some((n) => n === 5) ? 50 : 0;
  if (key === "chance") return sum;
  return 0;
}
function newTurn() {
  diceState.dice = [1,1,1,1,1];
  diceState.held = [false,false,false,false,false];
  diceState.rolls = 0;
  diceState.phase = "turn";
  writeDice();
}
function rollDice() {
  if (!diceState || diceState.rolls >= 3) return;
  diceState.dice = diceState.dice.map((die, i) => diceState.held[i] ? die : Math.floor(Math.random() * 6) + 1);
  diceState.rolls += 1;
  writeDice();
  renderDiceGame();
}
function chooseScore(key) {
  const player = diceState.players[diceState.current];
  if (!player || player.scores[key] != null || diceState.rolls === 0) return;
  player.scores[key] = scoreCategory(key, diceState.dice);
  const everyoneDone = diceState.players.every((p) => availableScores(p).length === 0);
  if (everyoneDone) {
    diceState.phase = "finished";
    writeDice();
    renderDiceGame();
    return;
  }
  diceState.current = (diceState.current + 1) % diceState.players.length;
  while (availableScores(diceState.players[diceState.current]).length === 0) {
    diceState.current = (diceState.current + 1) % diceState.players.length;
  }
  diceState.phase = "pass";
  diceState.rolls = 0;
  diceState.held = [false,false,false,false,false];
  writeDice();
  renderDiceGame();
}
function currentColour() {
  const p = diceState?.players?.[diceState.current];
  return p?.colour || "#31543f";
}
function renderHubHome() {
  const home = document.querySelector("main.home-shell .section-block");
  if (!home || document.querySelector(".game-night-hub")) return;
  const saved = readDice();
  const section = document.createElement("section");
  section.className = "section-block game-night-hub";
  section.innerHTML = `
    <div class="section-heading-row"><div><span class="eyebrow">Play & learn</span><h2>Game night hub</h2></div></div>
    <div class="hub-grid">
      <button class="hub-card" data-hub="five-dice"><span class="hub-icon">⚄</span><strong>${saved && saved.phase !== "finished" ? "Resume Five Dice" : "Play Five Dice"}</strong><small>Pass-the-phone dice game · 2–6 players · works offline</small></button>
      <button class="hub-card" data-hub="holdem"><span class="hub-icon">♠</span><strong>Texas Hold’em Rules</strong><small>Blinds, betting rounds, hand rankings and showdown</small></button>
    </div>`;
  home.before(section);
}
function renderDiceSetup() {
  const core = readCore();
  const names = (core.players || []).map((p) => p.name);
  const app = document.getElementById("app");
  app.innerHTML = `<main class="shell hub-screen"><section class="hub-top"><button class="secondary" data-hub="home">← Home</button><div><span class="eyebrow">Offline play</span><h1>Five Dice</h1><p>Pass the phone. Roll up to three times, hold any dice, then choose one scoring category.</p></div></section>
  <section class="panel dice-setup"><div class="field"><label>Players</label><select data-dice-setup="count">${[2,3,4,5,6].map(n => `<option value="${n}" ${n===setupCount?"selected":""}>${n}</option>`).join("")}</select></div>
  <datalist id="hub-player-names">${names.map(n => `<option value="${escapeText(n)}"></option>`).join("")}</datalist>
  <div class="dice-player-fields">${Array.from({length:setupCount}, (_,i) => `<div class="field"><label>Player ${i+1}</label><input list="hub-player-names" data-dice-name="${i}" placeholder="Name" /></div>`).join("")}</div>
  <button class="primary wide-button" data-dice-action="start">Start Five Dice</button></section></main>`;
}
function renderPass() {
  const player = diceState.players[diceState.current];
  const app = document.getElementById("app");
  app.innerHTML = `<main class="hub-turn-screen" style="--turn-colour:${currentColour()}"><section class="pass-card"><span class="eyebrow">Next turn</span><h1>Pass to ${escapeText(player.name)}</h1><p>The screen will switch to ${escapeText(player.name)}’s colour.</p><button class="primary wide-button" data-dice-action="ready">I’m ready</button><button class="secondary" data-hub="home">Home</button></section></main>`;
}
function diceGlyph(n) { return ["⚀","⚁","⚂","⚃","⚄","⚅"][n-1] || n; }
function renderDiceGame() {
  if (!diceState) diceState = readDice();
  if (!diceState) return renderDiceSetup();
  if (diceState.phase === "pass") return renderPass();
  if (diceState.phase === "finished") return renderDiceFinished();
  const p = diceState.players[diceState.current];
  const app = document.getElementById("app");
  const canScore = diceState.rolls > 0;
  app.innerHTML = `<main class="hub-turn-screen dice-game" style="--turn-colour:${currentColour()}"><section class="dice-top"><button class="secondary" data-hub="home">← Home</button><div><span class="eyebrow">${escapeText(p.name)}’s turn</span><h1>${escapeText(p.name)}</h1><p>Roll ${Math.min(diceState.rolls + 1, 3)} of 3 · Total score ${totalFor(p)}</p></div></section>
  <section class="dice-board"><div class="dice-row">${diceState.dice.map((d,i) => `<button class="die ${diceState.held[i]?"held":""}" data-die-index="${i}" ${diceState.rolls===0?"disabled":""}><span>${diceGlyph(d)}</span><small>${diceState.held[i]?"Held":"Tap to hold"}</small></button>`).join("")}</div>
  <button class="primary wide-button roll-button" data-dice-action="roll" ${diceState.rolls>=3?"disabled":""}>${diceState.rolls===0?"Roll dice":diceState.rolls>=3?"Choose a score":"Roll again"}</button></section>
  <section class="panel score-choice"><h2>Choose score</h2><div class="category-grid">${availableScores(p).map(([key,label]) => `<button class="category-card" data-score-category="${key}" ${canScore?"":"disabled"}><span>${escapeText(label)}</span><strong>${canScore?scoreCategory(key,diceState.dice):"—"}</strong></button>`).join("")}</div></section>
  <section class="panel compact-scoreboard"><h2>Scores</h2>${diceState.players.map((pl,i)=>`<div class="dice-score-line ${i===diceState.current?"active":""}"><span style="color:${pl.colour}">${escapeText(pl.name)}</span><strong>${totalFor(pl)}</strong></div>`).join("")}</section></main>`;
}
function renderDiceFinished() {
  const ordered = [...diceState.players].sort((a,b) => totalFor(b)-totalFor(a));
  const winnerScore = totalFor(ordered[0]);
  const winners = ordered.filter(p => totalFor(p) === winnerScore);
  const app = document.getElementById("app");
  app.innerHTML = `<main class="shell hub-screen"><section class="panel dice-finished"><span class="eyebrow">Game complete</span><h1>${winners.length===1?`${escapeText(winners[0].name)} wins!`:"Tie game"}</h1><div class="final-score-list">${ordered.map(p=>`<div><span style="color:${p.colour}">${escapeText(p.name)}</span><strong>${totalFor(p)}</strong></div>`).join("")}</div><button class="primary wide-button" data-dice-action="new">Play again</button><button class="secondary" data-hub="home">Home</button></section></main>`;
}
function renderHoldemRules() {
  const app = document.getElementById("app");
  app.innerHTML = `<main class="shell hub-screen"><section class="hub-top"><button class="secondary" data-hub="home">← Home</button><div><span class="eyebrow">Rules library</span><h1>Texas Hold’em</h1><p>A quick table-side guide to the standard no-limit game.</p></div></section>
  <section class="panel rules holdem-rules">
    <h2>Objective</h2><p>Win the pot either by making the best five-card poker hand at showdown or by making every other player fold.</p>
    <h2>Setup</h2><p>Texas Hold’em is normally played with a standard 52-card deck. One player has the dealer button. The player to the left posts the small blind and the next player posts the big blind. Each player receives two private hole cards.</p>
    <h2>Betting rounds</h2><p><strong>Pre-flop:</strong> betting begins after the two hole cards are dealt. <strong>Flop:</strong> three community cards are dealt face up, followed by betting. <strong>Turn:</strong> a fourth community card is dealt, followed by betting. <strong>River:</strong> the fifth and final community card is dealt, followed by the last betting round.</p>
    <h2>Actions</h2><p>Depending on the action before you, you may check, bet, call, raise or fold. In no-limit Hold’em, a player may bet any legal amount up to all of their chips.</p>
    <h2>Making a hand</h2><p>At showdown, each player makes the best possible five-card hand from any combination of their two hole cards and the five community cards. You may use both hole cards, one, or neither.</p>
    <h2>Hand ranking</h2><div class="poker-ranking">${["Royal Flush","Straight Flush","Four of a Kind","Full House","Flush","Straight","Three of a Kind","Two Pair","One Pair","High Card"].map((r,i)=>`<div><strong>${i+1}</strong><span>${r}</span></div>`).join("")}</div>
    <h2>Showdown and ties</h2><p>If two or more players have equally ranked five-card hands, the pot is split as evenly as possible. Suits do not break ties in standard Hold’em.</p>
    <h2>Simple example</h2><p>Your hole cards are A♠ K♠. The board is Q♠ J♠ 10♠ 4♦ 2♣. Your best five-card hand is A♠ K♠ Q♠ J♠ 10♠ — a royal flush.</p>
  </section></main>`;
}
function startDice() {
  const inputs = [...document.querySelectorAll("[data-dice-name]")];
  const names = inputs.map(i => i.value.trim());
  if (names.some(n => !n)) return alert("Enter every player name.");
  if (new Set(names.map(n=>n.toLocaleLowerCase())).size !== names.length) return alert("Each player needs a different name.");
  diceState = {
    version: 1,
    players: names.map((name,index)=>({ name, colour: playerColour(name,index), scores: {} })),
    current: 0, phase: "pass", dice: [1,1,1,1,1], held: [false,false,false,false,false], rolls: 0, startedAt: new Date().toISOString()
  };
  writeDice();
  renderDiceGame();
}
function goHome() { location.reload(); }

document.addEventListener("click", (event) => {
  const hub = event.target.closest("[data-hub]");
  if (hub) {
    event.preventDefault(); event.stopPropagation();
    if (hub.dataset.hub === "home") return goHome();
    if (hub.dataset.hub === "holdem") return renderHoldemRules();
    if (hub.dataset.hub === "five-dice") { diceState = readDice(); return diceState && diceState.phase !== "finished" ? renderDiceGame() : renderDiceSetup(); }
  }
  const action = event.target.closest("[data-dice-action]");
  if (action) {
    event.preventDefault(); event.stopPropagation();
    if (action.dataset.diceAction === "start") return startDice();
    if (action.dataset.diceAction === "ready") { newTurn(); return renderDiceGame(); }
    if (action.dataset.diceAction === "roll") return rollDice();
    if (action.dataset.diceAction === "new") { clearDice(); return renderDiceSetup(); }
  }
  const die = event.target.closest("[data-die-index]");
  if (die && diceState?.rolls > 0) {
    event.preventDefault(); event.stopPropagation();
    const i = Number(die.dataset.dieIndex); diceState.held[i] = !diceState.held[i]; writeDice(); renderDiceGame(); return;
  }
  const category = event.target.closest("[data-score-category]");
  if (category) { event.preventDefault(); event.stopPropagation(); return chooseScore(category.dataset.scoreCategory); }
});
document.addEventListener("change", (event) => {
  if (event.target.matches("[data-dice-setup='count']")) { setupCount = Number(event.target.value); renderDiceSetup(); }
});

const appRoot = document.getElementById("app");
if (appRoot) new MutationObserver(() => queueMicrotask(renderHubHome)).observe(appRoot, { childList: true });
document.addEventListener("DOMContentLoaded", renderHubHome);
queueMicrotask(renderHubHome);
