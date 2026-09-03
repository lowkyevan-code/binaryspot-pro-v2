// ============================================================
// BinarySpot Pro
// Advanced Demo Strategy / Entry Signal Engine
// ============================================================
//
// IMPORTANT:
//
// - This module analyses digit/tick history only.
// - It DOES NOT connect to Deriv.
// - It DOES NOT purchase contracts.
// - It DOES NOT bypass BinarySpot safety controls.
// - Actual proposal/buy execution stays inside app/page.jsx.
//
// BinarySpot history convention:
//
// digitHistory[0] = newest digit
//
// Advanced strategy IDs are intentionally separated from
// Deriv contract types.
//
// Example:
//
// strategyId: ADAPTIVE
// contractType: DIGITDIFF
// predictionDigit: 7
//
// This prevents BinarySpot from accidentally sending
// "ADAPTIVE" as a Deriv contract_type.
//
// Confidence is a SIGNAL QUALITY SCORE.
// It is NOT a guaranteed future win probability.
// ============================================================

export const DIGITS = [
  0,
  1,
  2,
  3,
  4,
  5,
  6,
  7,
  8,
  9,
];

// ============================================================
// DERIV CONTRACT TYPES
// ============================================================

export const CONTRACT_TYPES =
  Object.freeze({
    DIFFERS: 'DIGITDIFF',

    MATCHES: 'DIGITMATCH',

    EVEN: 'DIGITEVEN',

    ODD: 'DIGITODD',

    OVER: 'DIGITOVER',

    UNDER: 'DIGITUNDER',
  });

// ============================================================
// BINARYSPOT STRATEGY IDS
// ============================================================

export const STRATEGY_IDS =
  Object.freeze({
    DIGIT_DIFFERS:
      'DIGITDIFF',

    DIGIT_MATCHES:
      'DIGITMATCH',

    DIGIT_EVEN:
      'DIGITEVEN',

    DIGIT_ODD:
      'DIGITODD',

    DIGIT_OVER:
      'DIGITOVER',

    DIGIT_UNDER:
      'DIGITUNDER',

    ADAPTIVE:
      'ADAPTIVE',

    FREQUENCY:
      'FREQUENCY',

    HOT_COLD:
      'HOT_COLD',

    MEAN_REVERSION:
      'MEAN_REVERSION',

    STREAK_BREAKER:
      'STREAK_BREAKER',

    MOMENTUM:
      'MOMENTUM',
  });

// ============================================================
// STRATEGY LIBRARY
// ============================================================

export const STRATEGY_LIBRARY =
  Object.freeze([
    {
      id:
        STRATEGY_IDS.ADAPTIVE,

      name:
        'Adaptive Confidence',

      shortName:
        'Adaptive',

      description:
        'Combines several independent signal filters and waits for stronger agreement before producing an entry.',

      category:
        'Smart Strategy',

      risk:
        'Balanced',

      recommended:
        true,

      minimumSamples:
        60,
    },

    {
      id:
        STRATEGY_IDS.FREQUENCY,

      name:
        'Digit Frequency Edge',

      shortName:
        'Frequency',

      description:
        'Measures short, medium and long digit frequencies and searches for persistent statistical imbalance.',

      category:
        'Digit Analysis',

      risk:
        'Balanced',

      recommended:
        true,

      minimumSamples:
        40,
    },

    {
      id:
        STRATEGY_IDS.HOT_COLD,

      name:
        'Hot / Cold Digit',

      shortName:
        'Hot / Cold',

      description:
        'Tracks digits whose recent frequency has moved significantly above or below their longer-term distribution.',

      category:
        'Digit Analysis',

      risk:
        'Balanced',

      recommended:
        true,

      minimumSamples:
        40,
    },

    {
      id:
        STRATEGY_IDS.MEAN_REVERSION,

      name:
        'Mean Reversion',

      shortName:
        'Reversion',

      description:
        'Looks for unusually stretched recent digit distributions and waits for a stronger reversion condition.',

      category:
        'Reversal',

      risk:
        'Moderate',

      recommended:
        false,

      minimumSamples:
        60,
    },

    {
      id:
        STRATEGY_IDS.STREAK_BREAKER,

      name:
        'Streak Breaker',

      shortName:
        'Streak',

      description:
        'Detects extended even or odd streaks and identifies possible parity reversal entries.',

      category:
        'Reversal',

      risk:
        'Moderate',

      recommended:
        false,

      minimumSamples:
        20,
    },

    {
      id:
        STRATEGY_IDS.MOMENTUM,

      name:
        'Digit Momentum',

      shortName:
        'Momentum',

      description:
        'Compares recent digit behaviour with previous windows to identify persistent distribution momentum.',

      category:
        'Momentum',

      risk:
        'Moderate',

      recommended:
        false,

      minimumSamples:
        40,
    },

    {
      id:
        STRATEGY_IDS.DIGIT_DIFFERS,

      name:
        'Digit Differs',

      shortName:
        'Differs',

      description:
        'Uses multi-window frequency filtering for Digit Differs contracts.',

      category:
        'Deriv Contract',

      risk:
        'Balanced',

      recommended:
        false,

      minimumSamples:
        30,
    },

    {
      id:
        STRATEGY_IDS.DIGIT_MATCHES,

      name:
        'Digit Matches',

      shortName:
        'Matches',

      description:
        'Looks for persistent dominant digits before considering a Digit Match contract.',

      category:
        'Deriv Contract',

      risk:
        'High',

      recommended:
        false,

      minimumSamples:
        60,
    },

    {
      id:
        STRATEGY_IDS.DIGIT_EVEN,

      name:
        'Digit Even',

      shortName:
        'Even',

      description:
        'Uses multi-window parity bias and streak filtering for Digit Even contracts.',

      category:
        'Deriv Contract',

      risk:
        'Balanced',

      recommended:
        false,

      minimumSamples:
        30,
    },

    {
      id:
        STRATEGY_IDS.DIGIT_ODD,

      name:
        'Digit Odd',

      shortName:
        'Odd',

      description:
        'Uses multi-window parity bias and streak filtering for Digit Odd contracts.',

      category:
        'Deriv Contract',

      risk:
        'Balanced',

      recommended:
        false,

      minimumSamples:
        30,
    },

    {
      id:
        STRATEGY_IDS.DIGIT_OVER,

      name:
        'Digit Over',

      shortName:
        'Over',

      description:
        'Compares observed Digit Over frequency against its theoretical baseline.',

      category:
        'Deriv Contract',

      risk:
        'Balanced',

      recommended:
        false,

      minimumSamples:
        30,
    },

    {
      id:
        STRATEGY_IDS.DIGIT_UNDER,

      name:
        'Digit Under',

      shortName:
        'Under',

      description:
        'Compares observed Digit Under frequency against its theoretical baseline.',

      category:
        'Deriv Contract',

      risk:
        'Balanced',

      recommended:
        false,

      minimumSamples:
        30,
    },
  ]);

// ============================================================
// DEFAULT STRATEGY SETTINGS
// ============================================================

export const DEFAULT_STRATEGY_CONFIG =
  Object.freeze({
    minimumTicks: 30,

    preferredTicks: 60,

    maximumTicks: 150,

    shortWindow: 20,

    mediumWindow: 40,

    longWindow: 80,

    minimumConfidence: 62,

    strongConfidence: 72,

    veryStrongConfidence: 82,

    minimumEntropy: 0.8,

    frequencyDeviation: 4,

    minimumParityEdge: 6,

    minimumOverUnderEdge: 7,

    maximumStreakForTrendEntry: 4,

    streakBreakerLength: 5,

    minimumConsensus: 2,

    maximumAdaptiveConfidence: 92,
  });

// ============================================================
// BASIC HELPERS
// ============================================================

function clamp(
  value,
  minimum,
  maximum
) {
  const numeric =
    Number(value);

  if (
    !Number.isFinite(
      numeric
    )
  ) {
    return minimum;
  }

  return Math.min(
    Math.max(
      numeric,
      minimum
    ),
    maximum
  );
}

function round(
  value,
  decimals = 2
) {
  const numeric =
    Number(value);

  if (
    !Number.isFinite(
      numeric
    )
  ) {
    return 0;
  }

  const multiplier =
    10 ** decimals;

  return (
    Math.round(
      numeric *
        multiplier
    ) /
    multiplier
  );
}

function normalizeConfidence(
  value
) {
  return clamp(
    round(
      value,
      1
    ),
    0,
    100
  );
}

function percentage(
  value,
  total
) {
  if (!total) {
    return 0;
  }

  return round(
    (
      value /
      total
    ) * 100,
    2
  );
}

