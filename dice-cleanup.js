(() => {
  const STYLE_ID = "five-dice-no-number-badge";

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = ".die-value{display:none!important}";
    document.head.appendChild(style);
  }

  function removeBadges() {
    document.querySelectorAll(".die-value").forEach((node) => node.remove());
  }

  function refresh() {
    ensureStyle();
    removeBadges();
  }

  const app = document.getElementById("app");
  if (app) new MutationObserver(refresh).observe(app, { childList: true });
  document.addEventListener("DOMContentLoaded", refresh);
  refresh();
})();
