// Installed in the head so Escape works before the deferred presentation loads.
(() => {
  const projectRoute = /\/(?:themis|dueform|actifact)\.html$/;
  const isProject = projectRoute.test(location.pathname);
  let returning = false;

  function previousPortfolioUrl() {
    try {
      const value =
        window.navigation?.activation?.from?.url ||
        sessionStorage.getItem("portfolio-previous-url") ||
        document.referrer;
      const url = value ? new URL(value) : null;
      return url?.origin === location.origin ? url : null;
    } catch {
      return null;
    }
  }

  function setReturnTransition() {
    const previous = previousPortfolioUrl();
    document.documentElement.classList.toggle(
      "project-return",
      Boolean(previous && projectRoute.test(previous.pathname) && !isProject),
    );
  }

  function focusPresentation() {
    if (
      isProject &&
      [document.body, document.documentElement].includes(document.activeElement)
    )
      document
        .querySelector(".presentation-shell")
        ?.focus({ preventScroll: true });
  }

  function returnToPreviousPage() {
    if (returning) return;
    returning = true;
    const previous = previousPortfolioUrl();
    if (
      previous &&
      /\/(?:index\.html|projects\.html|themis\.html|dueform\.html|actifact\.html)?$/.test(
        previous.pathname,
      ) &&
      history.length > 1
    )
      history.back();
    else location.assign("index.html#work");
  }

  setReturnTransition();
  window.addEventListener("pagereveal", (event) => {
    setReturnTransition();
    event.viewTransition?.finished
      .finally(() =>
        document.documentElement.classList.remove("project-return"),
      )
      .catch(() => {});
  });
  window.addEventListener("pagehide", () => {
    try {
      sessionStorage.setItem("portfolio-previous-url", location.href);
    } catch {
      /* Navigation also works without session storage. */
    }
  });
  window.addEventListener("pageshow", () => {
    returning = false;
    focusPresentation();
  });
  document.addEventListener("DOMContentLoaded", focusPresentation, {
    once: true,
  });

  if (!isProject) return;
  document.addEventListener("keydown", (event) => {
    if (
      event.key !== "Escape" ||
      event.defaultPrevented ||
      event.target.closest?.("input, textarea, select, [contenteditable]") ||
      document.querySelector('.menu-toggle[aria-expanded="true"]')
    )
      return;
    event.preventDefault();
    returnToPreviousPage();
  });
  document.addEventListener("click", (event) => {
    if (
      event.button !== 0 ||
      event.defaultPrevented ||
      window.getSelection()?.toString() ||
      event.target.closest?.(
        ".presentation-deck, .presentation-navigation, .presentation-hint, .site-header, .contact-section, a, button",
      )
    )
      return;
    returnToPreviousPage();
  });
})();
