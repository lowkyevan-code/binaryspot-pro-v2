// ============================================================
// BinarySpot Pro
// Contract Recovery Backoff Guard
// ============================================================
//
// Purpose:
//
// 1. Stop infinite rapid recovery retries.
// 2. Increase delay after each failed attempt.
// 3. Cap the number of automatic attempts.
// 4. Allow manual retry after automatic recovery is exhausted.
//
// ============================================================

export const DEFAULT_RECOVERY_BACKOFF = {
  maxAttempts: 6,

  delaysMs: [
    2500,
    5000,
    10000,
    20000,
    30000,
    60000,
  ],
};

// ============================================================
// SAFE HELPERS
// ============================================================

function normalizeAttempts(value) {
  const number =
    Number(value);

  if (
    !Number.isInteger(number) ||
    number < 0
  ) {
    return 0;
  }

  return number;
}

function normalizeMaxAttempts(value) {
  const number =
    Number(value);

  if (
    !Number.isInteger(number) ||
    number < 1
  ) {
    return DEFAULT_RECOVERY_BACKOFF.maxAttempts;
  }

  return number;
}

function normalizeDelays(delays) {
  if (
    !Array.isArray(delays) ||
    delays.length === 0
  ) {
    return [
      ...DEFAULT_RECOVERY_BACKOFF.delaysMs,
    ];
  }

  const valid =
    delays
      .map((value) =>
        Number(value)
      )
      .filter(
        (value) =>
          Number.isFinite(value) &&
          value >= 0
      );

  if (
    valid.length === 0
  ) {
    return [
      ...DEFAULT_RECOVERY_BACKOFF.delaysMs,
    ];
  }

  return valid;
}

// ============================================================
// CREATE
// ============================================================

export function createRecoveryBackoff(
  options = {}
) {
  return {
    attempts: 0,

    maxAttempts:
      normalizeMaxAttempts(
        options.maxAttempts
      ),

    delaysMs:
      normalizeDelays(
        options.delaysMs
      ),

    exhausted: false,

    lastDelayMs: 0,

    lastFailureAt: null,
  };
}

// ============================================================
// NEXT DELAY
// ============================================================

export function getNextRecoveryDelay(
  backoff
) {
  const current =
    backoff ||
    createRecoveryBackoff();

  const attempts =
    normalizeAttempts(
      current.attempts
    );

  const delays =
    normalizeDelays(
      current.delaysMs
    );

  const index =
    Math.min(
      attempts,
      delays.length - 1
    );

  return delays[
    index
  ];
}

// ============================================================
// CAN RETRY?
// ============================================================

export function canAttemptRecovery(
  backoff
) {
  const current =
    backoff ||
    createRecoveryBackoff();

  const attempts =
    normalizeAttempts(
      current.attempts
    );

  const maxAttempts =
    normalizeMaxAttempts(
      current.maxAttempts
    );

  if (
    current.exhausted ||
    attempts >=
      maxAttempts
  ) {
    return {
      allowed: false,

      reason:
        'Automatic contract recovery attempts are exhausted.',

      attempts,

      maxAttempts,
    };
  }

  return {
    allowed: true,

    reason: '',

    attempts,

    maxAttempts,

    nextDelayMs:
      getNextRecoveryDelay(
        current
      ),
  };
}

// ============================================================
// RECORD FAILURE
// ============================================================

export function recordRecoveryFailure(
  backoff,
  now = Date.now()
) {
  const current =
    backoff ||
    createRecoveryBackoff();

  const previousAttempts =
    normalizeAttempts(
      current.attempts
    );

  const maxAttempts =
    normalizeMaxAttempts(
      current.maxAttempts
    );

  const delays =
    normalizeDelays(
      current.delaysMs
    );

  const nextAttempts =
    previousAttempts + 1;

  const delayIndex =
    Math.min(
      nextAttempts,
      delays.length - 1
    );

  const exhausted =
    nextAttempts >=
    maxAttempts;

  return {
    ...current,

    attempts:
      nextAttempts,

    maxAttempts,

    delaysMs:
      delays,

    exhausted,

    lastDelayMs:
      exhausted
        ? 0
        : delays[
            delayIndex
          ],

    lastFailureAt:
      Number.isFinite(
        Number(now)
      )
        ? Number(now)
        : Date.now(),
  };
}

// ============================================================
// RECORD SUCCESS
// ============================================================

export function resetRecoveryBackoff(
  backoff
) {
  const current =
    backoff ||
    createRecoveryBackoff();

  return {
    ...current,

    attempts: 0,

    exhausted: false,

    lastDelayMs: 0,

    lastFailureAt: null,
  };
}

// ============================================================
// MANUAL RETRY RESET
// ============================================================

export function allowManualRecoveryRetry(
  backoff
) {
  const current =
    backoff ||
    createRecoveryBackoff();

  return {
    ...current,

    attempts: 0,

    exhausted: false,

    lastDelayMs: 0,

    lastFailureAt: null,
  };
}

// ============================================================
// STATUS
// ============================================================

export function getRecoveryBackoffStatus(
  backoff
) {
  const current =
    backoff ||
    createRecoveryBackoff();

  const attempts =
    normalizeAttempts(
      current.attempts
    );

  const maxAttempts =
    normalizeMaxAttempts(
      current.maxAttempts
    );

  const exhausted =
    Boolean(
      current.exhausted ||
      attempts >=
        maxAttempts
    );

  const nextDelayMs =
    exhausted
      ? null
      : getNextRecoveryDelay(
          current
        );

  return {
    attempts,

    maxAttempts,

    exhausted,

    nextDelayMs,

    nextDelaySeconds:
      nextDelayMs === null
        ? null
        : Math.ceil(
            nextDelayMs /
              1000
          ),

    lastFailureAt:
      current.lastFailureAt ||
      null,

    label:
      exhausted
        ? `Recovery paused — ${attempts}/${maxAttempts} attempts used`
        : attempts === 0
        ? 'Recovery ready'
        : `Recovery retry ${attempts}/${maxAttempts}`,
  };
}
