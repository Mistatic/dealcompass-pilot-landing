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
      .replace(/ (anker|ugreen|amazon|logitech|asus|redragon|yunzii|dell|hp|lenovo|apple|samsung) /g, ' brand ')
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

  function fillTemplate(template, brand) {
    const brandLabel = brand || 'This';
    const brandOption = brand ? `${brand} option` : 'this option';
    return template
      .replaceAll('{brand}', brandLabel)
      .replaceAll('{brandOption}', brandOption)
      .replace(/\s+/g, ' ')
      .trim();
  }

  function extractBrand(title) {
    const brands = [
      ['logitech', 'Logitech'],
      ['ugreen', 'UGREEN'],
      ['anker', 'Anker'],
      ['asus', 'ASUS'],
      ['redragon', 'Redragon'],
      ['yunzii', 'YUNZII'],
      ['vicsoon', 'Vicsoon'],
      ['amazon', 'Amazon'],
      ['fire', 'Amazon'],
      ['samsung', 'Samsung'],
      ['apple', 'Apple'],
      ['lenovo', 'Lenovo'],
      ['dell', 'Dell'],
      ['hp', 'HP']
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
    if (t.includes('trackball')) return 'trackball';
    if ((t.includes('keyboard') && t.includes('mouse')) || t.includes('combo')) return 'combo';
    if (t.includes('keyboard')) return 'keyboard';
    if (t.includes('mouse')) return 'mouse';
    if (t.includes('hub') || t.includes('dock') || t.includes('multiport')) return 'hub';
    if (t.includes('desk lamp') || /\blamp\b/.test(t) || t.includes('light bar')) return 'deskLamp';
    if (t.includes('robot vacuum') || (t.includes('robot') && t.includes('vacuum')) || t.includes('roborock')) return 'robotVacuum';
    if (t.includes('tablet') || t.includes('ipad') || t.includes('fire hd') || t.includes('galaxy tab')) return 'tablet';
    if (t.includes('monitor arm') || (t.includes('monitor') && t.includes('arm')) || t.includes('vesa')) return 'monitorArm';
    if (t.includes('router') || t.includes('wifi 6e') || t.includes('tri-band') || t.includes('mesh')) return 'router';
    if (t.includes('ethernet switch') || (t.includes('switch') && t.includes('gigabit'))) return 'networkSwitch';
    if (t.includes('cooling pad') || t.includes('laptop cooler')) return 'coolingPad';
    if (t.includes('privacy screen') || (t.includes('privacy') && t.includes('screen'))) return 'privacyScreen';
    if (t.includes('charger') || t.includes('charging') || t.includes('power adapter') || /\bpd\b/.test(t)) return 'charger';
    return 'general';
  }

  function detectTitleSignals(title) {
    const t = String(title || '').toLowerCase();
    const featurePatterns = [
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
      ['charger', /\bcharger\b|charging|power adapter|qi|magnetic charge/]
    ];

    const features = featurePatterns
      .filter(([, pattern]) => pattern.test(t))
      .map(([name]) => name);

    let intendedUse = 'general';
    if (/\bgaming\b|mmo|fps|rgb|hero sensor/.test(t)) intendedUse = 'gaming';
    else if (/office|home office|productivity|ergonomic|keyboard|mouse|desk/.test(t)) intendedUse = 'office';
    else if (/portable|travel|mobile|mini|compact|tablet|wireless/.test(t)) intendedUse = 'mobile';

    const suspiciousSource = /ebay|refurbished|renewed|used|open box|pre-?owned/.test(t);
    return { features, intendedUse, suspiciousSource };
  }

  function classifyUseCase(text, category = 'tech') {
    const t = String(text || '').toLowerCase();
    if (category === 'home') {
      if (t.includes('vacuum') || t.includes('robot')) return 'Best for Cleaning';
      if (t.includes('air purifier') || t.includes('humidifier') || t.includes('dehumidifier')) return 'Best for Air Quality';
      if (t.includes('heater') || t.includes('fan')) return 'Best for Comfort';
      if (t.includes('storage') || t.includes('organizer')) return 'Best for Organization';
      return 'Best for Home Essentials';
    }
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
    const categoryContext = (opts && opts.category) || 'tech';
    
    const brand = extractBrand(title);
    const productCategory = detectProductCategory(title);
    const { features, intendedUse, suspiciousSource } = detectTitleSignals(title);
    const seed = hashText(title);

    const roleTemplatesByCategory = {
      trackball: [
        '{brand} trackball is positioned for precise cursor work with reduced wrist travel',
        'This trackball pick is tuned for steady control during long pointer-heavy sessions',
        'As a trackball option, {brandOption} favors controlled navigation over fast sweeping motion'
      ],
      combo: [
        '{brand} combo is built to standardize keyboard and mouse behavior across one desk',
        'This keyboard-and-mouse bundle is aimed at practical setup simplicity for daily work',
        'As an input combo, {brandOption} reduces setup friction for mixed home and office routines'
      ],
      keyboard: [
        '{brand} keyboard is intended for consistent typing comfort in long writing blocks',
        'This keyboard pick is designed for predictable key feel across everyday productivity tasks',
        'As a primary keyboard, {brandOption} focuses on stable input quality for daily desk use'
      ],
      mouse: [
        '{brand} mouse is aimed at controlled, repeatable pointer movement for daily tasks',
        'This mouse pick is positioned for low-fatigue handling in long desk sessions',
        'As a daily-use mouse, {brandOption} prioritizes reliable tracking over unnecessary extras'
      ],
      hub: [
        '{brand} hub is built to centralize laptop connectivity in a single desk anchor point',
        'This USB-C hub is positioned to reduce cable swapping across monitor and accessory links',
        'As a port-expansion option, {brandOption} targets cleaner, more stable workstation wiring'
      ],
      deskLamp: [
        '{brand} desk lamp is designed to support clearer visibility through variable work hours',
        'This lighting pick is aimed at reducing eye strain in low-light desk environments',
        'As a task-light option, {brandOption} focuses on practical illumination control for office setups'
      ],
      robotVacuum: [
        '{brand} robot vacuum is positioned to automate recurring floor cleanup with low supervision',
        'This robot vacuum pick is designed to maintain baseline cleanliness between manual deep cleans',
        'As a home-office cleaning option, {brandOption} aims to reduce routine maintenance overhead'
      ],
      tablet: [
        '{brand} tablet is intended for light productivity and review work away from a full desktop',
        'This tablet pick is positioned for mobile reading, notes, and communication tasks',
        'As a secondary-screen option, {brandOption} supports flexible work around meetings and travel'
      ],
      monitorArm: [
        '{brand} monitor arm is designed to improve screen positioning and free desk surface area',
        'This monitor-mount pick is positioned for ergonomic height control in long desk sessions',
        'As a workspace ergonomics option, {brandOption} focuses on adjustability and cable order'
      ],
      router: [
        '{brand} router is designed to keep multi-device home-office traffic stable under heavier daily load',
        'This Wi-Fi router pick prioritizes consistent throughput for calls, uploads, and streaming overlap',
        'As a network-core option, {brandOption} is tuned for steadier coverage and lower congestion spikes'
      ],
      networkSwitch: [
        '{brand} switch is designed to add stable wired ports for desk gear that benefits from consistent throughput',
        'This ethernet switch pick focuses on low-friction wired expansion for desktops, docks, and consoles',
        'As a wired-network option, {brandOption} helps keep latency and packet variability lower than shared Wi-Fi'
      ],
      coolingPad: [
        '{brand} cooling pad is designed to improve laptop airflow during longer high-heat sessions',
        'This laptop cooler pick helps manage thermal buildup so sustained performance stays more consistent',
        'As a thermal-support accessory, {brandOption} aims to reduce heat-related throttling in extended use'
      ],
      privacyScreen: [
        '{brand} privacy screen is designed to narrow side-angle visibility for safer work in shared spaces',
        'This privacy-filter pick helps protect on-screen content in cafés, coworking spaces, and open offices',
        'As a screen-privacy option, {brandOption} adds visual protection without changing your core workflow'
      ],
      charger: [
        '{brand} charger is built to streamline power delivery across core desk devices',
        'This charging option reduces adapter clutter in multi-device setups',
        'As a power-management choice, {brandOption} keeps charging steadier across daily gear'
      ],
      general: [
        '{brand} pick is selected for reliable day-to-day usefulness in mixed setups',
        'This option improves workflow consistency without unnecessary complexity',
        '{brandOption} prioritizes practical value for regular use'
      ]
    };

    const featureClauses = {
      wireless: [
        'wireless operation keeps movement unrestricted in crowded desk layouts',
        'wireless connectivity helps keep cable clutter lower around keyboard and dock zones'
      ],
      wired: [
        'wired connectivity avoids battery interruptions and keeps response behavior consistent',
        'wired operation is useful when you want stable input with no charging cycle management'
      ],
      bluetooth: [
        'Bluetooth pairing simplifies switching between laptop, tablet, and secondary devices',
        'Bluetooth support reduces dependence on extra receivers in compact setups'
      ],
      ergonomic: [
        'ergonomic shaping can reduce wrist strain across extended work sessions',
        'ergonomic contours support lower hand fatigue during repetitive pointer or typing tasks'
      ],
      gaming: [
        'gaming-oriented tuning favors faster response when quick cursor changes are common',
        'gaming-focused hardware can keep tracking behavior more consistent under rapid movement'
      ],
      mmo: [
        'MMO-style side controls can shift frequent commands away from keyboard reaches',
        'extra side-button capacity helps map repetitive actions for faster execution'
      ],
      mechanical: [
        'mechanical switches provide clearer tactile feedback for long-form typing',
        'mechanical key response tends to improve consistency when typing volume is high'
      ],
      rgb: [
        'RGB lighting can improve key or control visibility in dim work areas',
        'RGB zones make low-light sessions easier without changing desk lighting'
      ],
      compact: [
        'compact sizing fits tighter desks and packs more easily for mobile setups',
        'compact footprint leaves more surface area for notebooks, tablets, and accessories'
      ],
      lightweight: [
        'lightweight construction can lower fatigue during long control-intensive sessions',
        'lower weight supports quicker repositioning when switching between tasks'
      ],
      trackball: [
        'trackball control reduces broad arm movement while keeping fine cursor precision',
        'trackball input can help maintain control in limited desk space'
      ],
      aluminum: [
        'aluminum construction adds rigidity for steadier day-to-day handling',
        'metal chassis materials typically hold alignment better under heavy daily use'
      ],
      'hot-swappable': [
        'hot-swappable sockets simplify switch maintenance and long-term customization',
        'hot-swap support lets you tune key feel without replacing the full board'
      ],
      '4k': [
        '4K output support is useful for sharper spreadsheets, docs, and dashboard views',
        '4K-ready display paths help preserve text clarity on larger external monitors'
      ],
      hdmi: [
        'HDMI output streamlines single-cable external display hookups',
        'HDMI support improves compatibility with common office and meeting-room screens'
      ],
      ethernet: [
        'Ethernet can provide steadier throughput than congested shared Wi-Fi',
        'wired network support is valuable for calls, uploads, and large sync jobs'
      ],
      '100w': [
        'higher-wattage USB-C delivery can power laptops while peripherals stay attached',
        'power-delivery headroom helps avoid separate laptop chargers at the desk'
      ],
      'usb-c': [
        'USB-C expansion centralizes accessories and charging through a single connection path',
        'USB-C multiport support cuts down repeated plug swapping during the workday'
      ],
      dimmable: [
        'dimmable output helps match brightness to early-morning and late-evening work blocks',
        'adjustable brightness can reduce eye strain when ambient light changes'
      ],
      charger: [
        'integrated charging reduces adapter sprawl around core daily devices',
        'charging support keeps phones and peripherals topped up without extra power bricks'
      ]
    };

    const intendedUseClauses = {
      gaming: [
        'its fit is strongest when responsiveness and control mapping matter most',
        'it is best matched to gaming-leaning workflows that need quicker input response'
      ],
      office: [
        'it fits office-heavy workflows where consistency and low setup friction matter most',
        'it aligns with practical office routines that prioritize dependable daily performance'
      ],
      mobile: [
        'it fits mobile workflows that regularly shift between locations',
        'it is better suited to portable setups that need compact, flexible gear'
      ],
      general: [
        'it works well in mixed-use setups where predictable daily performance matters',
        'it is a solid fit for routine workflows that value reliability over feature bloat'
      ]
    };

    const roleTemplates = roleTemplatesByCategory[productCategory] || roleTemplatesByCategory.general;

    const categoryReserveClauses = {
      trackball: [
        'its strongest advantage is fine cursor control in limited desk space',
        'it is best suited to precision-heavy workflows where small movements matter'
      ],
      combo: [
        'its main benefit is predictable keyboard-and-mouse behavior across daily tasks',
        'it is best suited to desks that need quick setup with fewer compatibility surprises'
      ],
      keyboard: [
        'its strongest advantage is consistent typing feel over long writing sessions',
        'it is best suited to productivity-heavy routines where key feel consistency matters'
      ],
      mouse: [
        'its main benefit is controlled tracking for repetitive daily pointer work',
        'it is best suited to workflows that prioritize comfort and precision over extra features'
      ],
      hub: [
        'its main benefit is consolidating multiple desk connections through one hub point',
        'it is best suited to laptop setups that frequently switch between accessories and displays'
      ],
      deskLamp: [
        'its strongest advantage is controllable desk lighting for long focus blocks',
        'it is best suited to workspaces that need consistent visibility across changing ambient light'
      ],
      robotVacuum: [
        'its main benefit is reducing routine cleaning overhead between deep-clean cycles',
        'it is best suited to home-office floors that benefit from automated maintenance'
      ],
      tablet: [
        'its strongest advantage is flexible secondary-screen use for reading and notes',
        'it is best suited to mobile workflows that alternate between desk and travel contexts'
      ],
      monitorArm: [
        'its main benefit is ergonomic screen positioning with less desk obstruction',
        'it is best suited to setups that need adjustable viewing angles during long sessions'
      ],
      router: [
        'its strongest advantage is maintaining steadier multi-device throughput under load',
        'it is best suited to homes with overlapping calls, streaming, and cloud sync traffic'
      ],
      networkSwitch: [
        'its main benefit is adding reliable wired links for latency-sensitive desk gear',
        'it is best suited to setups that need more ethernet ports without Wi-Fi bottlenecks'
      ],
      coolingPad: [
        'its strongest advantage is improving thermal consistency during sustained laptop use',
        'it is best suited to high-heat workflows where throttling risk is a concern'
      ],
      privacyScreen: [
        'its main benefit is limiting side-angle visibility in shared work environments',
        'it is best suited to teams working in offices, coworking spaces, or cafés'
      ],
      charger: [
        'its strongest advantage is cleaner power delivery across core daily devices',
        'it is best suited to desks that need fewer adapters and steadier charging behavior'
      ],
      general: [
        'its strongest advantage is practical day-to-day utility with low setup overhead',
        'it is best suited to mixed-use setups that prioritize dependable baseline performance'
      ]
    };

    const allCandidateClauses = [];
    features.forEach((feature) => {
      const variants = featureClauses[feature];
      if (variants) allCandidateClauses.push(...variants);
    });
    if (allCandidateClauses.length < 2) {
      allCandidateClauses.push(...(categoryReserveClauses[productCategory] || categoryReserveClauses.general));
    }

    const angleClausesByCategory = {
      hub: {
        display: [
          'display-output paths are useful for sharper docs, dashboards, and multi-monitor layouts',
          'video-output support reduces friction when rotating between desk and meeting-room displays'
        ],
        power: [
          'power-delivery headroom helps keep laptops charged while peripherals stay connected',
          'higher-wattage passthrough can remove the need for a second charger on the desk'
        ],
        io: [
          'broader port mix reduces adapter hopping across keyboard, storage, and accessories',
          'expanded I/O options simplify one-cable desk setups with fewer dongle dependencies'
        ],
        cable: [
          'single-cable expansion helps keep workstation wiring cleaner and easier to manage',
          'centralized connectivity reduces daily plug-swapping and desk clutter'
        ],
        travel: [
          'compact hub sizing is easier to carry between home, office, and travel setups',
          'portable footprint makes it practical for mixed desk-and-bag workflows'
        ],
        network: [
          'wired network options can improve consistency for calls, syncs, and uploads',
          'ethernet-capable expansion helps avoid unstable shared Wi-Fi in busier environments'
        ]
      }
    };

    let selectedAngle = '';
    if (productCategory === 'hub') {
      const usedAngles = diversityState.usedAnglesByCategory.hub || new Set();
      diversityState.usedAnglesByCategory.hub = usedAngles;
      const t = String(title || '').toLowerCase();
      const preferredAngles = [];
      if (features.includes('ethernet')) preferredAngles.push('network');
      if (features.includes('4k') || features.includes('hdmi')) preferredAngles.push('display');
      if (features.includes('100w') || / (65w|100w|140w|power delivery|pd) /.test(t)) preferredAngles.push('power');
      if (/ \d+\s*-?\s*in\s*-?\s*\d+ |multiport|multi-port| port /.test(t)) preferredAngles.push('io');
      if (/compact|slim|portable|travel|mini/.test(t)) preferredAngles.push('travel');
      preferredAngles.push('cable');

      const ordered = [...new Set([...preferredAngles, 'display', 'power', 'io', 'cable', 'travel', 'network'])];
      selectedAngle = ordered.find((k) => !usedAngles.has(k)) || ordered[0] || 'cable';

      const angleClauses = angleClausesByCategory.hub[selectedAngle] || [];
      const deduped = angleClauses.filter((c) => !allCandidateClauses.includes(c));
      allCandidateClauses.unshift(...deduped);
    }

    let bestCandidate = '';
    let bestPenalty = Number.POSITIVE_INFINITY;
    let bestMeta = { roleTemplate: '', primaryClause: '', angle: '', pattern: '' };

    for (let attempt = 0; attempt < 16; attempt += 1) {
      const openerVariants = [
        'Operational fit:',
        'Day-to-day impact:',
        'Practical upside:',
        'Why it matters:',
        'Workflow benefit:',
        'In routine use,',
        'Execution note:',
        'Buyer takeaway:'
      ];
      const opener = openerVariants[(seed + attempt) % openerVariants.length];
      const priorBlurbs = diversityState.blurbs;
      const adjacentBlurb = priorBlurbs[priorBlurbs.length - 1] || '';

      let roleTemplate = roleTemplates[(seed + attempt) % roleTemplates.length];
      const roleKeyBase = `${productCategory}|${roleTemplate}`;
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
      const role = fillTemplate(roleTemplate, brand);
      const roleLine = role.toLowerCase().replace(/\b(anker|ugreen|amazon|logitech|asus|redragon|yunzii|dell|hp|lenovo|apple|samsung)\b/g, 'brand');

      let primaryClause = allCandidateClauses[(seed + attempt) % allCandidateClauses.length] || intendedUseClauses.general[0];
      let secondaryClause = allCandidateClauses[(seed + attempt + 3) % allCandidateClauses.length];

      // Hard guard: avoid reusing the same key-benefit clause used recently.
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
      if (diversityState.usedPrimaryClauses.has(primaryClause.toLowerCase())) {
        for (let shift = 1; shift < allCandidateClauses.length; shift += 1) {
          const alt = allCandidateClauses[(seed + attempt + shift) % allCandidateClauses.length];
          if (alt && !diversityState.usedPrimaryClauses.has(alt.toLowerCase())) {
            primaryClause = alt;
            break;
          }
        }
      }

      let candidate = `${role}. ${opener} ${primaryClause}`;
      if (secondaryClause && secondaryClause !== primaryClause && attempt % 3 !== 2) {
        candidate += `; ${secondaryClause}`;
      }
      candidate += '.';

      if (suspiciousSource) {
        const caveats = [
          'Source cues suggest used or refurbished inventory, so verify condition, return policy, and warranty terms.',
          'Listing hints indicate potential resale/refurb status, so confirm seller quality and warranty coverage before purchase.'
        ];
        candidate += ` ${caveats[(seed + attempt) % caveats.length]}`;
      }

      if (candidate.length < 95) {
        const ext = [
          'This keeps the value proposition practical for routine work blocks.',
          'That profile is usually easier to integrate into existing desk workflows.'
        ];
        candidate += ` ${ext[(seed + attempt) % ext.length]}`;
      }
      if (candidate.length > 180) {
        candidate = candidate.replace(/;[^.]+\./, '.');
      }
      if (candidate.length > 180) {
        candidate = candidate
          .replace(/Listing hints indicate potential resale\/refurb status,[^.]+\./, 'Confirm condition and warranty details before purchase.')
          .replace(/Source cues suggest used or refurbished inventory,[^.]+\./, 'Confirm condition and warranty details before purchase.');
      }
      if (candidate.length > 180) {
        const normalizedPrimary = `${primaryClause.charAt(0).toUpperCase()}${primaryClause.slice(1)}`.replace(/\.\s*$/, '');
        candidate = `${role}. ${normalizedPrimary}.`;
        if (suspiciousSource && candidate.length < 145) candidate += ' Confirm condition and warranty details before purchase.';
      }
      if (candidate.length > 180) {
        candidate = candidate.slice(0, 180).trim();
        if (!/[.!?]$/.test(candidate)) candidate += '.';
      }

      if (candidate.length < 95) {
        const topUps = [
          'This fit is strongest for steady office workflows that prioritize consistency.',
          'It should integrate cleanly into mixed home-office setups with limited overhead.',
          'That profile aligns with practical constraints for this product class.'
        ];
        candidate += ` ${topUps[(seed + attempt) % topUps.length]}`;
      }
      if (suspiciousSource && !/condition|warranty|seller/i.test(candidate)) {
        const caveat = ' Verify condition and warranty terms before purchase.';
        if (candidate.length + caveat.length > 180) {
          const maxCoreLength = Math.max(80, 180 - caveat.length);
          candidate = candidate.slice(0, maxCoreLength).trim();
          const lastPeriod = candidate.lastIndexOf('.');
          if (lastPeriod > 70) candidate = candidate.slice(0, lastPeriod + 1).trim();
          if (!/[.!?]$/.test(candidate)) candidate += '.';
        }
        candidate += caveat;
      }
      if (candidate.length > 180) {
        candidate = candidate.slice(0, 180).trim();
        if (!/[.!?]$/.test(candidate)) candidate += '.';
      }

      const candidateBigram = openingBigram(candidate);
      const adjacentBigram = diversityState.lastOpeningBigram || '';
      const pairwise = maxSimilarity(candidate, priorBlurbs);
      const adjacent = adjacentBlurb ? jaccardSimilarity(candidate, adjacentBlurb) : 0;
      const candidatePattern = normalizeBlurbPattern(candidate);
      const patternSimilarity = maxSimilarity(candidatePattern, diversityState.patterns || []);
      const lengthPenalty = candidate.length < 95 ? (95 - candidate.length) : (candidate.length > 180 ? (candidate.length - 180) : 0);

      const repeatedPhraseList = [
        'positioned for',
        'practical utility',
        'practical fit',
        'routine productivity',
        'day-to-day workflow reliability'
      ];
      const repeatedPhrasePenalty = repeatedPhraseList.reduce((acc, phrase) => {
        if (adjacentBlurb && candidate.toLowerCase().includes(phrase) && adjacentBlurb.toLowerCase().includes(phrase)) {
          return acc + 22;
        }
        return acc;
      }, 0);

      const roleReusePenalty = diversityState.usedRoleLines.has(roleLine) ? 120 : 0;
      const penalty =
        lengthPenalty +
        repeatedPhrasePenalty +
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
          angle: selectedAngle || '',
          pattern: candidatePattern
        };
      }

      if (candidateBigram === adjacentBigram) continue;
      if (pairwise > 0.50 || adjacent > 0.40) continue;
      if (patternSimilarity > 0.46) continue;
      if (diversityState.usedRoleLines.has(roleLine)) continue;
      if (productCategory === 'hub' && selectedAngle) {
        const usedHubAngles = diversityState.usedAnglesByCategory.hub || new Set();
        const unusedHubAngles = ['display', 'power', 'io', 'cable', 'travel', 'network'].filter((a) => !usedHubAngles.has(a));
        if (usedHubAngles.has(selectedAngle) && unusedHubAngles.length > 0) continue;
      }
      if ((candidate.length < 95 || candidate.length > 180) && attempt < 15) continue;

      diversityState.blurbs.push(candidate);
      diversityState.patterns.push(candidatePattern);
      diversityState.usedRoleTemplates.add(`${productCategory}|${roleTemplate}`);
      diversityState.usedRoleLines.add(roleLine);
      diversityState.usedPrimaryClauses.add(primaryClause.toLowerCase());
      if (productCategory === 'hub' && selectedAngle) {
        (diversityState.usedAnglesByCategory.hub ||= new Set()).add(selectedAngle);
      }
      diversityState.lastOpeningBigram = candidateBigram;
      return candidate;
    }

    if (productCategory === 'hub') {
      const usedHubAngles = diversityState.usedAnglesByCategory.hub || new Set();
      const hubAngles = ['display', 'power', 'io', 'cable', 'travel', 'network'];
      const fallbackAngle = selectedAngle || hubAngles.find((a) => !usedHubAngles.has(a)) || 'cable';
      const hubLeadByAngle = {
        display: '{brand} hub is optimized for cleaner external-display workflows with reliable HDMI routing',
        power: '{brand} hub is optimized to keep laptop charging stable while peripherals stay attached',
        io: '{brand} hub is optimized for broader port coverage to reduce adapter shuffling',
        cable: '{brand} hub is optimized to simplify desk wiring through one main connection point',
        travel: '{brand} hub is optimized for portable setups that move between desk and travel bags',
        network: '{brand} hub is optimized for steadier wired connectivity in high-traffic Wi-Fi environments'
      };
      const hubDetailByAngle = {
        display: 'It emphasizes display compatibility for monitor-heavy desk setups.',
        power: 'It emphasizes power-delivery headroom for all-day laptop use.',
        io: 'It emphasizes practical I/O mix for mixed accessory workflows.',
        cable: 'It emphasizes reduced plug-swapping and lower cable clutter.',
        travel: 'It emphasizes compact carry and quick setup in changing work locations.',
        network: 'It emphasizes more stable networking for calls, syncs, and uploads.'
      };
      const hubFallback = `${fillTemplate(hubLeadByAngle[fallbackAngle], brand)}. ${hubDetailByAngle[fallbackAngle]}`;
      diversityState.blurbs.push(hubFallback);
      diversityState.patterns.push(normalizeBlurbPattern(hubFallback));
      diversityState.usedRoleTemplates.add(`hub|angle:${fallbackAngle}`);
      diversityState.usedRoleLines.add(fillTemplate(hubLeadByAngle[fallbackAngle], brand).toLowerCase().replace(/ (anker|ugreen|amazon|logitech|asus|redragon|yunzii|dell|hp|lenovo|apple|samsung) /g, 'brand'));
      (diversityState.usedAnglesByCategory.hub ||= new Set()).add(fallbackAngle);
      diversityState.lastOpeningBigram = openingBigram(hubFallback);
      return hubFallback;
    }

    diversityState.blurbs.push(bestCandidate);
    diversityState.patterns.push(bestMeta.pattern || normalizeBlurbPattern(bestCandidate));
    if (bestMeta.roleTemplate) {
      diversityState.usedRoleTemplates.add(`${productCategory}|${bestMeta.roleTemplate}`);
      diversityState.usedRoleLines.add(fillTemplate(bestMeta.roleTemplate, brand).toLowerCase());
    }
    if (bestMeta.primaryClause) diversityState.usedPrimaryClauses.add(bestMeta.primaryClause.toLowerCase());
    if (productCategory === 'hub' && bestMeta.angle) {
      (diversityState.usedAnglesByCategory.hub ||= new Set()).add(bestMeta.angle);
    }
    diversityState.lastOpeningBigram = openingBigram(bestCandidate);
    return bestCandidate;
  }

  window.DCBlurbEngine = { generateBlurb, classifyUseCase };
})();
