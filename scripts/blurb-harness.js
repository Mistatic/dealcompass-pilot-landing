'use strict';

function hashText(text) {
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
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
  const t = title.toLowerCase();
  for (const [needle, label] of brands) {
    if (t.includes(needle)) return label;
  }
  const first = title.match(/^\s*([A-Za-z0-9][A-Za-z0-9+\-]{1,})/);
  return first ? first[1] : '';
}

function detectProductCategory(title) {
  const t = title.toLowerCase();
  if (t.includes('trackball')) return 'trackball';
  if ((t.includes('keyboard') && t.includes('mouse')) || t.includes('combo')) return 'combo';
  if (t.includes('keyboard')) return 'keyboard';
  if (t.includes('mouse')) return 'mouse';
  if (t.includes('hub') || t.includes('dock') || t.includes('multiport')) return 'hub';
  if (t.includes('desk lamp') || /\blamp\b/.test(t) || t.includes('light bar')) return 'deskLamp';
  if (t.includes('robot vacuum') || (t.includes('robot') && t.includes('vacuum')) || t.includes('roborock')) return 'robotVacuum';
  if (t.includes('tablet') || t.includes('ipad') || t.includes('fire hd') || t.includes('galaxy tab')) return 'tablet';
  if (t.includes('monitor arm') || (t.includes('monitor') && t.includes('arm')) || t.includes('vesa')) return 'monitorArm';
  if (t.includes('charger') || t.includes('charging') || t.includes('power adapter') || /\bpd\b/.test(t)) return 'charger';
  return 'general';
}

