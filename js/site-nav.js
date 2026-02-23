(function () {
  const basePathMeta = document.querySelector('meta[name="wys-base-path"]');
  const basePath = (basePathMeta && basePathMeta.content) || "/";

  const joinBase = (path) => {
    const base = basePath.endsWith("/") ? basePath.slice(0, -1) : basePath;
    const clean = path.startsWith("/") ? path : `/${path}`;
    return `${base}${clean}`;
  };

  const normalize = (value) =>
    String(value || "")
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  let searchIndex = [];

  async function loadSearchIndex() {
    try {
      const response = await fetch(joinBase("/search-index.json"), { credentials: "same-origin" });
      if (!response.ok) return;
      const data = await response.json();
      if (Array.isArray(data)) {
        searchIndex = data;
      }
    } catch (_) {
      searchIndex = [];
    }
  }

  function scoreMatch(item, query) {
    const title = normalize(item.title);
    const creator = normalize(item.creator);
    if (title === query) return 300;
    if (title.startsWith(query)) return 220;
    if (title.includes(query)) return 180;
    if (creator.startsWith(query)) return 140;
    if (creator.includes(query)) return 120;
    const combined = normalize(`${item.title} ${item.creator} ${item.type} ${item.verdict}`);
    if (combined.includes(query)) return 100;
    return 0;
  }

  function findMatches(query, limit) {
    const q = normalize(query);
    if (!q || q.length < 2 || searchIndex.length === 0) return [];
    return searchIndex
      .map((item) => ({ item, score: scoreMatch(item, q) }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score || String(a.item.title).localeCompare(String(b.item.title)))
      .slice(0, limit)
      .map((entry) => entry.item);
  }

  function renderResults(container, results) {
    container.innerHTML = "";
    if (!results.length) {
      container.hidden = true;
      return;
    }

    const fragment = document.createDocumentFragment();
    results.forEach((result) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "site-search-result";
      button.dataset.slug = result.slug;
      button.innerHTML = `
        <span class="site-search-result-title">${result.title}</span>
        <span class="site-search-result-meta">${result.type.toUpperCase()} • ${result.creator}</span>
      `;
      fragment.appendChild(button);
    });

    container.appendChild(fragment);
    container.hidden = false;
  }

  function initSearchForm(form) {
    const input = form.querySelector('input[name="q"]');
    const resultsContainer = form.querySelector("[data-search-results]");
    if (!input || !resultsContainer) return;

    input.addEventListener("input", () => {
      renderResults(resultsContainer, findMatches(input.value, 8));
    });

    input.addEventListener("focus", () => {
      if (input.value.trim().length >= 2) {
        renderResults(resultsContainer, findMatches(input.value, 8));
      }
    });

    resultsContainer.addEventListener("click", (event) => {
      const button = event.target.closest(".site-search-result");
      if (!button) return;
      const slug = button.dataset.slug;
      if (!slug) return;
      window.location.href = joinBase(`/reviews/${slug}/`);
    });

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const raw = input.value.trim();
      if (!raw) return;
      const q = normalize(raw);
      const exact = searchIndex.find((item) => normalize(item.title) === q);
      if (exact) {
        window.location.href = joinBase(`/reviews/${exact.slug}/`);
        return;
      }
      window.location.href = joinBase(`/reviews/?q=${encodeURIComponent(raw)}`);
    });
  }

  function initMobileHeaderToggles() {
    const searchToggle = document.getElementById("mobile-search-toggle");
    const menuToggle = document.getElementById("mobile-menu-toggle");
    const searchPanel = document.getElementById("mobile-search-panel");
    const mobileMenu = document.getElementById("mobile-menu");

    if (searchToggle && searchPanel) {
      searchToggle.addEventListener("click", () => {
        const next = !searchPanel.classList.contains("is-open");
        searchPanel.classList.toggle("is-open", next);
        searchPanel.hidden = !next;
        searchToggle.setAttribute("aria-expanded", String(next));
        if (next) {
          const input = searchPanel.querySelector('input[name="q"]');
          if (input) input.focus();
        }
      });
    }

    if (menuToggle && mobileMenu) {
      menuToggle.addEventListener("click", () => {
        const next = !mobileMenu.classList.contains("is-open");
        mobileMenu.classList.toggle("is-open", next);
        mobileMenu.hidden = !next;
        menuToggle.setAttribute("aria-expanded", String(next));
      });
    }
  }

  function initReviewsQueryFilter() {
    const list = Array.from(document.querySelectorAll(".searchable-review-card"));
    if (!list.length) return;

    const params = new URLSearchParams(window.location.search);
    const rawQ = (params.get("q") || "").trim();
    const feedback = document.getElementById("reviews-search-feedback");
    const summary = document.getElementById("reviews-summary");
    if (!rawQ) {
      if (feedback) feedback.hidden = true;
      return;
    }

    const q = normalize(rawQ);
    let visible = 0;

    list.forEach((card) => {
      const haystack = normalize(card.dataset.search || "");
      const isMatch = q
        .split(" ")
        .filter(Boolean)
        .every((token) => haystack.includes(token));

      card.style.display = isMatch ? "" : "none";
      if (isMatch) visible += 1;
    });

    if (summary) {
      summary.textContent = `${visible} result${visible === 1 ? "" : "s"} for "${rawQ}"`;
    }

    if (feedback) {
      feedback.hidden = false;
      feedback.textContent = visible === 0 ? "No matching reviews found. Try another keyword." : "";
    }
  }

  document.addEventListener("click", (event) => {
    document.querySelectorAll("[data-site-search]").forEach((form) => {
      if (form.contains(event.target)) return;
      const resultsContainer = form.querySelector("[data-search-results]");
      if (resultsContainer) resultsContainer.hidden = true;
    });
  });

  async function init() {
    await loadSearchIndex();
    document.querySelectorAll("[data-site-search]").forEach(initSearchForm);
    initMobileHeaderToggles();
    initReviewsQueryFilter();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
