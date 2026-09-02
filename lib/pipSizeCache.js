// ============================================================
// BinarySpot Pro
// Per-Symbol Pip Size Cache
// ============================================================
//
// Purpose:
//
// 1. Remember the latest valid pip_size for each symbol.
// 2. Reuse that precision when a later tick omits pip_size.
// 3. Keep precision isolated between symbols.
// 4. Never invent a pip size when one has never been observed.
//
// ============================================================

// ============================================================
// SAFE SYMBOL
// ============================================================

function normalizeSymbol(symbol) {
  if (
    typeof symbol !== 'string'
  ) {
    return '';
  }

  return symbol.trim();
}

// ============================================================
// SAFE PIP SIZE
// ============================================================

function normalizePipSize(
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
// CREATE CACHE
// ============================================================

export function createPipSizeCache() {
  return {};
}

// ============================================================
// STORE PIP SIZE
// ============================================================

export function rememberPipSize(
  cache,
  {
    symbol,
    pipSize,
  }
) {
  const current =
    cache &&
    typeof cache === 'object'
      ? cache
      : {};

  const safeSymbol =
    normalizeSymbol(
      symbol
    );

  const safePipSize =
    normalizePipSize(
      pipSize
    );

  if (
    !safeSymbol ||
    safePipSize === null
  ) {
    return current;
  }

  return {
    ...current,

    [safeSymbol]:
      safePipSize,
  };
}

// ============================================================
// GET PIP SIZE
// ============================================================

export function getCachedPipSize(
  cache,
  symbol
) {
  const safeSymbol =
    normalizeSymbol(
      symbol
    );

  if (
    !safeSymbol ||
    !cache ||
    typeof cache !==
      'object'
  ) {
    return null;
  }

  return normalizePipSize(
    cache[
      safeSymbol
    ]
  );
}

// ============================================================
// RESOLVE TICK PRECISION
// ============================================================

export function resolveTickPipSize(
  cache,
  tick
) {
  const safeCache =
    cache &&
    typeof cache === 'object'
      ? cache
      : {};

  if (!tick) {
    return {
      cache:
        safeCache,

      pipSize:
        null,

      source:
        'none',

      symbol:
        '',
    };
  }

  const symbol =
    normalizeSymbol(
      tick.symbol
    );

  const livePipSize =
    normalizePipSize(
      tick.pip_size
    );

  // ==========================================================
  // LIVE PIP SIZE AVAILABLE
  // ==========================================================

  if (
    symbol &&
    livePipSize !== null
  ) {
    const nextCache =
      rememberPipSize(
        safeCache,
        {
          symbol,

          pipSize:
            livePipSize,
        }
      );

    return {
      cache:
        nextCache,

      pipSize:
        livePipSize,

      source:
        'live',

      symbol,
    };
  }

  // ==========================================================
  // FALL BACK TO SYMBOL CACHE
  // ==========================================================

  const cachedPipSize =
    getCachedPipSize(
      safeCache,
      symbol
    );

  if (
    cachedPipSize !== null
  ) {
    return {
      cache:
        safeCache,

      pipSize:
        cachedPipSize,

      source:
        'cache',

      symbol,
    };
  }

  // ==========================================================
  // NO PRECISION INFORMATION AVAILABLE
  // ==========================================================

  return {
    cache:
      safeCache,

    pipSize:
      null,

    source:
      'none',

    symbol,
  };
}

// ============================================================
// APPLY CACHED PRECISION TO TICK
// ============================================================

export function applyCachedPipSize(
  cache,
  tick
) {
  if (!tick) {
    return {
      cache:
        cache ||
        createPipSizeCache(),

      tick: null,

      pipSize:
        null,

      source:
        'none',
    };
  }

  const resolved =
    resolveTickPipSize(
      cache,
      tick
    );

  return {
    cache:
      resolved.cache,

    pipSize:
      resolved.pipSize,

    source:
      resolved.source,

    tick: {
      ...tick,

      pip_size:
        resolved.pipSize,
    },
  };
}

// ============================================================
// CLEAR ONE SYMBOL
// ============================================================

export function clearCachedPipSize(
  cache,
  symbol
) {
  const current =
    cache &&
    typeof cache === 'object'
      ? cache
      : {};

  const safeSymbol =
    normalizeSymbol(
      symbol
    );

  if (
    !safeSymbol ||
    !Object.prototype.hasOwnProperty.call(
      current,
      safeSymbol
    )
  ) {
    return current;
  }

  const next = {
    ...current,
  };

  delete next[
    safeSymbol
  ];

  return next;
}

// ============================================================
// CLEAR EVERYTHING
// ============================================================

export function resetPipSizeCache() {
  return createPipSizeCache();
}

// ============================================================
// STATUS
// ============================================================

export function getPipSizeCacheStatus(
  cache,
  symbol
) {
  const pipSize =
    getCachedPipSize(
      cache,
      symbol
    );

  return {
    symbol:
      normalizeSymbol(
        symbol
      ),

    hasCachedPrecision:
      pipSize !== null,

    pipSize,
  };
}
