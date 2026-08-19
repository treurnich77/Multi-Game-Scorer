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

function enhanceSelect(select) {
  if (select.dataset.customColourMenu === "true") return;
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
    const hex = COLOUR_HEX[key] || "currentColor";
    trigger.style.setProperty("--colour-choice", hex);
    trigger.innerHTML = `<span class="custom-colour-swatch" aria-hidden="true"></span><span class="colour-name">${selectedLabel(select)}</span><span class="custom-colour-chevron" aria-hidden="true">▾</span>`;
    trigger.setAttribute("aria-label", `Player colour: ${selectedLabel(select)}`);
  }

  [...select.options].forEach((option) => {
    if (!option.value) return;
    const hex = COLOUR_HEX[option.value] || "currentColor";
    const choice = document.createElement("button");
    choice.type = "button";
    choice.className = "custom-colour-option";
    choice.dataset.colourValue = option.value;
    choice.setAttribute("role", "option");
    choice.setAttribute("aria-selected", String(option.value === select.value));
    choice.style.setProperty("--colour-choice", hex);
    choice.innerHTML = `<span class="custom-colour-swatch" aria-hidden="true"></span><span class="colour-name">${option.textContent}</span>`;
    choice.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (select.value === option.value) {
        closeAllMenus();
        return;
      }
      select.value = option.value;
      select.dispatchEvent(new Event("change", { bubbles: true }));
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
