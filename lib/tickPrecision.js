// ============================================================
// BinarySpot Pro
// Tick Precision & Last Digit Utilities
// ============================================================

function safeNumber(value) {
  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : null;
}

// ============================================================
// NORMALIZE PIP SIZE
// ============================================================

export function normalizePipSize(
  pipSize
) {
  const value =
    Number(pipSize);

  if (
    !Number.isInteger(value) ||
    value < 0 ||
    value > 20
  ) {
    return null;
  }

  return value;
}

// ============================================================
// FORMAT QUOTE
// ============================================================

export function formatTickQuote({
  quote,
  pipSize,
}) {
  const numericQuote =
    safeNumber(quote);

  if (numericQuote === null) {
    return null;
  }

  const precision =
    normalizePipSize(
      pipSize
    );

  if (precision !== null) {
    return numericQuote.toFixed(
      precision
    );
  }

  /*
   * New Deriv API does not guarantee pip_size.
   *
   * When pip_size is unavailable, preserve the quote
   * representation as closely as possible.
   */

  if (
    typeof quote ===
      'string' &&
    quote.trim() !== ''
  ) {
    return quote.trim();
  }

  return String(
    numericQuote
  );
}

// ============================================================
// EXTRACT LAST DIGIT
// ============================================================

export function extractLastDigit({
  quote,
  pipSize,
}) {
  const formatted =
    formatTickQuote({
      quote,
      pipSize,
    });

  if (!formatted) {
    return {
      valid: false,

      digit: null,

      formattedQuote: null,

      pipSize:
        normalizePipSize(
          pipSize
        ),

      usedPipSize: false,
    };
  }

  const digits =
    formatted.replace(
      /\D/g,
      ''
    );

  if (!digits.length) {
    return {
      valid: false,

      digit: null,

      formattedQuote:
        formatted,

      pipSize:
        normalizePipSize(
          pipSize
        ),

      usedPipSize:
        normalizePipSize(
          pipSize
        ) !== null,
    };
  }

  const digit =
    Number(
      digits[
        digits.length - 1
      ]
    );

  return {
    valid:
      Number.isInteger(
        digit
      ) &&
      digit >= 0 &&
      digit <= 9,

    digit,

    formattedQuote:
      formatted,

    pipSize:
      normalizePipSize(
        pipSize
      ),

    usedPipSize:
      normalizePipSize(
        pipSize
      ) !== null,
  };
}

// ============================================================
// BUILD NORMALIZED TICK
// ============================================================

export function normalizeDerivTick(
  tick
) {
  if (!tick) {
    return {
      valid: false,
      quote: null,
      formattedQuote: null,
      lastDigit: null,
      pipSize: null,
      symbol: null,
      epoch: null,
    };
  }

  const result =
    extractLastDigit({
      quote:
        tick.quote,

      pipSize:
        tick.pip_size,
    });

  const numericQuote =
    safeNumber(
      tick.quote
    );

  return {
    valid:
      result.valid &&
      numericQuote !== null,

    quote:
      numericQuote,

    formattedQuote:
      result.formattedQuote,

    lastDigit:
      result.digit,

    pipSize:
      result.pipSize,

    usedPipSize:
      result.usedPipSize,

    symbol:
      tick.symbol ??
      null,

    epoch:
      safeNumber(
        tick.epoch
      ),
  };
}

// ============================================================
// HISTORY UPDATE
// ============================================================

export function prependDigitToHistory(
  history,
  digit,
  limit = 100
) {
  const safeHistory =
    Array.isArray(history)
      ? history.filter(
          (value) =>
            Number.isInteger(
              Number(value)
            ) &&
            Number(value) >=
              0 &&
            Number(value) <=
              9
        )
      : [];

  const safeDigit =
    Number(digit);

  if (
    !Number.isInteger(
      safeDigit
    ) ||
    safeDigit < 0 ||
    safeDigit > 9
  ) {
    return safeHistory.slice(
      0,
      limit
    );
  }

  return [
    safeDigit,
    ...safeHistory,
  ].slice(
    0,
    Math.max(
      1,
      Number(limit) || 100
    )
  );
}
