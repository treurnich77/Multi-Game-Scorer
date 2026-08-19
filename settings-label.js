function applySettingsLabels() {
  document.querySelectorAll('.app-nav button[data-action="data"]').forEach((button) => {
    if (button.dataset.settingsLabel === "true") return;
    button.innerHTML = '<span>⚙</span>Settings';
    button.dataset.settingsLabel = "true";
    button.setAttribute("aria-label", "Settings");
  });

  const activeDataNav = document.querySelector('.app-nav button[data-action="data"].active');
  if (!activeDataNav) return;

  const section = document.querySelector('main.shell > .section-block');
  if (!section) return;
  const eyebrow = section.querySelector('.section-heading-row .eyebrow');
  const heading = section.querySelector('.section-heading-row h2');
  if (eyebrow) eyebrow.textContent = "Preferences & data";
  if (heading) heading.textContent = "Settings";
}

let settingsLabelQueued = false;
const settingsLabelObserver = new MutationObserver(() => {
  if (settingsLabelQueued) return;
  settingsLabelQueued = true;
  queueMicrotask(() => {
    settingsLabelQueued = false;
    applySettingsLabels();
  });
});

settingsLabelObserver.observe(document.documentElement, { childList: true, subtree: true });
document.addEventListener("DOMContentLoaded", applySettingsLabels);
queueMicrotask(applySettingsLabels);
