function removeSetupNavigation() {
  const nav = document.querySelector(".setup-panel + .app-nav");
  if (nav) nav.remove();
}

const observer = new MutationObserver(() => queueMicrotask(removeSetupNavigation));
observer.observe(document.documentElement, { childList: true, subtree: true });

document.addEventListener("DOMContentLoaded", removeSetupNavigation);
queueMicrotask(removeSetupNavigation);
