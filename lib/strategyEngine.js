// ============================================================
// BinarySpot Pro
// Demo Strategy / Entry Signal Engine
// ============================================================

const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

function safeDigits(history = []) {
  return history
    .map(Number)
    .filter(
      (digit) =>
        Number.isInteger(digit) &&
        digit >= 0 &&
        digit <= 9
    );
}

function countDigits(history) {
  const counts = Array(10).fill(0);

  history.forEach((digit) => {
    counts[digit] += 1;
  });

  return counts;
}

function percentage(value, total) {
  if (!total) {
    return 0;
  }

  return Number(
    ((value / total) * 100).toFixed(2)
  );
}

function getDigitPercentages(history) {
  const clean = safeDigits(history);
  const counts = countDigits(clean);
  const total = clean.length;

  return counts.map((count, digit) => ({
    digit,
    count,
    percentage: percentage(count, total),
  }));
}

function getEvenOddStats(history) {
  const clean = safeDigits(history);

  const evenCount = clean.filter(
    (digit) => digit % 2 === 0
  ).length;

  const oddCount =
    clean.length - evenCount;

  return {
    evenCount,
    oddCount,
    evenPercentage: percentage(
      evenCount,
      clean.length
    ),
    oddPercentage: percentage(
      oddCount,
      clean.length
    ),
  };
}

function findMostFrequentDigit(history) {
  const percentages =
    getDigitPercentages(history);

  return percentages.reduce(
    (highest, current) =>
      current.count > highest.count
        ? current
        : highest,
    {
      digit: 0,
      count: 0,
      percentage: 0,
    }
  );
}

function findLeastFrequentDigit(history) {
  const percentages =
    getDigitPercentages(history);

  return percentages.reduce(
    (lowest, current) =>
      current.count < lowest.count
        ? current
        : lowest,
    {
      digit: 0,
      count: Infinity,
      percentage: 0,
    }
  );
}

function getRecentStreak(history) {
  const clean = safeDigits(history);

  if (!clean.length) {
    return {
      type: null,
      length: 0,
    };
  }

  const firstType =
    clean[0] % 2 === 0
      ? 'even'
      : 'odd';

  let length = 0;

  for (const digit of clean) {
    const type =
      digit % 2 === 0
        ? 'even'
        : 'odd';

    if (type !== firstType) {
      break;
    }

    length += 1;
  }

  return {
    type: firstType,
    length,
  };
}

function normalizeConfidence(value) {
  return Math.max(
    0,
    Math.min(
      100,
      Number(value.toFixed(1))
    )
  );
}

// ============================================================
// DIGIT DIFFERS
// ============================================================