function safeDigits(
  history = []
) {
  if (
    !Array.isArray(
      history
    )
  ) {
    return [];
  }

  return history
    .map((value) => {
      if (
        Number.isInteger(
          value
        )
      ) {
        return value;
      }

      if (
        value &&
        typeof value ===
          'object'
      ) {
        const candidate =
          Number(
            value.lastDigit ??
              value.last_digit ??
              value.digit
          );

        if (
          Number.isInteger(
            candidate
          )
        ) {
          return candidate;
        }
      }

      return Number(value);
    })
    .filter(
      (digit) =>
        Number.isInteger(
          digit
        ) &&
        digit >= 0 &&
        digit <= 9
    );
}

function newest(
  history,
  length
) {
  return safeDigits(
    history
  ).slice(
    0,
    Math.max(
      0,
      Number(length) || 0
    )
  );
}

function previousWindow(
  history,
  start,
  length
) {
  return safeDigits(
    history
  ).slice(
    start,
    start + length
  );
}

function buildNoSignal({
  strategyId,

  reason,

  sampleSize = 0,

  confidence = 0,

  contractType = null,

  predictionDigit = null,

  metrics = {},
}) {
  return {
    shouldTrade: false,

    strategyId,

    confidence:
      normalizeConfidence(
        confidence
      ),

    contractType,

    predictionDigit,

    reason,

    sampleSize,

    metrics,
  };
}

function buildTradeSignal({
  strategyId,

  confidence,

  contractType,

  predictionDigit = null,

  reason,

  sampleSize,

  metrics = {},
}) {
  return {
    shouldTrade: true,

    strategyId,

    confidence:
      normalizeConfidence(
        confidence
      ),

    contractType,

    predictionDigit,

    reason,

    sampleSize,

    metrics,
  };
}

// ============================================================
// DIGIT COUNTS
// ============================================================

function countDigits(
  history
) {
  const counts =
    Array(10).fill(0);

  safeDigits(
    history
  ).forEach(
    (digit) => {
      counts[digit] += 1;
    }
  );

  return counts;
}

function getDigitPercentages(
  history
) {
  const clean =
    safeDigits(
      history
    );

  const counts =
    countDigits(
      clean
    );

  const total =
    clean.length;

  return counts.map(
    (
      count,
      digit
    ) => {
      const rate =
        percentage(
          count,
          total
        );

      return {
        digit,

        count,

        percentage:
          rate,

        deviation:
          round(
            rate - 10,
            2
          ),
      };
    }
  );
}

function getEvenOddStats(
  history
) {
  const clean =
    safeDigits(
      history
    );

  const evenCount =
    clean.filter(
      (digit) =>
        digit % 2 === 0
    ).length;

  const oddCount =
    clean.length -
    evenCount;

  return {
    evenCount,

    oddCount,

    evenPercentage:
      percentage(
        evenCount,
        clean.length
      ),

    oddPercentage:
      percentage(
        oddCount,
        clean.length
      ),
  };
}

function findMostFrequentDigit(
  history
) {
  const stats =
    getDigitPercentages(
      history
    );

  return stats.reduce(
    (
      highest,
      current
    ) =>
      current.count >
      highest.count
        ? current
        : highest,
    {
      digit: 0,

      count: 0,

      percentage: 0,

      deviation: -10,
    }
  );
}

function findLeastFrequentDigit(
  history
) {
  const stats =
    getDigitPercentages(
      history
    );

  return stats.reduce(
    (
      lowest,
      current
    ) =>
      current.count <
      lowest.count
        ? current
        : lowest,
    {
      digit: 0,

      count:
        Infinity,

      percentage:
        Infinity,

      deviation: 0,
    }
  );
}

// ============================================================
// ENTROPY / DISTRIBUTION QUALITY
// ============================================================

function calculateEntropy(
  history
) {
  const clean =
    safeDigits(
      history
    );

  if (!clean.length) {
    return 0;
  }

  const counts =
    countDigits(
      clean
    );

  let entropy = 0;

  counts.forEach(
    (count) => {
      if (!count) {
        return;
      }

      const probability =
        count /
        clean.length;

      entropy -=
        probability *
        Math.log2(
          probability
        );
    }
  );

  const maximumEntropy =
    Math.log2(10);

  return round(
    entropy /
      maximumEntropy,
    4
  );
}

function getSampleScore(
  sampleSize,
  preferredTicks
) {
  if (
    !preferredTicks
  ) {
    return 0;
  }

  return clamp(
    (
      sampleSize /
      preferredTicks
    ) * 100,
    0,
    100
  );
}

// ============================================================
// STREAK ANALYSIS
// ============================================================

function getRecentStreak(
  history
) {
  const clean =
    safeDigits(
      history
    );

  if (!clean.length) {
    return {
      type: null,

      length: 0,

      lastDigit: null,
    };
  }

  const newestDigit =
    clean[0];

  const firstType =
    newestDigit % 2 === 0
      ? 'even'
      : 'odd';

  let length = 0;

  for (
    let index = 0;
    index < clean.length;
    index += 1
  ) {
    const currentType =
      clean[index] %
        2 ===
      0
        ? 'even'
        : 'odd';

    if (
      currentType !==
      firstType
    ) {
      break;
    }

    length += 1;
  }

  return {
    type:
      firstType,

    length,

    lastDigit:
      newestDigit,
  };
}

function getExactDigitStreak(
  history
) {
  const clean =
    safeDigits(
      history
    );

  if (!clean.length) {
    return {
      digit: null,

      length: 0,
    };
  }

  const target =
    clean[0];

  let length = 0;

  for (
    let index = 0;
    index < clean.length;
    index += 1
  ) {
    if (
      clean[index] !==
      target
    ) {
      break;
    }

    length += 1;
  }

  return {
    digit:
      target,

    length,
  };
}

// ============================================================
// WINDOW ANALYSIS
// ============================================================

function buildWindowAnalysis(
  history,
  config
) {
  const shortSample =
    newest(
      history,
      config.shortWindow
    );

  const mediumSample =
    newest(
      history,
      config.mediumWindow
    );

  const longSample =
    newest(
      history,
      config.longWindow
    );

  return {
    short: {
      digits:
        shortSample,

      sampleSize:
        shortSample.length,

      percentages:
        getDigitPercentages(
          shortSample
        ),

      evenOdd:
        getEvenOddStats(
          shortSample
        ),

      entropy:
        calculateEntropy(
          shortSample
        ),
    },

    medium: {
      digits:
        mediumSample,

      sampleSize:
        mediumSample.length,

      percentages:
        getDigitPercentages(
          mediumSample
        ),

      evenOdd:
        getEvenOddStats(
          mediumSample
        ),

      entropy:
        calculateEntropy(
          mediumSample
        ),
    },

    long: {
      digits:
        longSample,

      sampleSize:
        longSample.length,

      percentages:
        getDigitPercentages(
          longSample
        ),

      evenOdd:
        getEvenOddStats(
          longSample
        ),

      entropy:
        calculateEntropy(
          longSample
        ),
    },
  };
}

// ============================================================
// FREQUENCY COMPARISON
// ============================================================

function compareDigitWindows(
  shortHistory,
  longHistory
) {
  const shortStats =
    getDigitPercentages(
      shortHistory
    );

  const longStats =
    getDigitPercentages(
      longHistory
    );

  return DIGITS.map(
    (digit) => {
      const shortPercentage =
        shortStats[
          digit
        ]?.percentage || 0;

      const longPercentage =
        longStats[
          digit
        ]?.percentage || 0;

      return {
        digit,

        shortPercentage,

        longPercentage,

        change:
          round(
            shortPercentage -
              longPercentage,
            2
          ),
      };
    }
  );
}

function findLargestPositiveChange(
  comparisons
) {
  return comparisons.reduce(
    (
      strongest,
      current
    ) =>
      current.change >
      strongest.change
        ? current
        : strongest,
    {
      digit: 0,

      shortPercentage: 0,

      longPercentage: 0,

      change:
        -Infinity,
    }
  );
}

function findLargestNegativeChange(
  comparisons
) {
  return comparisons.reduce(
    (
      strongest,
      current
    ) =>
      current.change <
      strongest.change
        ? current
        : strongest,
    {
      digit: 0,

      shortPercentage: 0,

      longPercentage: 0,

      change:
        Infinity,
    }
  );
}

// ============================================================
// DIGIT DIFFERS
// ============================================================

