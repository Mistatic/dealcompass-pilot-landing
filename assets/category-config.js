(function () {
  const DEFAULT_CATEGORIES = {
    tech: {
      label: 'Tech',
      heroSub: 'DealCompass finds high-value tech deals and explains exactly why they’re worth it—fast, clear, and practical.'
    },
    home: {
      label: 'Home',
      heroSub: 'DealCompass finds high-value home deals with clear buy/no-buy context and practical fit guidance.'
    }
  };

  const raw = (window.DEALCOMPASS_CATEGORY_CONFIG && typeof window.DEALCOMPASS_CATEGORY_CONFIG === 'object')
    ? window.DEALCOMPASS_CATEGORY_CONFIG
    : DEFAULT_CATEGORIES;

  const cleanSlug = (slug) => String(slug || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]/g, '');

  const categories = {};
  Object.entries(raw).forEach(([slug, cfg]) => {
    const key = cleanSlug(slug);
    if (!key) return;
    categories[key] = {
      label: String(cfg?.label || key).trim() || key,
      heroSub: String(cfg?.heroSub || '').trim()
    };
  });

  // Safety fallback
  if (!Object.keys(categories).length) {
    categories.tech = DEFAULT_CATEGORIES.tech;
  }

  const defaultSlug = Object.keys(categories)[0];

  function isKnown(slug) {
    return !!categories[cleanSlug(slug)];
  }

  function getSelectedCategory(search) {
    const rawSlug = new URLSearchParams(search || window.location.search).get('category') || defaultSlug;
    const slug = cleanSlug(rawSlug);
    return isKnown(slug) ? slug : defaultSlug;
  }

  function withCategory(url, category) {
    const u = new URL(url, window.location.origin);
    const selected = isKnown(category) ? cleanSlug(category) : defaultSlug;
    u.searchParams.set('category', selected);
    return `${u.pathname}${u.search}`;
  }

  function applyOptions(selectEl, selected) {
    if (!selectEl) return;
    selectEl.innerHTML = Object.entries(categories)
      .map(([slug, cfg]) => `<option value="${slug}">${cfg.label}</option>`)
      .join('');
    selectEl.value = isKnown(selected) ? selected : defaultSlug;
  }

  window.DCCategoryConfig = {
    categories,
    defaultSlug,
    isKnown,
    getSelectedCategory,
    withCategory,
    applyOptions
  };
})();