function digitDiffersSignal(
  history,
  predictionDigit
) {
  const clean = safeDigits(history);

  if (clean.length < 20) {
    return {
      shouldTrade: false,
      confidence: 0,
      reason:
        'Waiting for at least 20 ticks.',
    };
  }

  const prediction =
    Number(predictionDigit);

  if (
    !Number.isInteger(prediction) ||
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

  const stats =
    getDigitPercentages(clean);

  const predictionStats =
    stats[prediction];

  const differsRate =
    100 -
    predictionStats.percentage;

  return {
    shouldTrade:
      differsRate >= 85,

    confidence:
      normalizeConfidence(
        differsRate
      ),

    reason:
      `Digit ${prediction} appeared ${predictionStats.percentage}% of recent ticks.`,

    predictionDigit:
      prediction,
  };
}

// ============================================================
// DIGIT MATCH
// ============================================================

function digitMatchSignal(history) {
  const clean = safeDigits(history);

  if (clean.length < 30) {
    return {
      shouldTrade: false,
      confidence: 0,
      reason:
        'Waiting for at least 30 ticks.',
    };
  }

  const mostFrequent =
    findMostFrequentDigit(clean);

  return {
    shouldTrade:
      mostFrequent.percentage >= 14,

    confidence:
      normalizeConfidence(
        mostFrequent.percentage *
          5
      ),

    predictionDigit:
      mostFrequent.digit,

    reason:
      `Digit ${mostFrequent.digit} is currently most frequent at ${mostFrequent.percentage}%.`,
  };
}

// ============================================================
// EVEN / ODD
// ============================================================

function evenOddSignal(
  history,
  strategy
) {
  const clean = safeDigits(history);

  if (clean.length < 20) {
    return {
      shouldTrade: false,
      confidence: 0,
      reason:
        'Waiting for at least 20 ticks.',
    };
  }

  const stats =
    getEvenOddStats(clean);

  const streak =
    getRecentStreak(clean);

  if (strategy === 'DIGITEVEN') {
    const confidence =
      stats.evenPercentage;

    return {
      shouldTrade:
        confidence >= 56 &&
        !(
          streak.type ===
            'even' &&
          streak.length >= 4
        ),

      confidence:
        normalizeConfidence(
          confidence
        ),

      reason:
        `Even digits represent ${stats.evenPercentage}% of the sample. Current ${streak.type || 'none'} streak: ${streak.length}.`,
    };
  }

  const confidence =
    stats.oddPercentage;

  return {
    shouldTrade:
      confidence >= 56 &&
      !(
        streak.type ===
          'odd' &&
        streak.length >= 4
      ),

    confidence:
      normalizeConfidence(
        confidence
      ),

    reason:
      `Odd digits represent ${stats.oddPercentage}% of the sample. Current ${streak.type || 'none'} streak: ${streak.length}.`,
  };
}

// ============================================================
// DIGIT OVER
// ============================================================

function digitOverSignal(
  history,
  predictionDigit
) {
  const clean = safeDigits(history);

  if (clean.length < 20) {
    return {
      shouldTrade: false,
      confidence: 0,
      reason:
        'Waiting for at least 20 ticks.',
    };
  }

  const barrier =
    Number(predictionDigit);

  if (
    !Number.isInteger(barrier) ||
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

  const winningDigits =
    clean.filter(
      (digit) =>
        digit > barrier
    ).length;

  const rate =
    percentage(
      winningDigits,
      clean.length
    );

  return {
    shouldTrade:
      rate >= 60,

    confidence:
      normalizeConfidence(rate),

    predictionDigit:
      barrier,

    reason:
      `${rate}% of recent digits were above ${barrier}.`,
  };
}

// ============================================================
// DIGIT UNDER
// ============================================================

function digitUnderSignal(
  history,
  predictionDigit
) {
  const clean = safeDigits(history);

  if (clean.length < 20) {
    return {
      shouldTrade: false,
      confidence: 0,
      reason:
        'Waiting for at least 20 ticks.',
    };
  }

  const barrier =
    Number(predictionDigit);

  if (
    !Number.isInteger(barrier) ||
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

  const winningDigits =
    clean.filter(
      (digit) =>
        digit < barrier
    ).length;

  const rate =
    percentage(
      winningDigits,
      clean.length
    );

  return {
    shouldTrade:
      rate >= 60,

    confidence:
      normalizeConfidence(rate),

    predictionDigit:
      barrier,

    reason:
      `${rate}% of recent digits were below ${barrier}.`,
  };
}

// ============================================================
// MASTER SIGNAL FUNCTION
// ============================================================

export function evaluateEntrySignal({
  strategy,
  digitHistory = [],
  predictionDigit = 0,
}) {
  const history =
    safeDigits(
      digitHistory
    ).slice(0, 100);

  if (!history.length) {
    return {
      shouldTrade: false,
      confidence: 0,
      reason:
        'Waiting for market data.',
      strategy,
    };
  }

  let result;

  switch (strategy) {
    case 'DIGITDIFF':
      result =
        digitDiffersSignal(
          history,
          predictionDigit
        );
      break;

    case 'DIGITMATCH':
      result =
        digitMatchSignal(
          history
        );
      break;

    case 'DIGITEVEN':
    case 'DIGITODD':
      result =
        evenOddSignal(
          history,
          strategy
        );
      break;

    case 'DIGITOVER':
      result =
        digitOverSignal(
          history,
          predictionDigit
        );
      break;

    case 'DIGITUNDER':
      result =
        digitUnderSignal(
          history,
          predictionDigit
        );
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
      history[0] ?? null,

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
    ).slice(0, 100);

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

  return {
    sampleSize:
      history.length,

    percentages,

    evenOdd,

    mostFrequent,

    leastFrequent,

    streak,
  };
}

// ============================================================
// UTILITY
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
    return findLeastFrequentDigit(
      history
    ).digit;
  }

  if (
    strategy ===
    'DIGITOVER'
  ) {
    return 2;
  }

  if (
    strategy ===
    'DIGITUNDER'
  ) {
    return 7;
  }

  return 0;
}

export { DIGITS };