function digitDiffersSignal(
  history,
  predictionDigit,
  config
) {
  const clean =
    safeDigits(
      history
    );

  if (
    clean.length <
    config.minimumTicks
  ) {
    return buildNoSignal({
      strategyId:
        STRATEGY_IDS.DIGIT_DIFFERS,

      contractType:
        CONTRACT_TYPES.DIFFERS,

      predictionDigit:
        Number(
          predictionDigit
        ),

      reason:
        `Waiting for at least ${config.minimumTicks} ticks.`,

      sampleSize:
        clean.length,
    });
  }

  const prediction =
    Number(
      predictionDigit
    );

  if (
    !Number.isInteger(
      prediction
    ) ||
    prediction < 0 ||
    prediction > 9
  ) {
    return buildNoSignal({
      strategyId:
        STRATEGY_IDS.DIGIT_DIFFERS,

      contractType:
        CONTRACT_TYPES.DIFFERS,

      reason:
        'Invalid prediction digit.',

      sampleSize:
        clean.length,
    });
  }

  const windows =
    buildWindowAnalysis(
      clean,
      config
    );

  const shortRate =
    100 -
    windows.short
      .percentages[
        prediction
      ].percentage;

  const mediumRate =
    100 -
    windows.medium
      .percentages[
        prediction
      ].percentage;

  const longRate =
    100 -
    windows.long
      .percentages[
        prediction
      ].percentage;

  const weightedRate =
    shortRate * 0.45 +
    mediumRate * 0.35 +
    longRate * 0.2;

  const agreement =
    [
      shortRate >= 85,
      mediumRate >= 85,
      longRate >= 85,
    ].filter(Boolean)
      .length;

  const entropy =
    windows.medium.entropy;

  const sampleScore =
    getSampleScore(
      clean.length,
      config.preferredTicks
    );

  const confidence =
    normalizeConfidence(
      weightedRate *
        0.75 +
        sampleScore *
          0.15 +
        entropy *
          100 *
          0.1
    );

  const shouldTrade =
    agreement >= 2 &&
    weightedRate >= 85 &&
    confidence >=
      config.minimumConfidence &&
    entropy >=
      config.minimumEntropy;

  if (!shouldTrade) {
    return buildNoSignal({
      strategyId:
        STRATEGY_IDS.DIGIT_DIFFERS,

      contractType:
        CONTRACT_TYPES.DIFFERS,

      predictionDigit:
        prediction,

      confidence,

      reason:
        `Digit ${prediction} does not yet have enough multi-window Differs confirmation.`,

      sampleSize:
        clean.length,

      metrics: {
        shortRate,

        mediumRate,

        longRate,

        weightedRate:
          round(
            weightedRate,
            2
          ),

        agreement,

        entropy,
      },
    });
  }

  return buildTradeSignal({
    strategyId:
      STRATEGY_IDS.DIGIT_DIFFERS,

    contractType:
      CONTRACT_TYPES.DIFFERS,

    predictionDigit:
      prediction,

    confidence,

    reason:
      `Digit ${prediction} is sufficiently underrepresented across multiple windows.`,

    sampleSize:
      clean.length,

    metrics: {
      shortRate,

      mediumRate,

      longRate,

      weightedRate:
        round(
          weightedRate,
          2
        ),

      agreement,

      entropy,
    },
  });
}

// ============================================================
// DIGIT MATCH
// ============================================================

function digitMatchSignal(
  history,
  config
) {
  const clean =
    safeDigits(
      history
    );

  if (
    clean.length <
    config.preferredTicks
  ) {
    return buildNoSignal({
      strategyId:
        STRATEGY_IDS.DIGIT_MATCHES,

      contractType:
        CONTRACT_TYPES.MATCHES,

      reason:
        `Digit Match requires at least ${config.preferredTicks} ticks.`,

      sampleSize:
        clean.length,
    });
  }

  const windows =
    buildWindowAnalysis(
      clean,
      config
    );

  const shortMost =
    findMostFrequentDigit(
      windows.short.digits
    );

  const mediumMost =
    findMostFrequentDigit(
      windows.medium.digits
    );

  const longMost =
    findMostFrequentDigit(
      windows.long.digits
    );

  const candidateDigit =
    shortMost.digit;

  const agreement =
    [
      shortMost.digit ===
        candidateDigit,
      mediumMost.digit ===
        candidateDigit,
      longMost.digit ===
        candidateDigit,
    ].filter(Boolean)
      .length;

  const mediumCandidate =
    windows.medium
      .percentages[
        candidateDigit
      ];

  const longCandidate =
    windows.long
      .percentages[
        candidateDigit
      ];

  const weightedFrequency =
    shortMost.percentage *
      0.5 +
    mediumCandidate.percentage *
      0.3 +
    longCandidate.percentage *
      0.2;

  const excess =
    Math.max(
      0,
      weightedFrequency -
        10
    );

  const confidence =
    normalizeConfidence(
      45 +
        excess * 3 +
        agreement * 5
    );

  const shouldTrade =
    agreement >= 2 &&
    shortMost.percentage >=
      15 &&
    mediumCandidate.percentage >=
      12.5 &&
    confidence >=
      config.strongConfidence;

  if (!shouldTrade) {
    return buildNoSignal({
      strategyId:
        STRATEGY_IDS.DIGIT_MATCHES,

      contractType:
        CONTRACT_TYPES.MATCHES,

      predictionDigit:
        candidateDigit,

      confidence,

      reason:
        'Digit Match has no sufficiently persistent dominant digit yet.',

      sampleSize:
        clean.length,

      metrics: {
        candidateDigit,

        shortFrequency:
          shortMost.percentage,

        mediumFrequency:
          mediumCandidate.percentage,

        longFrequency:
          longCandidate.percentage,

        weightedFrequency:
          round(
            weightedFrequency,
            2
          ),

        agreement,
      },
    });
  }

  return buildTradeSignal({
    strategyId:
      STRATEGY_IDS.DIGIT_MATCHES,

    contractType:
      CONTRACT_TYPES.MATCHES,

    predictionDigit:
      candidateDigit,

    confidence,

    reason:
      `Digit ${candidateDigit} is persistently dominant across multiple windows.`,

    sampleSize:
      clean.length,

    metrics: {
      candidateDigit,

      shortFrequency:
        shortMost.percentage,

      mediumFrequency:
        mediumCandidate.percentage,

      longFrequency:
        longCandidate.percentage,

      weightedFrequency:
        round(
          weightedFrequency,
          2
        ),

      agreement,
    },
  });
}

// ============================================================
// EVEN / ODD
// ============================================================

function evenOddSignal(
  history,
  contractType,
  config
) {
  const clean =
    safeDigits(
      history
    );

  const strategyId =
    contractType ===
      CONTRACT_TYPES.EVEN
      ? STRATEGY_IDS.DIGIT_EVEN
      : STRATEGY_IDS.DIGIT_ODD;

  if (
    clean.length <
    config.minimumTicks
  ) {
    return buildNoSignal({
      strategyId,

      contractType,

      reason:
        `Waiting for at least ${config.minimumTicks} ticks.`,

      sampleSize:
        clean.length,
    });
  }

  const windows =
    buildWindowAnalysis(
      clean,
      config
    );

  const streak =
    getRecentStreak(
      clean
    );

  const target =
    contractType ===
      CONTRACT_TYPES.EVEN
      ? 'even'
      : 'odd';

  const shortRate =
    target === 'even'
      ? windows.short
          .evenOdd
          .evenPercentage
      : windows.short
          .evenOdd
          .oddPercentage;

  const mediumRate =
    target === 'even'
      ? windows.medium
          .evenOdd
          .evenPercentage
      : windows.medium
          .evenOdd
          .oddPercentage;

  const longRate =
    target === 'even'
      ? windows.long
          .evenOdd
          .evenPercentage
      : windows.long
          .evenOdd
          .oddPercentage;

  const weightedRate =
    shortRate * 0.45 +
    mediumRate * 0.35 +
    longRate * 0.2;

  const agreement =
    [
      shortRate >= 53,
      mediumRate >= 53,
      longRate >= 53,
    ].filter(Boolean)
      .length;

  const edge =
    Math.max(
      0,
      weightedRate -
        50
    );

  const confidence =
    normalizeConfidence(
      55 +
        edge * 2.4 +
        agreement * 2
    );

  const streakBlocked =
    streak.type ===
      target &&
    streak.length >=
      config
        .maximumStreakForTrendEntry;

  const shouldTrade =
    weightedRate >=
      50 +
        config.minimumParityEdge &&
    agreement >= 2 &&
    !streakBlocked &&
    confidence >=
      config.minimumConfidence;

  if (!shouldTrade) {
    return buildNoSignal({
      strategyId,

      contractType,

      confidence,

      reason:
        streakBlocked
          ? `${target} entry blocked because the current ${target} streak is already ${streak.length} ticks.`
          : `${target} distribution does not yet have enough multi-window confirmation.`,

      sampleSize:
        clean.length,

      metrics: {
        target,

        shortRate,

        mediumRate,

        longRate,

        weightedRate:
          round(
            weightedRate,
            2
          ),

        agreement,

        streak,
      },
    });
  }

  return buildTradeSignal({
    strategyId,

    contractType,

    confidence,

    reason:
      `${target.toUpperCase()} bias is confirmed across multiple analysis windows.`,

    sampleSize:
      clean.length,

    metrics: {
      target,

      shortRate,

      mediumRate,

      longRate,

      weightedRate:
        round(
          weightedRate,
          2
        ),

      agreement,

      streak,
    },
  });
}