function detectTitleSignals(title) {
  const t = title.toLowerCase();
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

function tokenSet(text) {
  const stopWords = new Set([
    'a', 'an', 'and', 'as', 'at', 'be', 'for', 'from', 'in', 'into', 'is', 'it', 'its',
    'of', 'on', 'or', 'so', 'that', 'the', 'this', 'to', 'with', 'while'
  ]);
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(token => token && !stopWords.has(token))
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
  const tokens = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  return tokens.slice(0, 2).join(' ');
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

function buildProductBlurb(title, diversityState) {
  const brand = extractBrand(title);
  const category = detectProductCategory(title);
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
    charger: [
      '{brand} charger is aimed at consolidating power delivery for core desk devices',
      'This charging pick is positioned to reduce adapter clutter in multi-device setups',
      'As a power-management option, {brandOption} supports steadier charging across daily gear'
    ],
    general: [
      '{brand} pick is positioned for practical utility in routine productivity setups',
      'This option is intended to improve day-to-day workflow reliability without extra complexity',
      'As a desk-tech option, {brandOption} focuses on function-first value for regular use'
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
      'its fit is strongest for office-heavy workflows where consistency is the priority',
      'it aligns well with practical office routines that favor low-friction reliability'
    ],
    mobile: [
      'its fit is strongest for mobile workflows that shift between locations',
      'it is better suited to portable setups that need compact, flexible gear'
    ],
    general: [
      'it is a practical fit for routine productivity work without specialized requirements',
      'it should work best in mixed-use setups focused on predictable daily performance'
    ]
  };

  const roleTemplates = roleTemplatesByCategory[category] || roleTemplatesByCategory.general;
  const allCandidateClauses = [];
  features.forEach((feature) => {
    const variants = featureClauses[feature];
    if (variants) allCandidateClauses.push(...variants);
  });
  allCandidateClauses.push(...(intendedUseClauses[intendedUse] || intendedUseClauses.general));

  let bestCandidate = '';
  let bestPenalty = Number.POSITIVE_INFINITY;

  for (let attempt = 0; attempt < 16; attempt += 1) {
    const role = fillTemplate(roleTemplates[(seed + attempt) % roleTemplates.length], brand);
    const openerVariants = ['Key benefit:', 'In day-to-day use,', 'Practical upside:'];
    const opener = openerVariants[(seed + attempt) % openerVariants.length];
    const primaryClause = allCandidateClauses[(seed + attempt) % allCandidateClauses.length] || intendedUseClauses.general[0];
    const secondaryClause = allCandidateClauses[(seed + attempt + 3) % allCandidateClauses.length];

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
        'That profile helps maintain predictable day-to-day desk performance.'
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

    const priorBlurbs = diversityState.blurbs;
    const adjacentBlurb = priorBlurbs[priorBlurbs.length - 1] || '';
    const candidateBigram = openingBigram(candidate);
    const adjacentBigram = diversityState.lastOpeningBigram || '';
    const pairwise = maxSimilarity(candidate, priorBlurbs);
    const adjacent = adjacentBlurb ? jaccardSimilarity(candidate, adjacentBlurb) : 0;
    const lengthPenalty = candidate.length < 95 ? (95 - candidate.length) : (candidate.length > 180 ? (candidate.length - 180) : 0);

    const penalty =
      lengthPenalty +
      (candidateBigram && candidateBigram === adjacentBigram ? 35 : 0) +
      Math.max(0, pairwise - 0.64) * 140 +
      Math.max(0, adjacent - 0.54) * 140;

    if (penalty < bestPenalty) {
      bestPenalty = penalty;
      bestCandidate = candidate;
    }

    if (candidateBigram === adjacentBigram) continue;
    if (pairwise > 0.64 || adjacent > 0.54) continue;
    if ((candidate.length < 95 || candidate.length > 180) && attempt < 15) continue;

    diversityState.blurbs.push(candidate);
    diversityState.lastOpeningBigram = candidateBigram;
    return candidate;
  }

  diversityState.blurbs.push(bestCandidate);
  diversityState.lastOpeningBigram = openingBigram(bestCandidate);
  return bestCandidate;
}

const sampleTitles = [
  'Logitech Ergo M575S Wireless Trackball Mouse, Wireless Ergonomic Mouse with Bluetooth',
  'UGREEN Revodok Pro USB-C Hub 6 in 1 10Gbps 4K 60Hz HDMI, 100W Power Delivery',
  'Amazon Fire HD 10 (9th Generation) 32GB, Wi-Fi, 10.1in - eBay',
  'Redragon M908 Impact RGB LED MMO Gaming Mouse with 12 Side Buttons, Optical Wired Ergonomic',
  'Anker 6-in-1 USB C Hub with Ethernet, USB C to 4K HDMI Multiport Adapter, 1Gbps Ethernet, 65W',
  'ASUS ROG Harpe Ace Mini Wireless Gaming Mouse - Small Compact Design, 49g Lightweight, 36K DPI',
  'Logitech G305 Lightspeed Wireless Gaming Mouse, Hero Sensor',
  'Logitech POP ICON Combo, Bluetooth Keyboard and Mouse Combo, Comfortable Typing',
  'YUNZII AL71 75% Mechanical Keyboard, Full Aluminum CNC, Hot Swappable Gasket, 2.4GHz Wireless Bluetooth',
  'Vicsoon Desk Lamp for Home Office - LED Desk Lamp with Wireless Charger, 3 Color Modes Dimmable'
];

const diversityState = { blurbs: [], lastOpeningBigram: '' };
const blurbs = sampleTitles.map((title) => buildProductBlurb(title, diversityState));

let maxPairwise = 0;
for (let i = 0; i < blurbs.length; i += 1) {
  for (let j = i + 1; j < blurbs.length; j += 1) {
    maxPairwise = Math.max(maxPairwise, jaccardSimilarity(blurbs[i], blurbs[j]));
  }
}

let maxAdjacent = 0;
for (let i = 1; i < blurbs.length; i += 1) {
  maxAdjacent = Math.max(maxAdjacent, jaccardSimilarity(blurbs[i - 1], blurbs[i]));
}

console.log(`unique_count=${new Set(blurbs).size}`);
console.log(`max_pairwise_similarity=${maxPairwise.toFixed(3)}`);
console.log(`adjacent_similarity=${maxAdjacent.toFixed(3)}`);
console.log('sample_blurbs:');
blurbs.forEach((blurb, idx) => {
  console.log(`${idx + 1}. ${blurb}`);
});
