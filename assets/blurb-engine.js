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

  function fillTemplate(template, brand, type) {
    const brandLabel = brand || 'This';
    const brandOption = brand ? `${brand} option` : 'this option';
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
      ['eufy', 'eufy'], ['wyze', 'Wyze'], ['ring', 'Ring'], ['blink', 'Blink'], ['tp-link', 'TP-Link']
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
      ['adjustable', /\badjustable\b|height|angle/]
    ];

    const features = featurePatterns
      .filter(([, pattern]) => pattern.test(t))
      .map(([name]) => name);

    let intendedUse = 'general';
    // Tech uses
    if (/\bgaming\b|mmo|fps|rgb|hero sensor/.test(t)) intendedUse = 'gaming';
    else if (/office|home office|productivity|ergonomic|keyboard|mouse|desk/.test(t)) intendedUse = 'office';
    else if (/portable|travel|mobile|mini|compact|tablet|wireless/.test(t)) intendedUse = 'mobile';
    
    // Home uses
    else if (/kitchen|cooking|meal|bake|fry/.test(t)) intendedUse = 'cooking';
    else if (/clean|vacuum|mop|dust|wash/.test(t)) intendedUse = 'cleaning';
    else if (/organize|storage|declutter|space/.test(t)) intendedUse = 'organizing';
    else if (/comfort|warm|cool|air|sleep/.test(t)) intendedUse = 'comfort';

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

    const roleTemplatesByCategory = {
      // Tech
      trackball: [
        '{brand} trackball is positioned for precise cursor work with reduced wrist travel',
        'As a trackball option, {brandOption} favors controlled navigation over fast sweeping motion'
      ],
      combo: [
        '{brand} combo is built to standardize input behavior across one desk',
        'As an input combo, {brandOption} reduces setup friction for daily routines'
      ],
      keyboard: [
        '{brand} keyboard is intended for consistent typing comfort in long writing blocks',
        'As a primary keyboard, {brandOption} focuses on stable input quality for daily desk use'
      ],
      mouse: [
        '{brand} mouse is aimed at controlled, repeatable pointer movement for daily tasks',
        'As a daily-use mouse, {brandOption} prioritizes reliable tracking over unnecessary extras'
      ],
      hub: [
        '{brand} hub is built to centralize laptop connectivity in a single desk anchor point',
        'As a port-expansion option, {brandOption} targets cleaner, more stable workstation wiring'
      ],
      tablet: [
        '{brand} tablet is intended for light productivity and reading away from a full desktop',
        'As a secondary-screen option, {brandOption} supports flexible work around meetings and travel'
      ],
      monitorArm: [
        '{brand} monitor arm is designed to improve screen positioning and free desk surface area',
        'As a workspace ergonomics option, {brandOption} focuses on adjustability and cable order'
      ],
      charger: [
        '{brand} charger is built to streamline power delivery across core desk devices',
        'As a power-management choice, {brandOption} keeps charging steadier across daily gear'
      ],
      
      // Home - Kitchen
      airFryer: [
        '{brand} air fryer is designed to speed up meal prep with faster, more consistent heating',
        'As a kitchen upgrade, {brandOption} focuses on reducing cooking time for daily meals'
      ],
      coffeeMaker: [
        '{brand} coffee maker is built to streamline your morning routine with consistent brewing',
        'As a daily appliance, {brandOption} prioritizes ease of use and repeatable results'
      ],
      blender: [
        '{brand} blender is aimed at smooth consistency for daily shakes and food prep',
        'As a counter staple, {brandOption} focuses on reliable power for routine blending tasks'
      ],
      toasterOven: [
        '{brand} toaster oven is designed to handle small baking tasks without heating the whole kitchen',
        'As a versatile oven option, {brandOption} targets convenience for quick reheating and cooking'
      ],
      cookware: [
        '{brand} cookware is built for consistent heat distribution during daily meal prep',
        'As a kitchen essential, {brandOption} prioritizes durability and easy cleanup'
      ],
      
      // Home - Cleaning
      robotVacuum: [
        '{brand} robot vacuum is positioned to automate recurring floor cleanup with low supervision',
        'As a home-office cleaning option, {brandOption} aims to reduce routine maintenance overhead'
      ],
      vacuum: [
        '{brand} vacuum is designed to handle deeper cleaning tasks with sustained suction power',
        'As a floor-care tool, {brandOption} focuses on efficiency for weekly cleanup routines'
      ],
      mop: [
        '{brand} mop is built to tackle hard floor cleaning with less manual effort',
        'As a cleaning aid, {brandOption} aims to speed up surface washing for high-traffic areas'
      ],
      
      // Home - Comfort
      airPurifier: [
        '{brand} air purifier is designed to maintain consistent air quality in living or work spaces',
        'As an environment tool, {brandOption} focuses on reducing dust and allergens in daily-use rooms'
      ],
      heater: [
        '{brand} heater is aimed at providing supplemental warmth for drafty or cold rooms',
        'As a comfort addition, {brandOption} prioritizes fast, localized heating for immediate effect'
      ],
      fan: [
        '{brand} fan is built to improve air circulation and cooling in stuffy areas',
        'As a cooling option, {brandOption} focuses on airflow consistency for steady comfort'
      ],
      humidifier: [
        '{brand} humidifier is designed to stabilize moisture levels for better breathing comfort',
        'As an air-quality tool, {brandOption} aims to reduce dryness in climate-controlled rooms'
      ],
      deskLamp: [
        '{brand} lamp is designed to support clearer visibility through variable lighting needs',
        'As a task-light option, {brandOption} focuses on practical illumination control for work or reading'
      ],
      
      // Home - Organization
      shelving: [
        '{brand} shelving is built to maximize vertical storage in cluttered areas',
        'As a storage solution, {brandOption} prioritizes stability and easy access for stored items'
      ],
      organizer: [
        '{brand} organizer is designed to keep small items sorted and accessible',
        'As a decluttering tool, {brandOption} helps maintain order in busy drawers or shelves'
      ],
      
      // Generic Fallback
      general: [
        '{brand} pick is selected for reliable day-to-day usefulness in its category',
        'This option improves routine consistency without unnecessary complexity',
        '{brandOption} prioritizes practical value for regular use'
      ]
    };

    const featureClauses = {
      // Tech
      wireless: ['wireless operation keeps movement unrestricted', 'wireless connectivity helps keep cable clutter lower'],
      wired: ['wired connectivity avoids battery interruptions', 'wired operation is useful when you want stable performance without charging'],
      bluetooth: ['Bluetooth pairing simplifies switching between devices', 'Bluetooth support reduces dependence on extra receivers'],
      ergonomic: ['ergonomic shaping can reduce strain across extended use', 'ergonomic design supports lower fatigue during repetitive tasks'],
      compact: ['compact sizing fits tighter spaces easily', 'compact footprint leaves more room for other essentials'],
      lightweight: ['lightweight construction lowers fatigue during use', 'lower weight supports easier handling'],
      'usb-c': ['USB-C support modernizes connectivity', 'USB-C charging simplifies cable management'],
      
      // Home - General
      hepa: ['HEPA filtration captures fine dust and allergens effectively', 'HEPA standards help ensure cleaner air output'],
      programmable: ['programmable settings let you automate routine tasks', 'timer functions help align operation with your schedule'],
      cordless: ['cordless operation allows free movement around the room', 'battery power removes the hassle of finding outlets'],
      'non-stick': ['non-stick coating simplifies cleanup after use', 'non-stick surface helps prevent food adhesion'],
      stainless: ['stainless steel build adds durability for daily use', 'metal construction usually resists wear better over time'],
      waterproof: ['waterproof design handles wet environments without issue', 'water resistance adds peace of mind near sinks or outdoors'],
      smart: ['smart features allow remote control via app or voice', 'app connectivity lets you monitor status from anywhere'],
      quiet: ['quiet operation minimizes disruption in shared spaces', 'low-noise output is better for evening or work-hours use'],
      capacity: ['large capacity reduces the frequency of refills or emptying', 'generous capacity handles bigger batches or messes'],
      adjustable: ['adjustable settings let you tune performance to the task', 'adjustable design helps fit the tool to your specific need']
    };

    const intendedUseClauses = {
      // Tech
      gaming: ['its fit is strongest when responsiveness and control matter most', 'it is best matched to gaming-leaning workflows'],
      office: ['its fit is strongest for office-heavy workflows where consistency is priority', 'it aligns well with practical office routines'],
      mobile: ['its fit is strongest for mobile workflows that shift locations', 'it is better suited to portable setups'],
      
      // Home
      cooking: ['its fit is strongest for streamlining daily meal preparation', 'it aligns well with kitchens that need consistent cooking results'],
      cleaning: ['its fit is strongest for maintaining tidy floors with less effort', 'it is best suited to homes that need efficient routine cleanup'],
      organizing: ['its fit is strongest for decluttering busy storage areas', 'it aligns well with spaces that need better item accessibility'],
      comfort: ['its fit is strongest for stabilizing room environment quality', 'it is best suited to rooms that need consistent temperature or air quality'],
      
      // General
      general: ['it is a practical fit for routine use without specialized requirements', 'it should work best in setups focused on predictable daily performance']
    };

    const categoryReserveClauses = {
      // Home
      airFryer: ['its main benefit is quicker cooking with less oil', 'it is best suited to making crispy sides or snacks fast'],
      coffeeMaker: ['its main benefit is consistent brewing for your daily cup', 'it is best suited to households that need a reliable caffeine routine'],
      robotVacuum: ['its main benefit is keeping floors acceptable between deep cleans', 'it is best suited to maintaining baseline cleanliness automatically'],
      airPurifier: ['its main benefit is reducing airborne irritants steadily', 'it is best suited to bedrooms or offices with poor airflow'],
      shelving: ['its main benefit is adding vertical storage footprint', 'it is best suited to garages, pantries, or closets needing structure'],
      
      // Fallback
      general: ['its strongest advantage is practical day-to-day utility', 'it is best suited to mixed-use environments that value reliability']
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
      const openerVariants = [
        'Operational fit:', 'Day-to-day impact:', 'Practical upside:', 'Why it matters:',
        'Workflow benefit:', 'In routine use:', 'Execution note:', 'Buyer takeaway:'
      ];
      const opener = openerVariants[(seed + attempt) % openerVariants.length];
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

      let candidate = `${role}. ${opener} ${primaryClause}`;
      if (secondaryClause && secondaryClause !== primaryClause && attempt % 3 !== 2) {
        candidate += `; ${secondaryClause}`;
      }
      candidate += '.';

      if (suspiciousSource) {
        const caveats = [
          'Source cues suggest used or refurbished inventory, so verify condition and warranty.',
          'Listing hints indicate potential resale status, so confirm seller quality before purchase.'
        ];
        candidate += ` ${caveats[(seed + attempt) % caveats.length]}`;
      }

      // Length adjustment
      if (candidate.length > 180) {
        candidate = candidate.replace(/;[^.]+\./, '.'); // drop secondary
      }
      if (candidate.length > 180) {
        candidate = candidate.slice(0, 180).trim();
        if (!/[.!?]$/.test(candidate)) candidate += '.';
      }
      if (candidate.length < 95) {
        const topUps = [
          'This keeps the value proposition practical for routine use.',
          'It should integrate cleanly into existing setups with limited overhead.',
          'That profile aligns with practical constraints for this category.'
        ];
        candidate += ` ${topUps[(seed + attempt) % topUps.length]}`;
      }

      const candidateBigram = openingBigram(candidate);
      const adjacentBigram = diversityState.lastOpeningBigram || '';
      const pairwise = maxSimilarity(candidate, priorBlurbs);
      const adjacent = adjacentBlurb ? jaccardSimilarity(candidate, adjacentBlurb) : 0;
      const candidatePattern = normalizeBlurbPattern(candidate);
      const patternSimilarity = maxSimilarity(candidatePattern, diversityState.patterns || []);
      
      // Penalties
      const lengthPenalty = candidate.length < 95 ? (95 - candidate.length) : (candidate.length > 180 ? (candidate.length - 180) : 0);
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