// ============================================================
// DIGIT OVER
// ============================================================

function digitOverSignal(
  history,
  predictionDigit,
  config
) {
  const clean =
    safeDigits(
      history
    );

  const barrier =
    Number(
      predictionDigit
    );

  if (
    !Number.isInteger(
      barrier
    ) ||
    barrier < 0 ||
    barrier > 8
  ) {
    return buildNoSignal({
      strategyId:
        STRATEGY_IDS.DIGIT_OVER,

      contractType:
        CONTRACT_TYPES.OVER,

      reason:
        'Digit Over barrier must be between 0 and 8.',

      sampleSize:
        clean.length,
    });
  }

  if (
    clean.length <
    config.minimumTicks
  ) {
    return buildNoSignal({
      strategyId:
        STRATEGY_IDS.DIGIT_OVER,

      contractType:
        CONTRACT_TYPES.OVER,

      predictionDigit:
        barrier,

      reason:
        `Waiting for at least ${config.minimumTicks} ticks.`,

      sampleSize:
        clean.length,
    });
  }

  const windows =
    buildWindowAnalysis(
      clean,
      config
    );

  const calculateRate = (
    sample
  ) =>
    percentage(
      sample.filter(
        (digit) =>
          digit > barrier
      ).length,
      sample.length
    );

  const shortRate =
    calculateRate(
      windows.short.digits
    );

  const mediumRate =
    calculateRate(
      windows.medium.digits
    );

  const longRate =
    calculateRate(
      windows.long.digits
    );

  const theoreticalRate =
    (9 - barrier) * 10;

  const weightedRate =
    shortRate * 0.45 +
    mediumRate * 0.35 +
    longRate * 0.2;

  const excess =
    weightedRate -
    theoreticalRate;

  const agreement =
    [
      shortRate >
        theoreticalRate,
      mediumRate >
        theoreticalRate,
      longRate >
        theoreticalRate,
    ].filter(Boolean)
      .length;

  const confidence =
    normalizeConfidence(
      55 +
        Math.max(
          0,
          excess
        ) *
          1.6 +
        agreement * 2
    );

  const shouldTrade =
    agreement >= 2 &&
    excess >=
      config.minimumOverUnderEdge &&
    confidence >=
      config.minimumConfidence;

  if (!shouldTrade) {
    return buildNoSignal({
      strategyId:
        STRATEGY_IDS.DIGIT_OVER,

      contractType:
        CONTRACT_TYPES.OVER,

      predictionDigit:
        barrier,

      confidence,

      reason:
        `Over ${barrier} does not have enough confirmed distribution edge.`,

      sampleSize:
        clean.length,

      metrics: {
        barrier,

        shortRate,

        mediumRate,

        longRate,

        theoreticalRate,

        weightedRate:
          round(
            weightedRate,
            2
          ),

        excess:
          round(
            excess,
            2
          ),

        agreement,
      },
    });
  }

  return buildTradeSignal({
    strategyId:
      STRATEGY_IDS.DIGIT_OVER,

    contractType:
      CONTRACT_TYPES.OVER,

    predictionDigit:
      barrier,

    confidence,

    reason:
      `Digits above ${barrier} are outperforming their theoretical baseline across multiple windows.`,

    sampleSize:
      clean.length,

    metrics: {
      barrier,

      shortRate,

      mediumRate,

      longRate,

      theoreticalRate,

      weightedRate:
        round(
          weightedRate,
          2
        ),

      excess:
        round(
          excess,
          2
        ),

      agreement,
    },
  });
}

// ============================================================
// DIGIT UNDER
// ============================================================

function digitUnderSignal(
  history,
  predictionDigit,
  config
) {
  const clean =
    safeDigits(
      history
    );

  const barrier =
    Number(
      predictionDigit
    );

  if (
    !Number.isInteger(
      barrier
    ) ||
    barrier < 1 ||
    barrier > 9
  ) {
    return buildNoSignal({
      strategyId:
        STRATEGY_IDS.DIGIT_UNDER,

      contractType:
        CONTRACT_TYPES.UNDER,

      reason:
        'Digit Under barrier must be between 1 and 9.',

      sampleSize:
        clean.length,
    });
  }

  if (
    clean.length <
    config.minimumTicks
  ) {
    return buildNoSignal({
      strategyId:
        STRATEGY_IDS.DIGIT_UNDER,

      contractType:
        CONTRACT_TYPES.UNDER,

      predictionDigit:
        barrier,

      reason:
        `Waiting for at least ${config.minimumTicks} ticks.`,

      sampleSize:
        clean.length,
    });
  }

  const windows =
    buildWindowAnalysis(
      clean,
      config
    );

  const calculateRate = (
    sample
  ) =>
    percentage(
      sample.filter(
        (digit) =>
          digit < barrier
      ).length,
      sample.length
    );

  const shortRate =
    calculateRate(
      windows.short.digits
    );

  const mediumRate =
    calculateRate(
      windows.medium.digits
    );

  const longRate =
    calculateRate(
      windows.long.digits
    );

  const theoreticalRate =
    barrier * 10;

  const weightedRate =
    shortRate * 0.45 +
    mediumRate * 0.35 +
    longRate * 0.2;

  const excess =
    weightedRate -
    theoreticalRate;

  const agreement =
    [
      shortRate >
        theoreticalRate,
      mediumRate >
        theoreticalRate,
      longRate >
        theoreticalRate,
    ].filter(Boolean)
      .length;

  const confidence =
    normalizeConfidence(
      55 +
        Math.max(
          0,
          excess
        ) *
          1.6 +
        agreement * 2
    );

  const shouldTrade =
    agreement >= 2 &&
    excess >=
      config.minimumOverUnderEdge &&
    confidence >=
      config.minimumConfidence;

  if (!shouldTrade) {
    return buildNoSignal({
      strategyId:
        STRATEGY_IDS.DIGIT_UNDER,

      contractType:
        CONTRACT_TYPES.UNDER,

      predictionDigit:
        barrier,

      confidence,

      reason:
        `Under ${barrier} does not have enough confirmed distribution edge.`,

      sampleSize:
        clean.length,

      metrics: {
        barrier,

        shortRate,

        mediumRate,

        longRate,

        theoreticalRate,

        weightedRate:
          round(
            weightedRate,
            2
          ),

        excess:
          round(
            excess,
            2
          ),

        agreement,
      },
    });
  }

  return buildTradeSignal({
    strategyId:
      STRATEGY_IDS.DIGIT_UNDER,

    contractType:
      CONTRACT_TYPES.UNDER,

    predictionDigit:
      barrier,

    confidence,

    reason:
      `Digits below ${barrier} are outperforming their theoretical baseline across multiple windows.`,

    sampleSize:
      clean.length,

    metrics: {
      barrier,

      shortRate,

      mediumRate,

      longRate,

      theoreticalRate,

      weightedRate:
        round(
          weightedRate,
          2
        ),

      excess:
        round(
          excess,
          2
        ),

      agreement,
    },
  });
}

// ============================================================
// HOT / COLD ANALYSIS
// ============================================================

export function analyzeHotCold(
  digitHistory = [],
  configOverrides = {}
) {
  const config = {
    ...DEFAULT_STRATEGY_CONFIG,

    ...configOverrides,
  };

  const history =
    safeDigits(
      digitHistory
    ).slice(
      0,
      config.maximumTicks
    );

  if (
    history.length <
    config.minimumTicks
  ) {
    return {
      ready: false,

      hotDigit: null,

      coldDigit: null,

      hotChange: 0,

      coldChange: 0,

      confidence: 0,

      comparisons: [],

      reason:
        `Waiting for at least ${config.minimumTicks} ticks.`,
    };
  }

  const shortSample =
    newest(
      history,
      config.shortWindow
    );

  const longSample =
    newest(
      history,
      config.longWindow
    );

  const comparisons =
    compareDigitWindows(
      shortSample,
      longSample
    );

  const hottest =
    findLargestPositiveChange(
      comparisons
    );

  const coldest =
    findLargestNegativeChange(
      comparisons
    );

  const strongestMove =
    Math.max(
      Math.abs(
        hottest.change
      ),
      Math.abs(
        coldest.change
      )
    );

  const confidence =
    normalizeConfidence(
      50 +
        strongestMove * 3
    );

  return {
    ready:
      strongestMove >=
      config.frequencyDeviation,

    hotDigit:
      hottest.digit,

    coldDigit:
      coldest.digit,

    hotChange:
      hottest.change,

    coldChange:
      coldest.change,

    confidence,

    comparisons,

    reason:
      strongestMove >=
      config.frequencyDeviation
        ? `Digit ${hottest.digit} is currently hottest while digit ${coldest.digit} is currently coldest.`
        : 'Digit frequencies are currently close to their longer-term distribution.',
  };
}

