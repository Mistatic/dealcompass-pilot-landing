(function () {
  function hashText(text) {
    let hash = 0;
    for (let i = 0; i < text.length; i += 1) hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
    return Math.abs(hash);
  }

  function tokenSet(text) {
    return new Set(String(text || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean));
  }

  function jaccard(a, b) {
    const A = tokenSet(a); const B = tokenSet(b);
    if (!A.size && !B.size) return 0;
    let inter = 0;
    A.forEach((t) => { if (B.has(t)) inter += 1; });
    return inter / (A.size + B.size - inter || 1);
  }

  function extractSignals(text) {
    const t = String(text || '').toLowerCase();
    const flags = {
      hepa: /\bhepa\b/.test(t),
      vacuum: /vacuum|robot vacuum|mop/.test(t),
      purifier: /air purifier|humidifier|dehumidifier/.test(t),
      storage: /storage|organizer|shelf|bins/.test(t),
      heatCool: /heater|fan|cooling/.test(t),
      keyboard: /keyboard|mechanical/.test(t),
      mouse: /\bmouse\b|trackball/.test(t),
      hub: /hub|dock|usb-c|multiport/.test(t),
      gaming: /gaming|controller|mmo|fps/.test(t),
      wireless: /wireless|bluetooth|2\.4ghz/.test(t),
      ergonomic: /ergonomic|vertical|posture|comfort/.test(t)
    };
    const numerics = t.match(/\b\d+(?:[\.,]\d+)?\s?(?:sq\.?\s?ft|w|oz|cup|pack|pa|mah|db|"|in|ft²|%|x)\b/g) || [];
    return { flags, numerics: numerics.slice(0, 2) };
  }

  const OPENERS = {
    tech: [
      '{brand} is a practical pick for daily desk reliability.',
      '{brand} stands out for consistent day-to-day performance.',
      '{brand} makes sense when you want fewer setup headaches.'
    ],
    home: [
      '{brand} is a solid home pick when you want less daily hassle.',
      '{brand} stands out for making everyday home routines easier.',
      '{brand} fits best if you want dependable results without babysitting.'
    ],
    default: ['{brand} is a practical pick for real day-to-day use.']
  };

  function firstWord(title) {
    const m = String(title || '').trim().match(/^([A-Za-z0-9][A-Za-z0-9+\-]{1,})/);
    return m ? m[1] : 'This pick';
  }

  function classifyUseCase(text, category) {
    const { flags } = extractSignals(text);
    if (category === 'home') {
      if (flags.vacuum) return 'Best for Cleaning';
      if (flags.purifier) return 'Best for Air Quality';
      if (flags.storage) return 'Best for Organization';
      if (flags.heatCool) return 'Best for Comfort';
      return 'Best for Home Essentials';
    }
    if (flags.gaming) return 'Best for Gaming';
    if (flags.keyboard || flags.mouse) return 'Best for Everyday Use';
    if (flags.hub) return 'Best for Laptop Setups';
    return 'Best for Tech Upgrades';
  }

  function rationale(signals, category) {
    const f = signals.flags;
    const bits = [];
    if (signals.numerics.length) bits.push(`Key spec: ${signals.numerics.join(' / ')}.`);
    if (category === 'home') {
      if (f.vacuum) bits.push('Why it was picked: it can save real cleanup time each week while keeping floors under control.');
      else if (f.purifier) bits.push('Why it was picked: cleaner, more stable air quality tends to matter more than extra bells and whistles.');
      else if (f.storage) bits.push('Why it was picked: better organization lowers day-to-day friction and helps rooms stay usable.');
      else if (f.heatCool) bits.push('Why it was picked: steadier room comfort makes long work or family blocks easier to get through.');
      else bits.push('Why it was picked: it solves a common home pain point in a practical, repeatable way.');
    } else {
      if (f.keyboard) bits.push('Why it was picked: it improves typing consistency and lowers daily input friction.');
      else if (f.mouse) bits.push('Why it was picked: it favors control and comfort over unnecessary complexity.');
      else if (f.hub) bits.push('Why it was picked: it consolidates connectivity and removes adapter/cable chaos.');
      else bits.push('Why it was picked: it adds reliable utility where most setups actually need it.');
    }
    if (f.wireless) bits.push('Wireless support makes placement easier and cuts cable clutter.');
    if (f.ergonomic) bits.push('Ergonomic design helps reduce fatigue during longer daily use.');
    return bits.slice(0, 3).join(' ');
  }

  function generateBlurb(title, opts) {
    const category = (opts && opts.category) || 'tech';
    const signalText = (opts && opts.signalText) || title;
    const state = (opts && opts.state) || { blurbs: [], openingSet: new Set() };
    if (!Array.isArray(state.blurbs)) state.blurbs = [];
    if (!(state.openingSet instanceof Set)) state.openingSet = new Set();
    const signals = extractSignals(`${title} ${signalText}`);
    const brand = firstWord(title);
    const openerPool = OPENERS[category] || OPENERS.default;

    let best = '';
    let bestScore = Infinity;

    for (let i = 0; i < openerPool.length; i += 1) {
      const opener = openerPool[(hashText(title) + i) % openerPool.length].replace('{brand}', brand);
      const candidate = `${opener} ${rationale(signals, category)}`.replace(/\s+/g, ' ').trim();
      const openKey = candidate.split('.').slice(0, 1).join('.').toLowerCase();
      const sim = state.blurbs.reduce((m, b) => Math.max(m, jaccard(candidate, b)), 0);
      const repeatOpenPenalty = state.openingSet.has(openKey) ? 0.25 : 0;
      const score = sim + repeatOpenPenalty;
      if (score < bestScore) { bestScore = score; best = candidate; }
      if (sim < 0.58 && !state.openingSet.has(openKey)) {
        state.blurbs.push(candidate);
        state.openingSet.add(openKey);
        return candidate;
      }
    }

    const openKey = best.split('.').slice(0, 1).join('.').toLowerCase();
    state.blurbs.push(best);
    state.openingSet.add(openKey);
    return best;
  }

  window.DCBlurbEngine = { generateBlurb, classifyUseCase };
})();
