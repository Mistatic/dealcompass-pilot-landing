(function () {
  const DEFAULT_CATEGORIES = {
    tech: {
      label: 'Tech',
      heroSub: 'DealCompass finds high-value tech deals and explains exactly why they’re worth it—fast, clear, and practical.'
    },
    home: {
      label: 'Home',
      heroSub: 'DealCompass finds high-value home deals with clear buy/no-buy context and practical fit guidance.'
    },
    beauty: {
      label: 'Beauty',
      heroSub: 'DealCompass surfaces high-value beauty picks with practical fit notes, ingredient/form-factor context, and clear buy/no-buy guidance.'
    },
    fitness: {
      label: 'Fitness',
      heroSub: 'DealCompass filters fitness deals by real-world utility so you can pick reliable gear without wasting time on hype.'
    },
    automotive: {
      label: 'Automotive',
      heroSub: 'DealCompass highlights automotive essentials and upgrades with straightforward value checks and ownership-focused recommendations.'
    },
    outdoors: {
      label: 'Outdoors',
      heroSub: 'DealCompass finds practical outdoor gear deals and explains which picks actually hold up for frequent use.'
    },
    pet: {
      label: 'Pet',
      heroSub: 'DealCompass curates high-value pet products with comfort, durability, and day-to-day usability in focus.'
    },
    health: {
      label: 'Health',
      heroSub: 'DealCompass highlights practical health picks with clear utility notes and day-to-day fit guidance.'
    },
    tools: {
      label: 'Tools',
      heroSub: 'DealCompass surfaces dependable tools and home-improvement picks with straightforward value checks.'
    }
  };

  const CANONICAL_SLUGS = Object.keys(DEFAULT_CATEGORIES);
  const CATEGORY_ALIASES = {
    'health-household': 'health',
    'tools-home-improvement': 'tools'
  };

  const raw = (window.DEALCOMPASS_CATEGORY_CONFIG && typeof window.DEALCOMPASS_CATEGORY_CONFIG === 'object')
    ? window.DEALCOMPASS_CATEGORY_CONFIG
    : {};

  const cleanSlug = (slug) => String(slug || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]/g, '');

  const categories = {};
  CANONICAL_SLUGS.forEach((slug) => {
    const cfg = raw[slug] || DEFAULT_CATEGORIES[slug];
    categories[slug] = {
      label: String(cfg?.label || DEFAULT_CATEGORIES[slug].label).trim() || DEFAULT_CATEGORIES[slug].label,
      heroSub: String(cfg?.heroSub || DEFAULT_CATEGORIES[slug].heroSub || '').trim()
    };
  });

  const defaultSlug = categories.tech ? 'tech' : CANONICAL_SLUGS[0];

  function canonicalizeSlug(slug) {
    const cleaned = cleanSlug(slug);
    if (!cleaned) return '';
    return CATEGORY_ALIASES[cleaned] || cleaned;
  }

  function isKnown(slug) {
    return !!categories[canonicalizeSlug(slug)];
  }

  function getSelectedCategory(search) {
    const rawSlug = new URLSearchParams(search || window.location.search).get('category') || defaultSlug;
    const slug = canonicalizeSlug(rawSlug);
    return isKnown(slug) ? slug : defaultSlug;
  }

  function withCategory(url, category) {
    const u = new URL(url, window.location.origin);
    const selected = isKnown(category) ? canonicalizeSlug(category) : defaultSlug;
    u.searchParams.set('category', selected);
    return `${u.pathname}${u.search}`;
  }

  function applyOptions(selectEl, selected) {
    if (!selectEl) return;
    selectEl.innerHTML = Object.entries(categories)
      .map(([slug, cfg]) => `<option value="${slug}">${cfg.label}</option>`)
      .join('');
    selectEl.value = isKnown(selected) ? canonicalizeSlug(selected) : defaultSlug;
  }

  window.DCCategoryConfig = {
    categories,
    defaultSlug,
    isKnown,
    getSelectedCategory,
    withCategory,
    applyOptions,
    canonicalizeSlug
  };
})();