// ============================================================
// ADVANCED FREQUENCY STRATEGY
// ============================================================

export function evaluateFrequencyStrategy({
  digitHistory = [],

  config:
    configOverrides = {},
} = {}) {
  const config = {
    ...DEFAULT_STRATEGY_CONFIG,

    ...configOverrides,
  };

  const history =
    safeDigits(
      digitHistory
    ).slice(
      0,
      config.maximumTicks
    );

  if (
    history.length <
    config.minimumTicks
  ) {
    return buildNoSignal({
      strategyId:
        STRATEGY_IDS.FREQUENCY,

      reason:
        `Frequency strategy requires at least ${config.minimumTicks} ticks.`,

      sampleSize:
        history.length,
    });
  }

  const hotCold =
    analyzeHotCold(
      history,
      config
    );

  if (!hotCold.ready) {
    return buildNoSignal({
      strategyId:
        STRATEGY_IDS.FREQUENCY,

      confidence:
        hotCold.confidence,

      reason:
        hotCold.reason,

      sampleSize:
        history.length,

      metrics: {
        hotDigit:
          hotCold.hotDigit,

        coldDigit:
          hotCold.coldDigit,

        hotChange:
          hotCold.hotChange,

        coldChange:
          hotCold.coldChange,
      },
    });
  }

  /*
   * Frequency strategy avoids assuming that
   * an underrepresented digit must immediately
   * "catch up".
   *
   * The current implementation uses the
   * overrepresented digit as a DIGITDIFF
   * barrier candidate instead.
   */

  const targetDigit =
    hotCold.hotDigit;

  const baseSignal =
    digitDiffersSignal(
      history,
      targetDigit,
      config
    );

  const confidence =
    normalizeConfidence(
      baseSignal.confidence *
        0.7 +
        hotCold.confidence *
          0.3
    );

  if (
    !baseSignal.shouldTrade ||
    confidence <
      config.minimumConfidence
  ) {
    return buildNoSignal({
      strategyId:
        STRATEGY_IDS.FREQUENCY,

      contractType:
        CONTRACT_TYPES.DIFFERS,

      predictionDigit:
        targetDigit,

      confidence,

      reason:
        'Frequency displacement exists, but the execution signal is not yet strong enough.',

      sampleSize:
        history.length,

      metrics: {
        hotCold,

        execution:
          baseSignal.metrics ||
          {},
      },
    });
  }

  return buildTradeSignal({
    strategyId:
      STRATEGY_IDS.FREQUENCY,

    contractType:
      CONTRACT_TYPES.DIFFERS,

    predictionDigit:
      targetDigit,

    confidence,

    reason:
      `Frequency Edge identified digit ${targetDigit} as the strongest Differs candidate.`,

    sampleSize:
      history.length,

    metrics: {
      hotCold,

      execution:
        baseSignal.metrics ||
        {},
    },
  });
}

// ============================================================
// ADVANCED HOT / COLD STRATEGY
// ============================================================

export function evaluateHotColdStrategy({
  digitHistory = [],

  config:
    configOverrides = {},
} = {}) {
  const config = {
    ...DEFAULT_STRATEGY_CONFIG,

    ...configOverrides,
  };

  const history =
    safeDigits(
      digitHistory
    ).slice(
      0,
      config.maximumTicks
    );

  const analysis =
    analyzeHotCold(
      history,
      config
    );

  if (!analysis.ready) {
    return buildNoSignal({
      strategyId:
        STRATEGY_IDS.HOT_COLD,

      confidence:
        analysis.confidence,

      reason:
        analysis.reason,

      sampleSize:
        history.length,

      metrics:
        analysis,
    });
  }

  const targetDigit =
    analysis.hotDigit;

  const differs =
    digitDiffersSignal(
      history,
      targetDigit,
      config
    );

  const confidence =
    normalizeConfidence(
      analysis.confidence *
        0.4 +
        differs.confidence *
          0.6
    );

  if (
    !differs.shouldTrade ||
    confidence <
      config.minimumConfidence
  ) {
    return buildNoSignal({
      strategyId:
        STRATEGY_IDS.HOT_COLD,

      contractType:
        CONTRACT_TYPES.DIFFERS,

      predictionDigit:
        targetDigit,

      confidence,

      reason:
        'Hot/Cold displacement is visible, but the corresponding Differs entry is not confirmed.',

      sampleSize:
        history.length,

      metrics: {
        analysis,

        execution:
          differs.metrics ||
          {},
      },
    });
  }

  return buildTradeSignal({
    strategyId:
      STRATEGY_IDS.HOT_COLD,

    contractType:
      CONTRACT_TYPES.DIFFERS,

    predictionDigit:
      targetDigit,

    confidence,

    reason:
      `Hot/Cold analysis selected digit ${targetDigit} for a confirmed Differs setup.`,

    sampleSize:
      history.length,

    metrics: {
      analysis,

      execution:
        differs.metrics ||
        {},
    },
  });
}

// ============================================================
// MEAN REVERSION ANALYSIS
// ============================================================

export function analyzeMeanReversion(
  digitHistory = [],
  configOverrides = {}
) {
  const config = {
    ...DEFAULT_STRATEGY_CONFIG,

    ...configOverrides,
  };

  const history =
    safeDigits(
      digitHistory
    ).slice(
      0,
      config.maximumTicks
    );

  if (
    history.length <
    config.preferredTicks
  ) {
    return {
      ready: false,

      confidence: 0,

      overextendedDigit: null,

      underrepresentedDigit:
        null,

      displacement: 0,

      reason:
        `Mean reversion requires at least ${config.preferredTicks} ticks.`,
    };
  }

  const shortSample =
    newest(
      history,
      config.shortWindow
    );

  const longSample =
    newest(
      history,
      config.longWindow
    );

  const comparisons =
    compareDigitWindows(
      shortSample,
      longSample
    );

  const overextended =
    findLargestPositiveChange(
      comparisons
    );

  const underrepresented =
    findLargestNegativeChange(
      comparisons
    );

  const displacement =
    Math.max(
      Math.abs(
        overextended.change
      ),
      Math.abs(
        underrepresented.change
      )
    );

  const confidence =
    normalizeConfidence(
      50 +
        displacement * 2.5
    );

  return {
    ready:
      displacement >=
      config.frequencyDeviation *
        1.5,

    confidence,

    overextendedDigit:
      overextended.digit,

    underrepresentedDigit:
      underrepresented.digit,

    displacement:
      round(
        displacement,
        2
      ),

    comparisons,

    reason:
      displacement >=
      config.frequencyDeviation *
        1.5
        ? `Digit ${overextended.digit} is overextended relative to its longer-term distribution.`
        : 'No sufficiently stretched digit distribution is currently present.',
  };
}

// ============================================================
// ADVANCED MEAN REVERSION STRATEGY
// ============================================================

export function evaluateMeanReversionStrategy({
  digitHistory = [],

  config:
    configOverrides = {},
} = {}) {
  const config = {
    ...DEFAULT_STRATEGY_CONFIG,

    ...configOverrides,
  };

  const history =
    safeDigits(
      digitHistory
    ).slice(
      0,
      config.maximumTicks
    );

  const reversion =
    analyzeMeanReversion(
      history,
      config
    );

  if (!reversion.ready) {
    return buildNoSignal({
      strategyId:
        STRATEGY_IDS.MEAN_REVERSION,

      confidence:
        reversion.confidence,

      reason:
        reversion.reason,

      sampleSize:
        history.length,

      metrics:
        reversion,
    });
  }

  /*
   * We do NOT assume an underrepresented digit
   * will suddenly match next.
   *
   * Instead, the overextended digit becomes a
   * controlled DIGITDIFF candidate.
   */

  const targetDigit =
    reversion.overextendedDigit;

  const differs =
    digitDiffersSignal(
      history,
      targetDigit,
      config
    );

  const confidence =
    normalizeConfidence(
      reversion.confidence *
        0.35 +
        differs.confidence *
          0.65
    );

  if (
    !differs.shouldTrade ||
    confidence <
      config.minimumConfidence
  ) {
    return buildNoSignal({
      strategyId:
        STRATEGY_IDS.MEAN_REVERSION,

      contractType:
        CONTRACT_TYPES.DIFFERS,

      predictionDigit:
        targetDigit,

      confidence,

      reason:
        'Mean-reversion stretch exists, but the execution filter is not strong enough yet.',

      sampleSize:
        history.length,

      metrics: {
        reversion,

        execution:
          differs.metrics ||
          {},
      },
    });
  }

  return buildTradeSignal({
    strategyId:
      STRATEGY_IDS.MEAN_REVERSION,

    contractType:
      CONTRACT_TYPES.DIFFERS,

    predictionDigit:
      targetDigit,

    confidence,

    reason:
      `Mean Reversion identified overextended digit ${targetDigit} as a qualified Differs candidate.`,

    sampleSize:
      history.length,

    metrics: {
      reversion,

      execution:
        differs.metrics ||
        {},
    },
  });
}

