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

function applyColourLabels() {
  document.querySelectorAll(".player-colour-select").forEach((select) => {
    const selected = select.value;
    const selectedHex = COLOUR_HEX[selected];
    if (selectedHex) {
      select.style.color = selectedHex;
      select.style.webkitTextFillColor = selectedHex;
      select.style.fontWeight = "900";
      select.dataset.selectedColour = selected;
    }

    [...select.options].forEach((option) => {
      const hex = COLOUR_HEX[option.value];
      if (!hex) return;
      option.style.color = hex;
      option.style.webkitTextFillColor = hex;
      option.style.fontWeight = "800";
    });
  });
}

function queueApply() {
  if (queued) return;
  queued = true;
  queueMicrotask(() => {
    queued = false;
    applyColourLabels();
  });
}

const appRoot = document.getElementById("app");
if (appRoot) {
  new MutationObserver(queueApply).observe(appRoot, { childList: true, subtree: true });
  appRoot.addEventListener("change", (event) => {
    if (event.target.matches?.(".player-colour-select")) queueApply();
  });
}

document.addEventListener("DOMContentLoaded", queueApply);
queueApply();
