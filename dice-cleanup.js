(() => {
  const STYLE_ID = "five-dice-no-number-badge";

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = ".die-value{display:none!important;visibility:hidden!important;pointer-events:none!important}";
    document.head.appendChild(style);
  }

  ensureStyle();
  document.addEventListener("DOMContentLoaded", ensureStyle);
})();
