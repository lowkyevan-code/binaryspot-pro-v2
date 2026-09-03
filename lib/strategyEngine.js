// ============================================================
// BinarySpot Pro
// Advanced Demo Strategy / Entry Signal Engine
// ============================================================
//
// IMPORTANT:
//
// 1. This module DOES NOT purchase contracts.
// 2. This module DOES NOT connect to Deriv.
// 3. This module DOES NOT bypass BinarySpot safety controls.
// 4. Actual proposal/buy execution remains inside the existing
//    BinarySpot Pro trading lifecycle.
//
// digitHistory convention used by BinarySpot:
//
// digitHistory[0] = newest digit
//
// The engine deliberately uses conservative filtering.
// Confidence is a SIGNAL QUALITY SCORE — not a guaranteed
// future win probability.
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

export const STRATEGY_IDS =
  Object.freeze({
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

export const STRATEGY_LIBRARY =
  Object.freeze([
    {
      id:
        STRATEGY_IDS.ADAPTIVE,

      name:
        'Adaptive Confidence',

      description:
        'Combines multiple digit-analysis filters and waits for stronger agreement before producing an entry.',

      risk:
        'Balanced',

      recommended:
        true,
    },

    {
      id:
        STRATEGY_IDS.FREQUENCY,

      name:
        'Digit Frequency Edge',

      description:
        'Measures short, medium and long digit frequencies and searches for persistent statistical imbalance.',

      risk:
        'Balanced',

      recommended:
        true,
    },

    {
      id:
        STRATEGY_IDS.HOT_COLD,

      name:
        'Hot / Cold Digit',

      description:
        'Tracks digits whose recent frequency has moved significantly above or below their longer-term distribution.',

      risk:
        'Balanced',

      recommended:
        true,
    },

    {
      id:
        STRATEGY_IDS.MEAN_REVERSION,

      name:
        'Mean Reversion',

      description:
        'Looks for unusually stretched recent digit distributions while avoiding weak reversal assumptions.',

      risk:
        'Moderate',

      recommended:
        false,
    },

    {
      id:
        STRATEGY_IDS.STREAK_BREAKER,

      name:
        'Streak Breaker',

      description:
        'Detects extended even/odd streaks and identifies possible reversal conditions.',

      risk:
        'Moderate',

      recommended:
        false,
    },

    {
      id:
        STRATEGY_IDS.MOMENTUM,

      name:
        'Digit Momentum',

      description:
        'Compares recent digit behaviour against older windows to measure persistent direction and distribution momentum.',

      risk:
        'Moderate',

      recommended:
        false,
    },
  ]);

// ============================================================
// DEFAULTS
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

    minimumEntropy: 0.82,

    frequencyDeviation:
      3.5,

    minimumParityEdge:
      7,

    minimumOverUnderEdge:
      8,

    maximumStreakForTrendEntry:
      4,

    streakBreakerLength:
      5,

    minimumConsensus:
      2,
  });

// ============================================================
// BASIC HELPERS
// ============================================================

function clamp(
  value,
  minimum,
  maximum
) {
  return Math.min(
    Math.max(
      Number(value) || 0,
      minimum
    ),
    maximum
  );
}

function round(
  value,
  decimals = 2
) {
  const multiplier =
    10 ** decimals;

  return (
    Math.round(
      (Number(value) || 0) *
        multiplier
    ) / multiplier
  );
}

function normalizeConfidence(
  value
) {
  return clamp(
    round(value, 1),
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
    (value / total) * 100,
    2
  );
}