// ============================================================
// MOMENTUM ANALYSIS
// ============================================================

export function analyzeMomentum(
  digitHistory = [],
  configOverrides = {}
) {
  const config = {
    ...DEFAULT_STRATEGY_CONFIG,

    ...configOverrides,
  };

  const history =
    safeDigits(
      digitHistory
    ).slice(
      0,
      config.maximumTicks
    );

  const windowSize =
    config.shortWindow;

  if (
    history.length <
    windowSize * 2
  ) {
    return {
      ready: false,

      direction: null,

      confidence: 0,

      suggestedContract:
        null,

      suggestedBarrier:
        null,

      reason:
        'Waiting for two complete momentum windows.',
    };
  }

  const recent =
    previousWindow(
      history,
      0,
      windowSize
    );

  const previous =
    previousWindow(
      history,
      windowSize,
      windowSize
    );

  const average = (
    sample
  ) =>
    sample.reduce(
      (
        total,
        digit
      ) =>
        total + digit,
      0
    ) /
    sample.length;

  const recentAverage =
    average(
      recent
    );

  const previousAverage =
    average(
      previous
    );

  const movement =
    recentAverage -
    previousAverage;

  const strength =
    Math.abs(
      movement
    );

  const direction =
    movement > 0
      ? 'UP'
      : movement < 0
      ? 'DOWN'
      : 'FLAT';

  const confidence =
    normalizeConfidence(
      50 +
        strength * 12
    );

  return {
    ready:
      strength >= 0.7,

    direction,

    confidence,

    recentAverage:
      round(
        recentAverage,
        2
      ),

    previousAverage:
      round(
        previousAverage,
        2
      ),

    movement:
      round(
        movement,
        2
      ),

    suggestedContract:
      movement > 0
        ? CONTRACT_TYPES.OVER
        : movement < 0
        ? CONTRACT_TYPES.UNDER
        : null,

    suggestedBarrier:
      movement > 0
        ? 4
        : movement < 0
        ? 5
        : null,

    reason:
      strength >= 0.7
        ? `Digit average momentum is ${direction.toLowerCase()}.`
        : 'Recent digit momentum is weak.',
  };
}

// ============================================================
// ADVANCED MOMENTUM STRATEGY
// ============================================================

export function evaluateMomentumStrategy({
  digitHistory = [],

  config:
    configOverrides = {},
} = {}) {
  const config = {
    ...DEFAULT_STRATEGY_CONFIG,

    ...configOverrides,
  };

  const history =
    safeDigits(
      digitHistory
    ).slice(
      0,
      config.maximumTicks
    );

  const momentum =
    analyzeMomentum(
      history,
      config
    );

  if (
    !momentum.ready ||
    !momentum.suggestedContract
  ) {
    return buildNoSignal({
      strategyId:
        STRATEGY_IDS.MOMENTUM,

      confidence:
        momentum.confidence,

      reason:
        momentum.reason,

      sampleSize:
        history.length,

      metrics:
        momentum,
    });
  }

  let execution;

  if (
    momentum.suggestedContract ===
    CONTRACT_TYPES.OVER
  ) {
    execution =
      digitOverSignal(
        history,
        momentum.suggestedBarrier,
        config
      );
  } else {
    execution =
      digitUnderSignal(
        history,
        momentum.suggestedBarrier,
        config
      );
  }

  const confidence =
    normalizeConfidence(
      momentum.confidence *
        0.4 +
        execution.confidence *
          0.6
    );

  if (
    !execution.shouldTrade ||
    confidence <
      config.minimumConfidence
  ) {
    return buildNoSignal({
      strategyId:
        STRATEGY_IDS.MOMENTUM,

      contractType:
        momentum.suggestedContract,

      predictionDigit:
        momentum.suggestedBarrier,

      confidence,

      reason:
        'Momentum is present, but the corresponding Over/Under distribution is not confirmed.',

      sampleSize:
        history.length,

      metrics: {
        momentum,

        execution:
          execution.metrics ||
          {},
      },
    });
  }

  return buildTradeSignal({
    strategyId:
      STRATEGY_IDS.MOMENTUM,

    contractType:
      momentum.suggestedContract,

    predictionDigit:
      momentum.suggestedBarrier,

    confidence,

    reason:
      `Momentum and ${
        momentum.suggestedContract ===
        CONTRACT_TYPES.OVER
          ? 'Over'
          : 'Under'
      } distribution filters agree.`,

    sampleSize:
      history.length,

    metrics: {
      momentum,

      execution:
        execution.metrics ||
        {},
    },
  });
}

// ============================================================
// STREAK BREAKER ANALYSIS
// ============================================================

export function analyzeStreakBreaker(
  digitHistory = [],
  configOverrides = {}
) {
  const config = {
    ...DEFAULT_STRATEGY_CONFIG,

    ...configOverrides,
  };

  const history =
    safeDigits(
      digitHistory
    );

  const streak =
    getRecentStreak(
      history
    );

  if (
    streak.length <
    config.streakBreakerLength
  ) {
    return {
      ready: false,

      streak,

      confidence: 0,

      suggestedContract:
        null,

      reason:
        `Current ${streak.type || 'none'} streak is ${streak.length} ticks.`,
    };
  }

  const excess =
    streak.length -
    config.streakBreakerLength;

  const confidence =
    normalizeConfidence(
      Math.min(
        78,
        62 +
          excess * 3
      )
    );

  return {
    ready: true,

    streak,

    confidence,

    suggestedContract:
      streak.type ===
        'even'
        ? CONTRACT_TYPES.ODD
        : CONTRACT_TYPES.EVEN,

    reason:
      `${streak.length} consecutive ${streak.type} digits detected.`,
  };
}

// ============================================================
// ADVANCED STREAK BREAKER STRATEGY
// ============================================================

export function evaluateStreakBreakerStrategy({
  digitHistory = [],

  config:
    configOverrides = {},
} = {}) {
  const config = {
    ...DEFAULT_STRATEGY_CONFIG,

    ...configOverrides,
  };

  const history =
    safeDigits(
      digitHistory
    ).slice(
      0,
      config.maximumTicks
    );

  const streak =
    analyzeStreakBreaker(
      history,
      config
    );

  if (!streak.ready) {
    return buildNoSignal({
      strategyId:
        STRATEGY_IDS.STREAK_BREAKER,

      reason:
        streak.reason,

      sampleSize:
        history.length,

      metrics:
        streak,
    });
  }

  const paritySignal =
    evenOddSignal(
      history,
      streak.suggestedContract,
      {
        ...config,

        /*
         * Streak Breaker is intentionally
         * evaluated separately from trend
         * parity entries, so the normal
         * streak-block rule is relaxed here.
         */

        maximumStreakForTrendEntry:
          Number.MAX_SAFE_INTEGER,
      }
    );

  const confidence =
    normalizeConfidence(
      streak.confidence *
        0.45 +
        paritySignal.confidence *
          0.55
    );

  /*
   * We still require supporting distribution
   * evidence. A streak alone is not treated
   * as sufficient evidence because that would
   * rely too heavily on gambler's-fallacy logic.
   */

  if (
    !paritySignal.shouldTrade ||
    confidence <
      config.minimumConfidence
  ) {
    return buildNoSignal({
      strategyId:
        STRATEGY_IDS.STREAK_BREAKER,

      contractType:
        streak.suggestedContract,

      confidence,

      reason:
        'A long parity streak exists, but the reversal direction lacks enough supporting distribution evidence.',

      sampleSize:
        history.length,

      metrics: {
        streak,

        parity:
          paritySignal.metrics ||
          {},
      },
    });
  }

  return buildTradeSignal({
    strategyId:
      STRATEGY_IDS.STREAK_BREAKER,

    contractType:
      streak.suggestedContract,

    confidence,

    reason:
      `${streak.streak.length}-tick ${streak.streak.type} streak has supporting parity confirmation for a reversal candidate.`,

    sampleSize:
      history.length,

    metrics: {
      streak,

      parity:
        paritySignal.metrics ||
        {},
    },
  });
}

// ============================================================
// ADAPTIVE STRATEGY
// ============================================================

