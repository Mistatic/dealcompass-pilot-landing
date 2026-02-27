(function () {
  function hashText(text) {
    let hash = 0;
    for (let i = 0; i < text.length; i += 1) {
      hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
    }
    return Math.abs(hash);
  }

  function tokenSet(text) {
    const stopWords = new Set([
      'a', 'an', 'and', 'as', 'at', 'be', 'for', 'from', 'in', 'into', 'is', 'it', 'its',
      'of', 'on', 'or', 'so', 'that', 'the', 'this', 'to', 'with', 'while'
    ]);
    return new Set(
      String(text || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(token => token && !stopWords.has(token))
    );
  }

  function jaccardSimilarity(a, b) {
    const aTokens = tokenSet(a);
    const bTokens = tokenSet(b);
    if (!aTokens.size && !bTokens.size) return 0;
    let intersection = 0;
    for (const token of aTokens) {
      if (bTokens.has(token)) intersection += 1;
    }
    const union = aTokens.size + bTokens.size - intersection;
    return union ? intersection / union : 0;
  }

  function openingBigram(text) {
    const tokens = String(text || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
    return tokens.slice(0, 2).join(' ');
  }

  function normalizeBlurbPattern(text) {
    return String(text || '')
      .toLowerCase()
      .replace(/ (anker|ugreen|amazon|logitech|asus|redragon|yunzii|dell|hp|lenovo|apple|samsung|ninja|shark|dyson|instant pot|keurig) /g, ' brand ')
      .replace(/ \d+[a-z0-9%-]* /g, ' # ')
      .replace(/[^a-z\s#]/g, ' ')
      .replace(/ (a|an|the|this|that|it|is|are|for|to|of|with|and|or|as|in|on|by|from|option|pick) /g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function maxSimilarity(candidate, priorBlurbs) {
    let max = 0;
    for (const prior of priorBlurbs) {
      max = Math.max(max, jaccardSimilarity(candidate, prior));
    }
    return max;
  }

  // Helper to make "Space option" less robotic.
  // If brand is "Space" or suspicious, fallback to "This unit" or "It".
  function fillTemplate(template, brand, type) {
    let brandLabel = brand || 'This';
    let brandOption = brand ? `${brand} option` : 'this choice';
    
    // Fix: "Space option" -> "This heater"
    if (!brand || brand.toLowerCase() === 'space' || brand.toLowerCase() === 'generic') {
      brandLabel = 'This';
      brandOption = `this ${type || 'unit'}`;
    }

    const typeLabel = type || 'pick';
    return template
      .replaceAll('{brand}', brandLabel)
      .replaceAll('{brandOption}', brandOption)
      .replaceAll('{type}', typeLabel)
      .replace(/\s+/g, ' ')
      .trim();
  }

  function extractBrand(title) {
    const brands = [
      ['logitech', 'Logitech'], ['ugreen', 'UGREEN'], ['anker', 'Anker'], ['asus', 'ASUS'],
      ['redragon', 'Redragon'], ['yunzii', 'YUNZII'], ['vicsoon', 'Vicsoon'], ['amazon', 'Amazon'],
      ['fire', 'Amazon'], ['samsung', 'Samsung'], ['apple', 'Apple'], ['lenovo', 'Lenovo'],
      ['dell', 'Dell'], ['hp', 'HP'], ['ninja', 'Ninja'], ['shark', 'Shark'], ['dyson', 'Dyson'],
      ['instant pot', 'Instant Pot'], ['keurig', 'Keurig'], ['irobot', 'iRobot'], ['roborock', 'Roborock'],
      ['eufy', 'eufy'], ['wyze', 'Wyze'], ['ring', 'Ring'], ['blink', 'Blink'], ['tp-link', 'TP-Link'],
      ['coway', 'Coway'], ['honeywell', 'Honeywell'], ['levoit', 'Levoit'], ['breville', 'Breville'],
      ['vitamix', 'Vitamix'], ['kitchenaid', 'KitchenAid']
    ];
    const t = String(title || '').toLowerCase();
    for (const [needle, label] of brands) {
      if (t.includes(needle)) return label;
    }
    const first = String(title || '').match(/^\s*([A-Za-z0-9][A-Za-z0-9+\-]{1,})/);
    return first ? first[1] : '';
  }

  function detectProductCategory(title) {
    const t = String(title || '').toLowerCase();
    
    // Tech
    if (t.includes('trackball')) return 'trackball';
    if ((t.includes('keyboard') && t.includes('mouse')) || t.includes('combo')) return 'combo';
    if (t.includes('keyboard')) return 'keyboard';
    if (t.includes('mouse')) return 'mouse';
    if (t.includes('hub') || t.includes('dock') || t.includes('multiport')) return 'hub';
    if (t.includes('tablet') || t.includes('ipad') || t.includes('fire hd') || t.includes('galaxy tab')) return 'tablet';
    if (t.includes('monitor arm') || (t.includes('monitor') && t.includes('arm')) || t.includes('vesa')) return 'monitorArm';
    if (t.includes('router') || t.includes('wifi 6e') || t.includes('tri-band') || t.includes('mesh')) return 'router';
    if (t.includes('ethernet switch') || (t.includes('switch') && t.includes('gigabit'))) return 'networkSwitch';
    if (t.includes('cooling pad') || t.includes('laptop cooler')) return 'coolingPad';
    if (t.includes('privacy screen') || (t.includes('privacy') && t.includes('screen'))) return 'privacyScreen';
    if (t.includes('charger') || (t.includes('charging') && !t.includes('wireless')) || t.includes('power adapter') || /\bpd\b/.test(t)) return 'charger';

    // Home - Kitchen
    if (t.includes('air fryer') || t.includes('fryer')) return 'airFryer';
    if (t.includes('coffee') || t.includes('espresso') || t.includes('keurig')) return 'coffeeMaker';
    if (t.includes('blender') || t.includes('smoothie')) return 'blender';
    if (t.includes('toaster') || t.includes('oven')) return 'toasterOven';
    if (t.includes('cookware') || t.includes('pan') || t.includes('skillet') || t.includes('pot')) return 'cookware';
    
    // Home - Cleaning
    if (t.includes('robot vacuum') || (t.includes('robot') && t.includes('vacuum')) || t.includes('roborock')) return 'robotVacuum';
    if (t.includes('vacuum') && !t.includes('robot')) return 'vacuum';
    if (t.includes('mop') || t.includes('steam cleaner')) return 'mop';
    
    // Home - Comfort/Environment
    if (t.includes('air purifier') || t.includes('purifier')) return 'airPurifier';
    if (t.includes('heater') || t.includes('heating')) return 'heater';
    if (t.includes('fan') && !t.includes('laptop')) return 'fan';
    if (t.includes('humidifier') || t.includes('dehumidifier')) return 'humidifier';
    if (t.includes('desk lamp') || /\blamp\b/.test(t) || t.includes('light bar')) return 'deskLamp';
    
    // Home - Organization/Storage
    if (t.includes('shelf') || t.includes('shelving') || t.includes('rack')) return 'shelving';
    if (t.includes('organizer') || t.includes('storage') || t.includes('bin')) return 'organizer';
    
    // Tools/DIY
    if (t.includes('drill') || t.includes('driver')) return 'powerTool';
    if (t.includes('screwdriver') || t.includes('wrench') || t.includes('tool set')) return 'handTool';

    return 'general';
  }

  function detectTitleSignals(title) {
    const t = String(title || '').toLowerCase();
    const featurePatterns = [
      // Tech
      ['wireless', /\bwireless\b|2\.4ghz|lightspeed/],
      ['wired', /\bwired\b/],
      ['bluetooth', /\bbluetooth\b/],
      ['ergonomic', /\bergonomic\b|vertical|comfort/],
      ['gaming', /\bgaming\b|esports|fps/],
      ['mmo', /\bmmo\b|side buttons|macro/],
      ['mechanical', /\bmechanical\b|linear switch|tactile switch/],
      ['rgb', /\brgb\b|led/],
      ['compact', /\bcompact\b|mini|\b75%\b|\b60%\b|small/],
      ['lightweight', /\blightweight\b|\b\d{2}g\b|\b\d{1,2}g\b/],
      ['trackball', /\btrackball\b/],
      ['aluminum', /\baluminum\b|alloy|cnc/],
      ['hot-swappable', /\bhot\s*swappable\b|hot-swap/],
      ['4k', /\b4k\b|\b60hz\b/],
      ['hdmi', /\bhdmi\b/],
      ['ethernet', /\bethernet\b|1gbps|\brj45\b/],
      ['100w', /\b100w\b|\b140w\b|\b65w\b|power delivery|\bpd\b/],
      ['usb-c', /\busb[\s-]?c\b|type-c|multiport|hub|dock/],
      ['dimmable', /\bdimmable\b|brightness|color modes|color temperature/],
      ['charger', /\bcharger\b|charging|power adapter|qi|magnetic charge/],
      
      // Home
      ['hepa', /\bhepa\b|filtration/],
      ['programmable', /\bprogrammable\b|timer|schedule/],
      ['cordless', /\bcordless\b|battery/],
      ['non-stick', /\bnon-stick\b|ceramic|coating/],
      ['stainless', /\bstainless steel\b/],
      ['waterproof', /\bwaterproof\b|water resistant/],
      ['smart', /\bsmart\b|app control|alexa|google assistant/],
      ['quiet', /\bquiet\b|silent|low noise/],
      ['capacity', /\bcapacity\b|large|qt|quart|liter/],
      ['adjustable', /\badjustable\b|height|angle|tilt|swivel/],
      ['fast-heat', /\b2s|fast heat|quick heat|instant/],
      ['oscillation', /\boscillation\b|70°|rotatable/]
    ];

    const features = featurePatterns
      .filter(([, pattern]) => pattern.test(t))
      .map(([name]) => name);

    let intendedUse = 'general';
    // Tech uses
    if (/\bgaming\b|mmo|fps|rgb|hero sensor/.test(t)) intendedUse = 'gaming';
    else if (/office|home office|productivity|ergonomic|keyboard|mouse|desk/.test(t)) intendedUse = 'office';
    else if (/portable|travel|mobile|mini|compact|tablet|wireless/.test(t)) intendedUse = 'mobile';
    
    // Home uses - reordered to catch comfort/cooking before generic organizing
    else if (/kitchen|cooking|meal|bake|fry/.test(t)) intendedUse = 'cooking';
    else if (/comfort|warm|cool|air|sleep|heater|fan/.test(t)) intendedUse = 'comfort';
    else if (/clean|vacuum|mop|dust|wash/.test(t)) intendedUse = 'cleaning';
    
    // Make organize stricter to avoid "Space Heater" matching "space"
    else if (/organize|storage|declutter|shelf|shelving|bin|rack/.test(t)) intendedUse = 'organizing';

    const suspiciousSource = /ebay|refurbished|renewed|used|open box|pre-?owned/.test(t);
    return { features, intendedUse, suspiciousSource };
  }

  function classifyUseCase(text, category = 'tech') {
    const t = String(text || '').toLowerCase();
    if (category === 'home') {
      if (t.includes('vacuum') || t.includes('robot') || t.includes('clean')) return 'Best for Cleaning';
      if (t.includes('air purifier') || t.includes('humidifier') || t.includes('dehumidifier')) return 'Best for Air Quality';
      if (t.includes('heater') || t.includes('fan') || t.includes('comfort')) return 'Best for Comfort';
      if (t.includes('storage') || t.includes('organizer') || t.includes('shelf')) return 'Best for Organization';
      if (t.includes('kitchen') || t.includes('cook') || t.includes('fryer')) return 'Best for Kitchen';
      return 'Best for Home Essentials';
    }
    // Tech
    if (t.includes('gaming') || t.includes('controller')) return 'Best for Gaming';
    if (t.includes('keyboard') || t.includes('mouse')) return 'Best for Everyday Use';
    if (t.includes('hub') || t.includes('dock') || t.includes('usb-c')) return 'Best for Laptop Setups';
    return 'Best for Tech Upgrades';
  }

  function generateBlurb(title, opts) {
    const diversityState = (opts && opts.state) || {
      blurbs: [],
      patterns: [],
      usedRoleTemplates: new Set(),
      usedRoleLines: new Set(),
      usedPrimaryClauses: new Set(),
      usedAnglesByCategory: { hub: new Set() },
      lastOpeningBigram: ''
    };
    
    const brand = extractBrand(title);
    const productCategory = detectProductCategory(title);
    const { features, intendedUse, suspiciousSource } = detectTitleSignals(title);
    const seed = hashText(title);

    // Natural Language Update: Removed passive "As a [X]..." and "Buyer takeaway:" labels.
    // Focus on direct benefits and active verbs.
    const roleTemplatesByCategory = {
      // Tech
      trackball: [
        'Precise cursor control with less wrist movement.',
        'Steady control for long sessions without the arm fatigue.'
      ],
      combo: [
        'A simple way to standardize your desk input.',
        'Reduces setup friction for daily mixed-use work.'
      ],
      keyboard: [
        'Consistent typing feel for long writing blocks.',
        'Stable key response for daily desk work.'
      ],
      mouse: [
        'Reliable tracking for daily tasks, no extra fluff.',
        'Controlled movement for standard desk work.'
      ],
      hub: [
        'Centralizes connections to clean up your workspace.',
        'One cable to rule your monitor and accessories.'
      ],
      tablet: [
        'Good for reading and notes away from the main desk.',
        'Flexible screen for travel or secondary tasks.'
      ],
      monitorArm: [
        'Clears up desk space and fixes screen height.',
        'Better ergonomics for long viewing sessions.'
      ],
      charger: [
        'Streamlines power for your phone and accessories.',
        'Keeps daily gear charged with less adapter clutter.'
      ],
      
      // Home - Kitchen
      airFryer: [
        'Speeds up meal prep with faster, crisper heating.',
        'Great for quick sides and reheating without the big oven.'
      ],
      coffeeMaker: [
        'Consistent brewing for a streamlined morning routine.',
        'Reliable daily operation for your caffeine fix.'
      ],
      blender: [
        'Smooth blending for daily shakes and prep.',
        'Reliable power for routine kitchen blending.'
      ],
      toasterOven: [
        'Handles small baking tasks without heating the whole kitchen.',
        'Convenient for quick reheating and small meals.'
      ],
      cookware: [
        'Consistent heat distribution for everyday cooking.',
        'Durable build for daily meal prep.'
      ],
      
      // Home - Cleaning
      robotVacuum: [
        'Automates floor upkeep so you clean less often.',
        'Maintains baseline cleanliness between deep cleans.'
      ],
      vacuum: [
        'Strong suction for efficient weekly cleanup.',
        'Reliable power for handling routine messes.'
      ],
      mop: [
        'Speeds up hard floor cleaning with less effort.',
        'Makes washing high-traffic areas faster.'
      ],
      
      // Home - Comfort
      airPurifier: [
        'Reduces dust and allergens for better room air quality.',
        'Helps keep air cleaner in stuffy rooms or offices.'
      ],
      heater: [
        'Provides fast, localized warmth for drafty rooms.',
        'Takes the chill off cold corners quickly.'
      ],
      fan: [
        'Improves airflow to keep stuffy rooms comfortable.',
        'Consistent air circulation for daily comfort.'
      ],
      humidifier: [
        'Stabilizes moisture levels for better breathing comfort.',
        'Helps reduce dryness in climate-controlled rooms.'
      ],
      deskLamp: [
        'Better visibility for reading and work focus.',
        'Adjustable light to reduce eye strain.'
      ],
      
      // Home - Organization
      shelving: [
        'Maximizes vertical storage in cluttered spots.',
        'Sturdy storage to keep essentials accessible.'
      ],
      organizer: [
        'Keeps small items sorted and easy to find.',
        'Declutters busy drawers or shelves effectively.'
      ],
      
      // Generic Fallback
      general: [
        'A practical pick for reliable daily use.',
        'Improves routine consistency without complexity.',
        'Focuses on functional value for regular tasks.'
      ]
    };

    const featureClauses = {
      // Tech
      wireless: ['Wireless freedom keeps your desk looking cleaner', 'No cables to snag or clutter the workspace'],
      wired: ['Wired connection means no battery anxiety', 'Stable performance without charging breaks'],
      bluetooth: ['Bluetooth makes switching devices easy', 'Pairs quickly without needing a dongle'],
      ergonomic: ['Ergonomic shape reduces strain over time', 'Designed to keep fatigue low during long blocks'],
      compact: ['Compact size fits tight spaces easily', 'Small footprint saves valuable surface area'],
      lightweight: ['Lightweight build is easier to handle', 'Low weight reduces fatigue during use'],
      'usb-c': ['Modern USB-C connectivity', 'USB-C simplifies your cable situation'],
      
      // Home - General
      hepa: ['HEPA filtration captures fine dust effectively', 'HEPA standard ensures cleaner output air'],
      programmable: ['Programmable timer automates the routine', 'Set the schedule and forget it'],
      cordless: ['Cordless design lets you move freely', 'Battery power means no outlet hunting'],
      'non-stick': ['Non-stick surface makes cleanup simple', 'Easy-release coating saves scrubbing time'],
      stainless: ['Stainless build adds daily durability', 'Metal construction resists wear better'],
      waterproof: ['Waterproof design handles splashes easily', 'Safe for use in wet environments'],
      smart: ['App control lets you monitor it remotely', 'Smart features add convenient voice control'],
      quiet: ['Quiet operation won\'t disturb the house', 'Low noise level is great for work hours'],
      capacity: ['Large capacity means fewer refills', 'Big tank handles larger jobs easily'],
      adjustable: ['Adjustable settings tune it to your needs', 'Customizable fit for better performance'],
      'fast-heat': ['Heats up in seconds for instant effect', 'Quick heat-up time reduces waiting'],
      oscillation: ['Oscillation spreads coverage evenly', 'Rotates to cover more of the room']
    };

    const intendedUseClauses = {
      // Tech
      gaming: ['Best when responsiveness matters most', 'Matches well with gaming setups'],
      office: ['Fits perfectly in a steady office workflow', 'Ideal for practical, low-friction work'],
      mobile: ['Great for mobile setups that move around', 'Suits portable workflows well'],
      
      // Home
      cooking: ['Streamlines daily meal preparation', 'Consistent results for home cooking'],
      cleaning: ['Keeps floors tidy with less effort', 'Efficient for routine home cleanup'],
      organizing: ['Declutters busy storage areas', 'Makes items easier to grab and go'],
      comfort: ['Stabilizes room temperature and quality', 'Great for maintaining a comfortable room'],
      
      // General
      general: ['Practical for routine tasks', 'Works well in mixed-use setups']
    };

    const categoryReserveClauses = {
      // Home
      airFryer: ['Cooks crispy sides with less oil', 'Great for quick snacks'],
      coffeeMaker: ['Delivers a consistent daily cup', 'Simple operation for every morning'],
      robotVacuum: ['Keeps baseline cleanliness up automatically', 'Saves you from daily sweeping'],
      airPurifier: ['Reduces airborne irritants steadily', 'Good for bedrooms or offices'],
      shelving: ['Adds vertical storage footprint', 'Good for garages or pantries'],
      
      // Fallback
      general: ['Solid utility for the price', 'Reliable performance day-to-day']
    };

    const roleTemplates = roleTemplatesByCategory[productCategory] || roleTemplatesByCategory.general;
    
    // Collect candidate clauses
    const allCandidateClauses = [];
    features.forEach((feature) => {
      const variants = featureClauses[feature];
      if (variants) allCandidateClauses.push(...variants);
    });
    
    // Add reserve clauses if we don't have enough features
    const reserve = categoryReserveClauses[productCategory] || categoryReserveClauses.general;
    if (allCandidateClauses.length < 2) {
      allCandidateClauses.push(...reserve);
    }
    
    // Always add intended use as an option
    const use = intendedUseClauses[intendedUse] || intendedUseClauses.general;
    allCandidateClauses.push(...use);

    let bestCandidate = '';
    let bestPenalty = Number.POSITIVE_INFINITY;
    let bestMeta = { roleTemplate: '', primaryClause: '', pattern: '' };

    for (let attempt = 0; attempt < 16; attempt += 1) {
      // Natural connectors; avoid robotic labels.
      const connectors = ['', 'Also', 'Plus', 'Bonus', ''];
      const connector = connectors[(seed + attempt) % connectors.length];
      const priorBlurbs = diversityState.blurbs;
      const adjacentBlurb = priorBlurbs[priorBlurbs.length - 1] || '';

      let roleTemplate = roleTemplates[(seed + attempt) % roleTemplates.length];
      const roleKeyBase = `${productCategory}|${roleTemplate}`;
      
      // Diversity check for role template
      if (diversityState.usedRoleTemplates.has(roleKeyBase)) {
        for (let shift = 1; shift < roleTemplates.length; shift += 1) {
          const altTemplate = roleTemplates[(seed + attempt + shift) % roleTemplates.length];
          const altKey = `${productCategory}|${altTemplate}`;
          if (!diversityState.usedRoleTemplates.has(altKey)) {
            roleTemplate = altTemplate;
            break;
          }
        }
      }
      const role = fillTemplate(roleTemplate, brand, productCategory);
      const roleLine = role.toLowerCase().replace(/\b(anker|ugreen|amazon|logitech|asus|ninja|shark|dyson)\b/g, 'brand');

      let primaryClause = allCandidateClauses[(seed + attempt) % allCandidateClauses.length];
      let secondaryClause = allCandidateClauses[(seed + attempt + 3) % allCandidateClauses.length];

      // Guard: avoid reusing same primary clause recently
      const recentBlurbs = priorBlurbs.slice(-3).join(' ').toLowerCase();
      if (recentBlurbs.includes(primaryClause.toLowerCase())) {
        for (let shift = 1; shift < allCandidateClauses.length; shift += 1) {
          const alt = allCandidateClauses[(seed + attempt + shift) % allCandidateClauses.length];
          if (alt && !recentBlurbs.includes(alt.toLowerCase())) {
            primaryClause = alt;
            break;
          }
        }
      }
      
      if (secondaryClause && secondaryClause.toLowerCase() === primaryClause.toLowerCase()) {
        secondaryClause = allCandidateClauses[(seed + attempt + 5) % allCandidateClauses.length];
      }

      // Construction: role sentence + optional connector clause.
      let candidate = `${role}`;
      if (!/[.!?]$/.test(candidate)) candidate += '.';

      if (primaryClause) {
        const clause = primaryClause.charAt(0).toUpperCase() + primaryClause.slice(1);
        if (connector) {
          candidate += ` ${connector}: ${clause}`;
        } else {
          candidate += ` ${clause}`;
        }
        if (!/[.!?]$/.test(candidate)) candidate += '.';
      }

      candidate = candidate.replace(/\s+/g, ' ').trim();

      if (suspiciousSource) {
        const caveats = [
          'Verify condition and warranty.',
          'Confirm seller quality before purchase.'
        ];
        candidate += ` ${caveats[(seed + attempt) % caveats.length]}`;
      }

      // Length adjustment
      if (candidate.length > 160) {
        // Strip secondary or truncate nicely
        candidate = candidate.slice(0, 160).trim();
        if (!/[.!?]$/.test(candidate)) candidate += '.';
      }

      const candidateBigram = openingBigram(candidate);
      const adjacentBigram = diversityState.lastOpeningBigram || '';
      const pairwise = maxSimilarity(candidate, priorBlurbs);
      const adjacent = adjacentBlurb ? jaccardSimilarity(candidate, adjacentBlurb) : 0;
      const candidatePattern = normalizeBlurbPattern(candidate);
      const patternSimilarity = maxSimilarity(candidatePattern, diversityState.patterns || []);
      
      // Penalties
      const lengthPenalty = candidate.length < 60 ? (60 - candidate.length) : (candidate.length > 160 ? (candidate.length - 160) : 0);
      const roleReusePenalty = diversityState.usedRoleLines.has(roleLine) ? 120 : 0;
      const penalty =
        lengthPenalty +
        roleReusePenalty +
        (candidateBigram && candidateBigram === adjacentBigram ? 35 : 0) +
        Math.max(0, pairwise - 0.50) * 160 +
        Math.max(0, adjacent - 0.40) * 170 +
        Math.max(0, patternSimilarity - 0.46) * 220;

      if (penalty < bestPenalty) {
        bestPenalty = penalty;
        bestCandidate = candidate;
        bestMeta = {
          roleTemplate,
          primaryClause,
          pattern: candidatePattern
        };
      }

      // If acceptable, take it immediately to diversify
      if (penalty < 50 && attempt > 0) break;
    }

    diversityState.blurbs.push(bestCandidate);
    diversityState.patterns.push(bestMeta.pattern || normalizeBlurbPattern(bestCandidate));
    if (bestMeta.roleTemplate) {
      diversityState.usedRoleTemplates.add(`${productCategory}|${bestMeta.roleTemplate}`);
      diversityState.usedRoleLines.add(fillTemplate(bestMeta.roleTemplate, brand, productCategory).toLowerCase());
    }
    if (bestMeta.primaryClause) diversityState.usedPrimaryClauses.add(bestMeta.primaryClause.toLowerCase());
    diversityState.lastOpeningBigram = openingBigram(bestCandidate);
    
    return bestCandidate;
  }

  window.DCBlurbEngine = { generateBlurb, classifyUseCase };
})();
