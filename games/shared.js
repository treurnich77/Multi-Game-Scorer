export function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function signed(value) {
  return `${value >= 0 ? "+" : ""}${value}`;
}

export function numberOptions(max, selected, min = 0) {
  return Array.from({ length: max - min + 1 }, (_, index) => index + min)
    .map((value) => `<option value="${value}" ${Number(selected) === value ? "selected" : ""}>${value}</option>`)
    .join("");
}

export function actionButtons(g) {
  return `
    <div class="actions">
      <button class="primary" data-action="submit">Submit Hand</button>
      <button class="secondary" data-action="undo" ${g.history.length ? "" : "disabled"} title="Undo last hand">Undo</button>
      <button class="secondary" data-action="redo" ${g.undone.length ? "" : "disabled"} title="Redo hand">Redo</button>
      <button class="secondary" data-action="new-game">New Game</button>
    </div>
  `;
}