export function evaluateAdaptiveStrategy({
  digitHistory = [],

  config:
    configOverrides = {},
} = {}) {
  const config = {
    ...DEFAULT_STRATEGY_CONFIG,

    ...configOverrides,
  };

  const history =
    safeDigits(
      digitHistory
    ).slice(
      0,
      config.maximumTicks
    );

  if (
    history.length <
    config.preferredTicks
  ) {
    return buildNoSignal({
      strategyId:
        STRATEGY_IDS.ADAPTIVE,

      reason:
        `Adaptive strategy requires at least ${config.preferredTicks} ticks.`,

      sampleSize:
        history.length,
    });
  }

  const candidates = [
    evaluateFrequencyStrategy({
      digitHistory:
        history,

      config,
    }),

    evaluateHotColdStrategy({
      digitHistory:
        history,

      config,
    }),

    evaluateMeanReversionStrategy({
      digitHistory:
        history,

      config,
    }),

    evaluateMomentumStrategy({
      digitHistory:
        history,

      config,
    }),

    evaluateStreakBreakerStrategy({
      digitHistory:
        history,

      config,
    }),
  ].filter(
    (result) =>
      result.shouldTrade
  );

  if (!candidates.length) {
    return buildNoSignal({
      strategyId:
        STRATEGY_IDS.ADAPTIVE,

      reason:
        'No advanced strategy currently has enough evidence for an adaptive entry.',

      sampleSize:
        history.length,

      metrics: {
        activeSignals: 0,

        consensus: 0,
      },
    });
  }

  /*
   * Group by the actual Deriv execution:
   *
   * DIGITDIFF:7
   * DIGITOVER:4
   * DIGITODD:none
   *
   * This is the key separation between a
   * BinarySpot strategy and a Deriv contract.
   */

  const groups =
    new Map();

  candidates.forEach(
    (candidate) => {
      const key =
        `${candidate.contractType}:${candidate.predictionDigit ?? ''}`;

      const existing =
        groups.get(
          key
        ) || [];

      existing.push(
        candidate
      );

      groups.set(
        key,
        existing
      );
    }
  );

  const ranked =
    Array.from(
      groups.values()
    ).sort(
      (
        first,
        second
      ) => {
        if (
          second.length !==
          first.length
        ) {
          return (
            second.length -
            first.length
          );
        }

        const average = (
          group
        ) =>
          group.reduce(
            (
              total,
              item
            ) =>
              total +
              item.confidence,
            0
          ) /
          group.length;

        return (
          average(second) -
          average(first)
        );
      }
    );

  const winner =
    ranked[0];

  const consensus =
    winner.length;

  const averageConfidence =
    winner.reduce(
      (
        total,
        item
      ) =>
        total +
        item.confidence,
      0
    ) /
    winner.length;

  const consensusBonus =
    Math.min(
      10,
      Math.max(
        0,
        consensus - 1
      ) * 4
    );

  const confidence =
    normalizeConfidence(
      Math.min(
        config.maximumAdaptiveConfidence,
        averageConfidence +
          consensusBonus
      )
    );

  const leader =
    [...winner].sort(
      (
        first,
        second
      ) =>
        second.confidence -
        first.confidence
    )[0];

  const shouldTrade =
    consensus >=
      config.minimumConsensus &&
    confidence >=
      config.minimumConfidence;

  if (!shouldTrade) {
    return buildNoSignal({
      strategyId:
        STRATEGY_IDS.ADAPTIVE,

      contractType:
        leader.contractType,

      predictionDigit:
        leader.predictionDigit,

      confidence,

      reason:
        `Only ${consensus} strategy filter supports the leading execution. ${config.minimumConsensus} are required.`,

      sampleSize:
        history.length,

      metrics: {
        consensus,

        activeSignals:
          candidates.length,

        contributingStrategies:
          winner.map(
            (item) =>
              item.strategyId
          ),

        candidates,
      },
    });
  }

  return buildTradeSignal({
    strategyId:
      STRATEGY_IDS.ADAPTIVE,

    contractType:
      leader.contractType,

    predictionDigit:
      leader.predictionDigit,

    confidence,

    reason:
      `${consensus} strategy filters agree on ${leader.contractType}${
        leader.predictionDigit !==
          null &&
        leader.predictionDigit !==
          undefined
          ? ` with barrier ${leader.predictionDigit}`
          : ''
      }.`,

    sampleSize:
      history.length,

    metrics: {
      consensus,

      activeSignals:
        candidates.length,

      contributingStrategies:
        winner.map(
          (item) =>
            item.strategyId
        ),

      candidates,

      entropy:
        calculateEntropy(
          history
        ),
    },
  });
}

// ============================================================
// MASTER SIGNAL FUNCTION
// ============================================================

export function evaluateEntrySignal({
  strategy,

  digitHistory = [],

  predictionDigit = 0,

  config:
    configOverrides = {},
}) {
  const config = {
    ...DEFAULT_STRATEGY_CONFIG,

    ...configOverrides,
  };

  const history =
    safeDigits(
      digitHistory
    ).slice(
      0,
      config.maximumTicks
    );

  if (!history.length) {
    return {
      shouldTrade: false,

      strategyId:
        strategy,

      strategy,

      confidence: 0,

      contractType:
        null,

      predictionDigit:
        null,

      reason:
        'Waiting for market data.',

      sampleSize: 0,

      lastDigit: null,

      metrics: {},
    };
  }

  let result;

  switch (strategy) {
    case STRATEGY_IDS.DIGIT_DIFFERS:
      result =
        digitDiffersSignal(
          history,
          predictionDigit,
          config
        );
      break;

    case STRATEGY_IDS.DIGIT_MATCHES:
      result =
        digitMatchSignal(
          history,
          config
        );
      break;

    case STRATEGY_IDS.DIGIT_EVEN:
      result =
        evenOddSignal(
          history,
          CONTRACT_TYPES.EVEN,
          config
        );
      break;

    case STRATEGY_IDS.DIGIT_ODD:
      result =
        evenOddSignal(
          history,
          CONTRACT_TYPES.ODD,
          config
        );
      break;

    case STRATEGY_IDS.DIGIT_OVER:
      result =
        digitOverSignal(
          history,
          predictionDigit,
          config
        );
      break;

    case STRATEGY_IDS.DIGIT_UNDER:
      result =
        digitUnderSignal(
          history,
          predictionDigit,
          config
        );
      break;

    case STRATEGY_IDS.FREQUENCY:
      result =
        evaluateFrequencyStrategy({
          digitHistory:
            history,

          config,
        });
      break;

    case STRATEGY_IDS.HOT_COLD:
      result =
        evaluateHotColdStrategy({
          digitHistory:
            history,

          config,
        });
      break;

    case STRATEGY_IDS.MEAN_REVERSION:
      result =
        evaluateMeanReversionStrategy({
          digitHistory:
            history,

          config,
        });
      break;

    case STRATEGY_IDS.STREAK_BREAKER:
      result =
        evaluateStreakBreakerStrategy({
          digitHistory:
            history,

          config,
        });
      break;

    case STRATEGY_IDS.MOMENTUM:
      result =
        evaluateMomentumStrategy({
          digitHistory:
            history,

          config,
        });
      break;

    case STRATEGY_IDS.ADAPTIVE:
      result =
        evaluateAdaptiveStrategy({
          digitHistory:
            history,

          config,
        });
      break;

    default:
      result =
        buildNoSignal({
          strategyId:
            strategy,

          reason:
            'Unsupported strategy.',

          sampleSize:
            history.length,
        });
  }

  /*
   * Compatibility layer:
   *
   * Existing page.jsx expects:
   *
   * strategy
   * shouldTrade
   * confidence
   * reason
   * sampleSize
   * lastDigit
   * predictionDigit
   *
   * New page.jsx will additionally use:
   *
   * strategyId
   * contractType
   * metrics
   */

  return {
    strategy,

    strategyId:
      result.strategyId ||
      strategy,

    sampleSize:
      history.length,

    lastDigit:
      history[0] ??
      null,

    ...result,
  };
}

// ============================================================
// EXECUTION NORMALIZER
// ============================================================

