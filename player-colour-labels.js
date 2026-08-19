const COLOUR_HEX = {
  emerald: "#16845d",
  blue: "#3277c7",
  violet: "#7a58bd",
  amber: "#b47716",
  rose: "#b84661",
  teal: "#167c82",
  slate: "#5e6b78",
  orange: "#c45d22",
  cyan: "#1b8fb8",
  indigo: "#4f5aad",
  lime: "#6f8f2a",
  pink: "#c45695",
  brown: "#7a523a",
  red: "#c23b31",
  navy: "#264a73",
  gold: "#aa8500"
};

let queued = false;

function closeAllMenus(except = null) {
  document.querySelectorAll(".custom-colour-picker.open").forEach((picker) => {
    if (picker === except) return;
    picker.classList.remove("open");
    picker.querySelector(".custom-colour-menu")?.setAttribute("hidden", "");
    picker.querySelector(".custom-colour-trigger")?.setAttribute("aria-expanded", "false");
  });
}

function selectedLabel(select) {
  return select.options[select.selectedIndex]?.textContent?.trim() || "Choose colour";
}

function makeControlNonLabel(select) {
  const label = select.closest("label.player-colour-control");
  if (!label) return select;

  const control = document.createElement("div");
  [...label.attributes].forEach((attribute) => control.setAttribute(attribute.name, attribute.value));
  while (label.firstChild) control.appendChild(label.firstChild);
  label.replaceWith(control);
  return control.querySelector(".player-colour-select") || select;
}

function paintName(name, hex) {
  name.style.color = hex;
  name.style.webkitTextFillColor = hex;
  name.style.fontWeight = "900";
}

function syncPlayerColour(select, color = select.value) {
  const playerId = select.closest(".player-colour-control")?.dataset.playerId;
  if (!playerId || !color) return;
  window.dispatchEvent(new CustomEvent("mgs:player-colour-change", {
    detail: { playerId, color }
  }));
}

function enhanceSelect(originalSelect) {
  if (originalSelect.dataset.customColourMenu === "true") return;

  const select = makeControlNonLabel(originalSelect);
  select.dataset.customColourMenu = "true";
  select.classList.add("native-colour-select");

  const picker = document.createElement("div");
  picker.className = "custom-colour-picker";

  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = "custom-colour-trigger";
  trigger.setAttribute("aria-haspopup", "listbox");
  trigger.setAttribute("aria-expanded", "false");

  const menu = document.createElement("div");
  menu.className = "custom-colour-menu";
  menu.setAttribute("role", "listbox");
  menu.setAttribute("hidden", "");

  function refreshTrigger() {
    const key = select.value;
    const hex = COLOUR_HEX[key] || "#666666";
    trigger.innerHTML = `<span class="colour-name">${selectedLabel(select)}</span><span class="custom-colour-chevron" aria-hidden="true">▾</span>`;
    paintName(trigger.querySelector(".colour-name"), hex);
    trigger.setAttribute("aria-label", `Player colour: ${selectedLabel(select)}`);
  }

  [...select.options].forEach((option) => {
    if (!option.value) return;
    const hex = COLOUR_HEX[option.value] || "#666666";
    const choice = document.createElement("button");
    choice.type = "button";
    choice.className = "custom-colour-option";
    choice.dataset.colourValue = option.value;
    choice.setAttribute("role", "option");
    choice.setAttribute("aria-selected", String(option.value === select.value));
    choice.innerHTML = `<span class="colour-name">${option.textContent}</span>`;
    paintName(choice.querySelector(".colour-name"), hex);

    choice.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (select.value === option.value) {
        closeAllMenus();
        return;
      }
      select.value = option.value;
      select.dispatchEvent(new Event("change", { bubbles: true }));
      syncPlayerColour(select, option.value);
      closeAllMenus();
    });
    menu.appendChild(choice);
  });

  trigger.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    const willOpen = !picker.classList.contains("open");
    closeAllMenus(picker);
    picker.classList.toggle("open", willOpen);
    trigger.setAttribute("aria-expanded", String(willOpen));
    if (willOpen) menu.removeAttribute("hidden");
    else menu.setAttribute("hidden", "");
  });

  refreshTrigger();
  picker.append(trigger, menu);
  select.insertAdjacentElement("afterend", picker);
  syncPlayerColour(select);
}

function applyCustomColourMenus() {
  document.querySelectorAll(".player-colour-select").forEach(enhanceSelect);
}

function queueApply() {
  if (queued) return;
  queued = true;
  queueMicrotask(() => {
    queued = false;
    applyCustomColourMenus();
  });
}

const appRoot = document.getElementById("app");
if (appRoot) {
  new MutationObserver(queueApply).observe(appRoot, { childList: true, subtree: true });
}

document.addEventListener("click", () => closeAllMenus());
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeAllMenus();
});
document.addEventListener("DOMContentLoaded", queueApply);
queueApply();
