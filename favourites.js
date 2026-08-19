const FAVOURITES_KEY = "multiGameScorer:favourites:v1";

function readFavourites() {
  try {
    const saved = JSON.parse(localStorage.getItem(FAVOURITES_KEY));
    return Array.isArray(saved) ? saved.filter((key) => typeof key === "string") : [];
  } catch {
    return [];
  }
}

function writeFavourites(favourites) {
  localStorage.setItem(FAVOURITES_KEY, JSON.stringify(favourites));
}

function applyStarState(wrapper, favourites) {
  const gameKey = wrapper.dataset.game;
  const active = favourites.includes(gameKey);
  const star = wrapper.querySelector(".favourite-toggle");
  wrapper.classList.toggle("is-favourite", active);
  if (!star) return;
  star.textContent = active ? "★" : "☆";
  star.setAttribute("aria-pressed", String(active));
  star.title = active ? "Remove from favourites" : "Add to favourites";
}

function updateFavouriteGrid(grid) {
  const favourites = readFavourites();
  const wrappers = [...grid.children].filter((node) => node.classList?.contains("favourite-game-wrap"));

  wrappers.forEach((wrapper) => applyStarState(wrapper, favourites));

  wrappers
    .sort((a, b) => {
      const aIndex = favourites.indexOf(a.dataset.game);
      const bIndex = favourites.indexOf(b.dataset.game);
      const aFavourite = aIndex >= 0;
      const bFavourite = bIndex >= 0;

      if (aFavourite && bFavourite) return aIndex - bIndex;
      if (aFavourite) return -1;
      if (bFavourite) return 1;
      return Number(a.dataset.originalOrder) - Number(b.dataset.originalOrder);
    })
    .forEach((wrapper) => grid.appendChild(wrapper));
}

function createStar(wrapper, gameKey, label) {
  const star = document.createElement("button");
  star.type = "button";
  star.className = "favourite-toggle";
  star.setAttribute("aria-label", `Favourite ${label}`);
  star.textContent = "☆";

  star.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    const favourites = readFavourites();
    const next = favourites.includes(gameKey)
      ? favourites.filter((key) => key !== gameKey)
      : [...favourites, gameKey];
    writeFavourites(next);
    updateFavouriteGrid(wrapper.closest(".game-grid"));
  });

  wrapper.appendChild(star);
  return star;
}

function enhanceFavouriteGames() {
  const grid = document.querySelector(".game-grid");
  if (!grid) return;

  const directTiles = [...grid.children].filter((node) => node.matches?.(".game-tile[data-game]"));
  directTiles.forEach((tile, index) => {
    const gameKey = tile.dataset.game;
    const wrapper = document.createElement("div");
    wrapper.className = "favourite-game-wrap";
    wrapper.dataset.game = gameKey;
    wrapper.dataset.originalOrder = String(index);
    grid.insertBefore(wrapper, tile);
    wrapper.appendChild(tile);
  });

  const wrappers = [...grid.children].filter((node) => node.classList?.contains("favourite-game-wrap"));
  wrappers.forEach((wrapper, index) => {
    if (!wrapper.dataset.originalOrder) wrapper.dataset.originalOrder = String(index);
    const tile = wrapper.querySelector(".game-tile[data-game]");
    if (!tile) return;
    const gameKey = tile.dataset.game;
    wrapper.dataset.game = gameKey;
    if (!wrapper.querySelector(".favourite-toggle")) {
      const label = tile.querySelector("strong")?.textContent?.trim() || "game";
      createStar(wrapper, gameKey, label);
    }
  });

  if (wrappers.length) updateFavouriteGrid(grid);
}

let favouriteRefreshQueued = false;
function queueFavouriteRefresh() {
  if (favouriteRefreshQueued) return;
  favouriteRefreshQueued = true;
  queueMicrotask(() => {
    favouriteRefreshQueued = false;
    enhanceFavouriteGames();
  });
}

const appRoot = document.getElementById("app");
if (appRoot) {
  new MutationObserver(queueFavouriteRefresh).observe(appRoot, { childList: true });
}

document.addEventListener("DOMContentLoaded", queueFavouriteRefresh);
queueFavouriteRefresh();