export function getExecutionFromSignal(
  signal
) {
  if (
    !signal ||
    typeof signal !==
      'object'
  ) {
    return {
      valid: false,

      contractType:
        null,

      predictionDigit:
        null,

      reason:
        'Signal is unavailable.',
    };
  }

  const contractType =
    signal.contractType;

  const supported =
    Object.values(
      CONTRACT_TYPES
    ).includes(
      contractType
    );

  if (!supported) {
    return {
      valid: false,

      contractType:
        null,

      predictionDigit:
        null,

      reason:
        'Signal does not contain a supported Deriv contract type.',
    };
  }

  const requiresBarrier =
    [
      CONTRACT_TYPES.DIFFERS,
      CONTRACT_TYPES.MATCHES,
      CONTRACT_TYPES.OVER,
      CONTRACT_TYPES.UNDER,
    ].includes(
      contractType
    );

  if (
    requiresBarrier
  ) {
    const prediction =
      Number(
        signal.predictionDigit
      );

    if (
      !Number.isInteger(
        prediction
      ) ||
      prediction < 0 ||
      prediction > 9
    ) {
      return {
        valid: false,

        contractType,

        predictionDigit:
          null,

        reason:
          'Signal requires a valid prediction digit or barrier.',
      };
    }

    return {
      valid: true,

      contractType,

      predictionDigit:
        prediction,

      reason:
        'Execution signal is valid.',
    };
  }

  return {
    valid: true,

    contractType,

    predictionDigit:
      null,

    reason:
      'Execution signal is valid.',
  };
}

// ============================================================
// ANALYZER SUMMARY
// ============================================================

export function buildDigitAnalysis(
  digitHistory = []
) {
  const history =
    safeDigits(
      digitHistory
    ).slice(
      0,
      DEFAULT_STRATEGY_CONFIG
        .maximumTicks
    );

  const percentages =
    getDigitPercentages(
      history
    );

  const evenOdd =
    getEvenOddStats(
      history
    );

  const mostFrequent =
    findMostFrequentDigit(
      history
    );

  const leastFrequent =
    findLeastFrequentDigit(
      history
    );

  const streak =
    getRecentStreak(
      history
    );

  const exactDigitStreak =
    getExactDigitStreak(
      history
    );

  const entropy =
    calculateEntropy(
      history
    );

  const windows =
    buildWindowAnalysis(
      history,
      DEFAULT_STRATEGY_CONFIG
    );

  const hotCold =
    analyzeHotCold(
      history
    );

  const meanReversion =
    analyzeMeanReversion(
      history
    );

  const momentum =
    analyzeMomentum(
      history
    );

  const streakBreaker =
    analyzeStreakBreaker(
      history
    );

  return {
    sampleSize:
      history.length,

    lastDigit:
      history[0] ??
      null,

    percentages,

    evenOdd,

    mostFrequent,

    leastFrequent,

    streak,

    exactDigitStreak,

    entropy,

    distributionQuality:
      round(
        entropy * 100,
        1
      ),

    windows,

    hotCold,

    meanReversion,

    momentum,

    streakBreaker,
  };
}

// ============================================================
// SUGGESTED DIGIT
// ============================================================

export function getSuggestedDigit(
  strategy,
  digitHistory = []
) {
  const history =
    safeDigits(
      digitHistory
    );

  if (!history.length) {
    return 0;
  }

  if (
    strategy ===
    STRATEGY_IDS.DIGIT_MATCHES
  ) {
    return findMostFrequentDigit(
      history
    ).digit;
  }

  if (
    strategy ===
    STRATEGY_IDS.DIGIT_DIFFERS
  ) {
    return findLeastFrequentDigit(
      history
    ).digit;
  }

  if (
    strategy ===
    STRATEGY_IDS.DIGIT_OVER
  ) {
    return 2;
  }

  if (
    strategy ===
    STRATEGY_IDS.DIGIT_UNDER
  ) {
    return 7;
  }

  if (
    strategy ===
      STRATEGY_IDS.FREQUENCY ||
    strategy ===
      STRATEGY_IDS.HOT_COLD
  ) {
    const hotCold =
      analyzeHotCold(
        history
      );

    return (
      hotCold.hotDigit ??
      0
    );
  }

  if (
    strategy ===
    STRATEGY_IDS.MEAN_REVERSION
  ) {
    const reversion =
      analyzeMeanReversion(
        history
      );

    return (
      reversion
        .overextendedDigit ??
      0
    );
  }

  if (
    strategy ===
      STRATEGY_IDS.ADAPTIVE ||
    strategy ===
      STRATEGY_IDS.MOMENTUM ||
    strategy ===
      STRATEGY_IDS.STREAK_BREAKER
  ) {
    const signal =
      evaluateEntrySignal({
        strategy,

        digitHistory:
          history,
      });

    if (
      Number.isInteger(
        Number(
          signal.predictionDigit
        )
      )
    ) {
      return Number(
        signal.predictionDigit
      );
    }
  }

  return 0;
}

// ============================================================
// CONFIDENCE LABEL
// ============================================================

export function getConfidenceLabel(
  confidence
) {
  const value =
    Number(
      confidence
    ) || 0;

  if (
    value >=
    DEFAULT_STRATEGY_CONFIG
      .veryStrongConfidence
  ) {
    return 'Very Strong';
  }

  if (
    value >=
    DEFAULT_STRATEGY_CONFIG
      .strongConfidence
  ) {
    return 'Strong';
  }

  if (
    value >=
    DEFAULT_STRATEGY_CONFIG
      .minimumConfidence
  ) {
    return 'Qualified';
  }

  if (
    value >= 50
  ) {
    return 'Weak';
  }

  return 'No Signal';
}

// ============================================================
// STRATEGY LOOKUP
// ============================================================

export function getStrategyLibrary() {
  return STRATEGY_LIBRARY.map(
    (strategy) => ({
      ...strategy,
    })
  );
}

export function getStrategyById(
  strategyId
) {
  return (
    STRATEGY_LIBRARY.find(
      (strategy) =>
        strategy.id ===
        strategyId
    ) || null
  );
}

// ============================================================
// ADVANCED STRATEGY CHECK
// ============================================================

export function isAdvancedStrategy(
  strategyId
) {
  return [
    STRATEGY_IDS.ADAPTIVE,

    STRATEGY_IDS.FREQUENCY,

    STRATEGY_IDS.HOT_COLD,

    STRATEGY_IDS.MEAN_REVERSION,

    STRATEGY_IDS.STREAK_BREAKER,

    STRATEGY_IDS.MOMENTUM,
  ].includes(
    strategyId
  );
}

// ============================================================
// SIGNAL SAFETY CHECK
// ============================================================

export function validateSignalExecution({
  signal,

  balance,

  stake,

  consecutiveLosses = 0,

  maxConsecutiveLosses = 3,

  maximumStakePercent = 2,
}) {
  if (
    !signal ||
    !signal.shouldTrade
  ) {
    return {
      allowed: false,

      reason:
        'No qualified strategy signal.',
    };
  }

  const execution =
    getExecutionFromSignal(
      signal
    );

  if (
    !execution.valid
  ) {
    return {
      allowed: false,

      reason:
        execution.reason,
    };
  }

  if (
    signal.confidence <
    DEFAULT_STRATEGY_CONFIG
      .minimumConfidence
  ) {
    return {
      allowed: false,

      reason:
        'Signal confidence is below the minimum entry threshold.',
    };
  }

  if (
    consecutiveLosses >=
    maxConsecutiveLosses
  ) {
    return {
      allowed: false,

      reason:
        'Maximum consecutive-loss limit reached.',
    };
  }

  const numericBalance =
    Number(
      balance
    );

  const numericStake =
    Number(
      stake
    );

  if (
    !Number.isFinite(
      numericBalance
    ) ||
    numericBalance <= 0
  ) {
    return {
      allowed: false,

      reason:
        'Valid account balance is required.',
    };
  }

  if (
    !Number.isFinite(
      numericStake
    ) ||
    numericStake <= 0
  ) {
    return {
      allowed: false,

      reason:
        'Stake must be greater than zero.',
    };
  }

  const stakePercentage =
    (
      numericStake /
      numericBalance
    ) * 100;

  if (
    stakePercentage >
    maximumStakePercent
  ) {
    return {
      allowed: false,

      reason:
        `Stake exceeds the configured ${maximumStakePercent}% balance limit.`,
    };
  }

  return {
    allowed: true,

    contractType:
      execution.contractType,

    predictionDigit:
      execution.predictionDigit,

    reason:
      'Strategy execution checks passed.',
  };
}

// ============================================================
// DEFAULT EXPORT
// ============================================================

const strategyEngine = {
  DIGITS,

  CONTRACT_TYPES,

  STRATEGY_IDS,

  STRATEGY_LIBRARY,

  DEFAULT_STRATEGY_CONFIG,

  evaluateEntrySignal,

  evaluateAdaptiveStrategy,

  evaluateFrequencyStrategy,

  evaluateHotColdStrategy,

  evaluateMeanReversionStrategy,

  evaluateMomentumStrategy,

  evaluateStreakBreakerStrategy,

  analyzeHotCold,

  analyzeMeanReversion,

  analyzeMomentum,

  analyzeStreakBreaker,

  buildDigitAnalysis,

  getSuggestedDigit,

  getExecutionFromSignal,

  getConfidenceLabel,

  getStrategyLibrary,

  getStrategyById,

  isAdvancedStrategy,

  validateSignalExecution,
};

export default strategyEngine;
