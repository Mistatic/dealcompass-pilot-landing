function norm(v) {
  return String(v || '').trim().toLowerCase();
}

function mapInterest(v) {
  const k = norm(v);
  if (k === 'tech') {
    return {
      interest_key: 'tech',
      interest_label: 'Tech deals',
      interest_headline: 'We’ll prioritize high-signal tech picks for you.',
      interest_description:
        'Expect practical verdicts on accessories, productivity gear, and high-value upgrades with clear tradeoffs.',
      recommended_page_label: 'Browse current tech picks',
      recommended_page_url: 'https://dealcompass.app/current-picks.html?category=tech',
    };
  }
  if (k === 'home') {
    return {
      interest_key: 'home',
      interest_label: 'Home deals',
      interest_headline: 'We’ll prioritize home-category value picks for you.',
      interest_description:
        'Expect practical verdicts for everyday home needs with use-case clarity and price-to-value context.',
      recommended_page_label: 'Browse current home picks',
      recommended_page_url: 'https://dealcompass.app/current-picks.html?category=home',
    };
  }
  if (k === 'both') {
    return {
      interest_key: 'both',
      interest_label: 'Tech + Home deals',
      interest_headline: 'You’ll receive a balanced mix of tech and home picks.',
      interest_description:
        'We’ll rotate high-confidence picks across both categories so you get broad but still useful coverage.',
      recommended_page_label: 'Browse all current picks',
      recommended_page_url: 'https://dealcompass.app/current-picks.html',
    };
  }
  return {
    interest_key: 'new_categories',
    interest_label: 'New category launches',
    interest_headline: 'We’ll keep you in the loop as new categories launch.',
    interest_description:
      'You’ll get updates when we expand beyond core categories and publish first-wave verdicts.',
    recommended_page_label: 'See our latest verdicts',
    recommended_page_url: 'https://dealcompass.app/reviews.html',
  };
}

function mapGoal(v) {
  const k = norm(v);
  if (k === 'save_time') {
    return {
      goal_key: 'save_time',
      goal_label: 'Save time researching',
      goal_focus_line: 'We’ll keep updates concise so you can decide faster with less research overhead.',
    };
  }
  if (k === 'trusted_verdicts') {
    return {
      goal_key: 'trusted_verdicts',
      goal_label: 'Get trusted verdicts before buying',
      goal_focus_line: 'We’ll emphasize verdict depth and clear buying guidance before you commit.',
    };
  }
  if (k === 'discover_categories') {
    return {
      goal_key: 'discover_categories',
      goal_label: 'Discover new categories',
      goal_focus_line: 'We’ll prioritize category expansion signals and highlight where new picks are strongest.',
    };
  }
  return {
    goal_key: 'best_value',
    goal_label: 'Find best value faster',
    goal_focus_line: 'We’ll focus on high value-to-price opportunities and practical fit over hype.',
  };
}

function mapCadence(v) {
  const k = norm(v);
  if (k === 'twice_weekly') {
    return {
      cadence_key: 'twice_weekly',
      cadence_label: 'Twice weekly',
      cadence_line: 'You asked for twice-weekly updates. We’ll keep them concise and signal-first.',
      cadence_frequency_hint: '2 updates/week',
    };
  }
  if (k === 'high_signal_only') {
    return {
      cadence_key: 'high_signal_only',
      cadence_label: 'High-signal only',
      cadence_line: 'You asked for high-signal-only updates. We’ll send less often, with tighter quality thresholds.',
      cadence_frequency_hint: 'only strongest opportunities',
    };
  }
  return {
    cadence_key: 'weekly_digest',
    cadence_label: 'Weekly digest',
    cadence_line: 'You asked for a weekly digest. We’ll summarize top opportunities and key verdicts once a week.',
    cadence_frequency_hint: '1 update/week',
  };
}

function mapDelivery(v) {
  const k = norm(v);
  if (k === 'email_plus_telegram') {
    return {
      delivery_key: 'email_plus_telegram',
      delivery_label: 'Email + Telegram when available',
      delivery_line: 'We’ll use email now and prioritize Telegram delivery expansion as it rolls out.',
    };
  }
  return {
    delivery_key: 'email',
    delivery_label: 'Email',
    delivery_line: 'We’ll deliver updates by email.',
  };
}

function buildSignupEmailProfile(input) {
  const interest = mapInterest(input.primary_interest);
  const goal = mapGoal(input.primary_goal);
  const cadence = mapCadence(input.update_frequency);
  const delivery = mapDelivery(input.delivery_preference);
  const requestedCategories = String(input.requested_categories || '').trim();

  return {
    ...interest,
    ...goal,
    ...cadence,
    ...delivery,
    requested_categories_normalized: requestedCategories || 'none provided',
    requested_categories_line: requestedCategories
      ? `Requested next category: ${requestedCategories}`
      : 'No specific next category requested yet.',
  };
}

module.exports = {
  buildSignupEmailProfile,
};
