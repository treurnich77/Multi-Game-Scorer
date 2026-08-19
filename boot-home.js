(() => {
  const CORE_KEY = "multiGameScorer:v6";
  const SKIP_HOME_ONCE_KEY = "multiGameScorer:skipHomeOnce";

  try {
    if (sessionStorage.getItem(SKIP_HOME_ONCE_KEY) === "1") {
      sessionStorage.removeItem(SKIP_HOME_ONCE_KEY);
      return;
    }

    const raw = localStorage.getItem(CORE_KEY);
    if (!raw) return;
    const state = JSON.parse(raw);
    if (!state || typeof state !== "object") return;

    if (state.screen !== "home" || state.setup) {
      state.screen = "home";
      state.setup = null;
      state.notice = "";
      localStorage.setItem(CORE_KEY, JSON.stringify(state));
    }
  } catch {}
})();