function safeDigits(
  history = []
) {
  if (
    !Array.isArray(history)
  ) {
    return [];
  }

  return history
    .map((value) => {
      if (
        Number.isInteger(value)
      ) {
        return value;
      }

      if (
        value &&
        typeof value ===
          'object'
      ) {
        const possible =
          Number(
            value.lastDigit ??
              value.last_digit ??
              value.digit
          );

        if (
          Number.isInteger(
            possible
          )
        ) {
          return possible;
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

function olderWindow(
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
    safeDigits(history);

  const counts =
    countDigits(clean);

  const total =
    clean.length;

  return counts.map(
    (
      count,
      digit
    ) => ({
      digit,

      count,

      percentage:
        percentage(
          count,
          total
        ),

      deviation:
        round(
          percentage(
            count,
            total
          ) - 10,
          2
        ),
    })
  );
}

function getEvenOddStats(
  history
) {
  const clean =
    safeDigits(history);

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
// ENTROPY / SAMPLE QUALITY
// ============================================================

function calculateEntropy(
  history
) {
  const clean =
    safeDigits(history);

  if (!clean.length) {
    return 0;
  }

  const counts =
    countDigits(clean);

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
  preferredTicks = 60
) {
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
    safeDigits(history);

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
    const digit =
      clean[index];

    const type =
      digit % 2 === 0
        ? 'even'
        : 'odd';

    if (
      type !==
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
    safeDigits(history);

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
  config =
    DEFAULT_STRATEGY_CONFIG
) {
  const clean =
    safeDigits(history);

  const shortSample =
    newest(
      clean,
      config.shortWindow
    );

  const mediumSample =
    newest(
      clean,
      config.mediumWindow
    );

  const longSample =
    newest(
      clean,
      config.longWindow
    );

  return {
    short: {
      sampleSize:
        shortSample.length,

      digits:
        shortSample,

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
      sampleSize:
        mediumSample.length,

      digits:
        mediumSample,

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
      sampleSize:
        longSample.length,

      digits:
        longSample,

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
        shortStats[digit]
          ?.percentage || 0;

      const longPercentage =
        longStats[digit]
          ?.percentage || 0;

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
    safeDigits(history);

  if (
    clean.length <
    config.minimumTicks
  ) {
    return {
      shouldTrade: false,

      confidence: 0,

      reason:
        `Waiting for at least ${config.minimumTicks} ticks.`,
    };
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
    return {
      shouldTrade: false,

      confidence: 0,

      reason:
        'Invalid prediction digit.',
    };
  }

  const windows =
    buildWindowAnalysis(
      clean,
      config
    );

  const shortStats =
    windows.short
      .percentages[
        prediction
      ];

  const mediumStats =
    windows.medium
      .percentages[
        prediction
      ];

  const longStats =
    windows.long
      .percentages[
        prediction
      ];

  const shortDiffers =
    100 -
    shortStats.percentage;

  const mediumDiffers =
    100 -
    mediumStats.percentage;

  const longDiffers =
    100 -
    longStats.percentage;

  const weightedRate =
    shortDiffers *
      0.45 +
    mediumDiffers *
      0.35 +
    longDiffers *
      0.2;

  const agreement =
    [
      shortDiffers >= 85,
      mediumDiffers >= 85,
      longDiffers >= 85,
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

  return {
    shouldTrade,

    confidence,

    predictionDigit:
      prediction,

    reason:
      shouldTrade
        ? `Digit ${prediction} is absent often enough across multiple windows. Weighted differs rate: ${round(
            weightedRate,
            1
          )}%.`
        : `Digit ${prediction} does not yet have enough multi-window confirmation.`,

    metrics: {
      shortDiffers:
        round(
          shortDiffers,
          2
        ),

      mediumDiffers:
        round(
          mediumDiffers,
          2
        ),

      longDiffers:
        round(
          longDiffers,
          2
        ),

      weightedRate:
        round(
          weightedRate,
          2
        ),

      agreement,

      entropy,
    },
  };
}

// ============================================================
// DIGIT MATCH
// ============================================================

function digitMatchSignal(
  history,
  config
) {
  const clean =
    safeDigits(history);

  if (
    clean.length <
    config.preferredTicks
  ) {
    return {
      shouldTrade: false,

      confidence: 0,

      reason:
        `Digit Match requires at least ${config.preferredTicks} ticks.`,
    };
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

  const sameDigitCount =
    [
      shortMost.digit,
      mediumMost.digit,
      longMost.digit,
    ].filter(
      (digit) =>
        digit ===
        shortMost.digit
    ).length;

  const weightedFrequency =
    shortMost.percentage *
      0.5 +
    (
      mediumMost.digit ===
      shortMost.digit
        ? mediumMost.percentage
        : 0
    ) *
      0.3 +
    (
      longMost.digit ===
      shortMost.digit
        ? longMost.percentage
        : 0
    ) *
      0.2;

  const excessAboveRandom =
    Math.max(
      0,
      weightedFrequency -
        10
    );

  const confidence =
    normalizeConfidence(
      45 +
        excessAboveRandom *
          3 +
        sameDigitCount *
          5
    );

  /*
   * Matches naturally has a much lower
   * base probability than Differs.
   *
   * The engine therefore deliberately
   * requires stronger confirmation.
   */

  const shouldTrade =
    sameDigitCount >= 2 &&
    shortMost.percentage >=
      15 &&
    mediumMost.percentage >=
      12.5 &&
    confidence >=
      config.strongConfidence;

  return {
    shouldTrade,

    confidence,

    predictionDigit:
      shortMost.digit,

    reason:
      shouldTrade
        ? `Digit ${shortMost.digit} is the dominant digit across multiple analysis windows.`
        : `Digit Match has no sufficiently persistent dominant digit yet.`,

    metrics: {
      shortFrequency:
        shortMost.percentage,

      mediumFrequency:
        mediumMost.percentage,

      longFrequency:
        longMost.percentage,

      agreement:
        sameDigitCount,

      weightedFrequency:
        round(
          weightedFrequency,
          2
        ),
    },
  };
}

// ============================================================
// EVEN / ODD
// ============================================================

function evenOddSignal(
  history,
  strategy,
  config
) {
  const clean =
    safeDigits(history);

  if (
    clean.length <
    config.minimumTicks
  ) {
    return {
      shouldTrade: false,

      confidence: 0,

      reason:
        `Waiting for at least ${config.minimumTicks} ticks.`,
    };
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
    strategy ===
      'DIGITEVEN'
      ? 'even'
      : 'odd';

  const shortRate =
    target === 'even'
      ? windows.short.evenOdd
          .evenPercentage
      : windows.short.evenOdd
          .oddPercentage;

  const mediumRate =
    target === 'even'
      ? windows.medium.evenOdd
          .evenPercentage
      : windows.medium.evenOdd
          .oddPercentage;

  const longRate =
    target === 'even'
      ? windows.long.evenOdd
          .evenPercentage
      : windows.long.evenOdd
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

  const excess =
    Math.max(
      0,
      weightedRate -
        50
    );

  const confidence =
    normalizeConfidence(
      55 +
        excess *
          2.4 +
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
      56 &&
    agreement >= 2 &&
    !streakBlocked &&
    confidence >=
      config.minimumConfidence;

  return {
    shouldTrade,

    confidence,

    reason:
      shouldTrade
        ? `${target.toUpperCase()} bias is confirmed across multiple windows at ${round(
            weightedRate,
            1
          )}%.`
        : streakBlocked
        ? `${target} entry blocked because the current ${target} streak is already ${streak.length} ticks.`
        : `${target} distribution does not yet have enough multi-window confirmation.`,

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
  };
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
    safeDigits(history);

  if (
    clean.length <
    config.minimumTicks
  ) {
    return {
      shouldTrade: false,

      confidence: 0,

      reason:
        `Waiting for at least ${config.minimumTicks} ticks.`,
    };
  }

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
    return {
      shouldTrade: false,

      confidence: 0,

      reason:
        'Digit Over barrier must be between 0 and 8.',
    };
  }

  const windows =
    buildWindowAnalysis(
      clean,
      config
    );

  function overRate(
    sample
  ) {
    return percentage(
      sample.filter(
        (digit) =>
          digit > barrier
      ).length,
      sample.length
    );
  }

  const shortRate =
    overRate(
      windows.short.digits
    );

  const mediumRate =
    overRate(
      windows.medium.digits
    );

  const longRate =
    overRate(
      windows.long.digits
    );

  const weightedRate =
    shortRate * 0.45 +
    mediumRate * 0.35 +
    longRate * 0.2;

  const theoreticalRate =
    (9 - barrier) * 10;

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

  return {
    shouldTrade,

    confidence,

    predictionDigit:
      barrier,

    reason:
      shouldTrade
        ? `Digits above ${barrier} are outperforming their baseline across multiple windows.`
        : `Over ${barrier} does not have enough confirmed distribution edge.`,

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
  };
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
    safeDigits(history);

  if (
    clean.length <
    config.minimumTicks
  ) {
    return {
      shouldTrade: false,

      confidence: 0,

      reason:
        `Waiting for at least ${config.minimumTicks} ticks.`,
    };
  }

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
    return {
      shouldTrade: false,

      confidence: 0,

      reason:
        'Digit Under barrier must be between 1 and 9.',
    };
  }

  const windows =
    buildWindowAnalysis(
      clean,
      config
    );

  function underRate(
    sample
  ) {
    return percentage(
      sample.filter(
        (digit) =>
          digit < barrier
      ).length,
      sample.length
    );
  }

  const shortRate =
    underRate(
      windows.short.digits
    );

  const mediumRate =
    underRate(
      windows.medium.digits
    );

  const longRate =
    underRate(
      windows.long.digits
    );

  const weightedRate =
    shortRate * 0.45 +
    mediumRate * 0.35 +
    longRate * 0.2;

  const theoreticalRate =
    barrier * 10;

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

  return {
    shouldTrade,

    confidence,

    predictionDigit:
      barrier,

    reason:
      shouldTrade
        ? `Digits below ${barrier} are outperforming their baseline across multiple windows.`
        : `Under ${barrier} does not have enough confirmed distribution edge.`,

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
  };
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

      confidence: 0,

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
        strongestMove *
          3
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
        ? `Digit ${hottest.digit} is currently hottest and digit ${coldest.digit} is currently coldest.`
        : 'Digit frequencies are currently close to their longer-term distribution.',
  };
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

      targetDigit: null,

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
        displacement *
          2.5
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

    targetDigit:
      underrepresented.digit,

    displacement:
      round(
        displacement,
        2
      ),

    reason:
      displacement >=
      config.frequencyDeviation *
        1.5
        ? `Digit distribution is stretched. Digit ${overextended.digit} is overrepresented while ${underrepresented.digit} is underrepresented.`
        : 'No sufficiently stretched distribution is present.',
  };
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

      reason:
        'Waiting for two complete momentum windows.',
    };
  }

  const recent =
    olderWindow(
      history,
      0,
      windowSize
    );

  const previous =
    olderWindow(
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
    average(recent);

  const previousAverage =
    average(previous);

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
        ? 'DIGITOVER'
        : movement < 0
        ? 'DIGITUNDER'
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
// STREAK BREAKER
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
        ? 'DIGITODD'
        : 'DIGITEVEN',

    reason:
      `${streak.length} consecutive ${streak.type} digits detected. A reversal candidate exists.`,
  };
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
    return {
      shouldTrade: false,

      confidence: 0,

      contractType:
        null,

      predictionDigit:
        null,

      reason:
        `Adaptive strategy requires at least ${config.preferredTicks} ticks.`,

      consensus: 0,
    };
  }

  const signals = [];

  // --------------------------------
  // Frequency / Hot-Cold
  // --------------------------------

  const hotCold =
    analyzeHotCold(
      history,
      config
    );

  if (hotCold.ready) {
    signals.push({
      source:
        STRATEGY_IDS.HOT_COLD,

      contractType:
        'DIGITDIFF',

      predictionDigit:
        hotCold.hotDigit,

      confidence:
        hotCold.confidence,

      reason:
        hotCold.reason,
    });
  }

  // --------------------------------
  // Mean Reversion
  // --------------------------------

  const meanReversion =
    analyzeMeanReversion(
      history,
      config
    );

  if (
    meanReversion.ready
  ) {
    signals.push({
      source:
        STRATEGY_IDS.MEAN_REVERSION,

      contractType:
        'DIGITDIFF',

      predictionDigit:
        meanReversion
          .overextendedDigit,

      confidence:
        meanReversion
          .confidence,

      reason:
        meanReversion.reason,
    });
  }

  // --------------------------------
  // Momentum
  // --------------------------------

  const momentum =
    analyzeMomentum(
      history,
      config
    );

  if (
    momentum.ready &&
    momentum.suggestedContract
  ) {
    signals.push({
      source:
        STRATEGY_IDS.MOMENTUM,

      contractType:
        momentum
          .suggestedContract,

      predictionDigit:
        momentum
          .suggestedBarrier,

      confidence:
        momentum.confidence,

      reason:
        momentum.reason,
    });
  }

  // --------------------------------
  // Streak
  // --------------------------------

  const streak =
    analyzeStreakBreaker(
      history,
      config
    );

  if (
    streak.ready
  ) {
    signals.push({
      source:
        STRATEGY_IDS.STREAK_BREAKER,

      contractType:
        streak
          .suggestedContract,

      predictionDigit:
        0,

      confidence:
        streak.confidence,

      reason:
        streak.reason,
    });
  }

  if (!signals.length) {
    return {
      shouldTrade: false,

      confidence: 0,

      contractType:
        null,

      predictionDigit:
        null,

      reason:
        'No adaptive strategy currently has enough evidence for an entry.',

      consensus: 0,

      signals: [],
    };
  }

  // --------------------------------
  // Group matching setups
  // --------------------------------

  const groups =
    new Map();

  signals.forEach(
    (signal) => {
      const key =
        `${signal.contractType}:${signal.predictionDigit}`;

      if (
        !groups.has(key)
      ) {
        groups.set(
          key,
          []
        );
      }

      groups
        .get(key)
        .push(
          signal
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
        signal
      ) =>
        total +
        signal.confidence,
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
      averageConfidence +
        consensusBonus
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

  return {
    shouldTrade,

    confidence,

    contractType:
      leader.contractType,

    predictionDigit:
      leader.predictionDigit,

    consensus,

    reason:
      shouldTrade
        ? `${consensus} strategy filters agree on this setup.`
        : `Only ${consensus} strategy filter supports the leading setup; ${config.minimumConsensus} are required.`,

    contributingStrategies:
      winner.map(
        (signal) =>
          signal.source
      ),

    signals,
  };
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

      confidence: 0,

      reason:
        'Waiting for market data.',

      strategy,

      sampleSize: 0,

      lastDigit: null,
    };
  }

  let result;

  switch (strategy) {
    case 'DIGITDIFF':
      result =
        digitDiffersSignal(
          history,
          predictionDigit,
          config
        );
      break;

    case 'DIGITMATCH':
      result =
        digitMatchSignal(
          history,
          config
        );
      break;

    case 'DIGITEVEN':

    case 'DIGITODD':
      result =
        evenOddSignal(
          history,
          strategy,
          config
        );
      break;

    case 'DIGITOVER':
      result =
        digitOverSignal(
          history,
          predictionDigit,
          config
        );
      break;

    case 'DIGITUNDER':
      result =
        digitUnderSignal(
          history,
          predictionDigit,
          config
        );
      break;

    case 'ADAPTIVE':
      result =
        evaluateAdaptiveStrategy({
          digitHistory:
            history,

          config,
        });
      break;

    default:
      result = {
        shouldTrade: false,

        confidence: 0,

        reason:
          'Unsupported strategy.',
      };
  }

  return {
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

  const momentum =
    analyzeMomentum(
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

    momentum,
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
    'DIGITMATCH'
  ) {
    return findMostFrequentDigit(
      history
    ).digit;
  }

  if (
    strategy ===
    'DIGITDIFF'
  ) {
    /*
     * Existing BinarySpot behaviour
     * is preserved:
     *
     * use the least frequent digit
     * as the proposed DIFFERS barrier.
     */

    return findLeastFrequentDigit(
      history
    ).digit;
  }

  if (
    strategy ===
    'DIGITOVER'
  ) {
    /*
     * Conservative default barrier.
     */

    return 2;
  }

  if (
    strategy ===
    'DIGITUNDER'
  ) {
    /*
     * Conservative default barrier.
     */

    return 7;
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

  if (value >= 50) {
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
    Number(balance);

  const numericStake =
    Number(stake);

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

    reason:
      'Strategy execution checks passed.',
  };
}
