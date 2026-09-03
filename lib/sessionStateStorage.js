export const SESSION_STATE_STORAGE_KEY =
  'binaryspot_session_state_v1';

const SESSION_STATE_VERSION = 1;

const MAX_STATE_AGE_MS =
  24 * 60 * 60 * 1000;

const DEFAULT_STATE = Object.freeze({
  version: SESSION_STATE_VERSION,

  savedAt: null,

  accountId: '',
  accountType: 'unknown',
  currency: 'USD',

  symbol: 'R_100',
  strategy: 'DIGITDIFF',
  predictionDigit: '0',

  baseStake: 1,
  currentStake: 1,
  martingale: 2,
  takeProfit: 10,
  stopLoss: 20,
  maxConsecutiveLosses: 3,
  maxStake: 10,
  maxTrades: 10,
  cooldownSeconds: 2,
  minimumConfidence: 60,
  duration: 1,

  totalProfit: 0,
  tradeCount: 0,
  winCount: 0,
  lossCount: 0,
  drawCount: 0,
  consecutiveLosses: 0,

  tradeHistory: [],

  botWasRunning: false,
});

function hasSessionStorage() {
  try {
    return (
      typeof window !== 'undefined' &&
      typeof window.sessionStorage !==
        'undefined'
    );
  } catch {
    return false;
  }
}

function safeString(value, fallback = '') {
  if (
    typeof value === 'string'
  ) {
    return value;
  }

  if (
    value === null ||
    value === undefined
  ) {
    return fallback;
  }

  return String(value);
}

function safeNumber(
  value,
  fallback = 0
) {
  const number =
    Number(value);

  return Number.isFinite(number)
    ? number
    : fallback;
}

function safePositiveNumber(
  value,
  fallback = 1
) {
  const number =
    Number(value);

  return Number.isFinite(number) &&
    number > 0
    ? number
    : fallback;
}

function safeNonNegativeNumber(
  value,
  fallback = 0
) {
  const number =
    Number(value);

  return Number.isFinite(number) &&
    number >= 0
    ? number
    : fallback;
}

function safeInteger(
  value,
  fallback = 0
) {
  const number =
    Number(value);

  return Number.isInteger(number)
    ? number
    : fallback;
}

function safePositiveInteger(
  value,
  fallback = 1
) {
  const number =
    Number(value);

  return Number.isInteger(number) &&
    number > 0
    ? number
    : fallback;
}

function normalizeAccountType(value) {
  if (value === 'demo') {
    return 'demo';
  }

  if (value === 'real') {
    return 'real';
  }

  return 'unknown';
}

function normalizeTradeHistory(
  value
) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .slice(0, 100)
    .map((trade) => {
      const profit =
        safeNumber(
          trade?.profit,
          0
        );

      const stake =
        safeNonNegativeNumber(
          trade?.stake,
          0
        );

      return {
        id:
          safeString(
            trade?.id
          ),

        result:
          safeString(
            trade?.result,
            'unknown'
          ),

        profit,

        stake,

        strategy:
          safeString(
            trade?.strategy
          ),

        symbol:
          safeString(
            trade?.symbol
          ),

        time:
          safeString(
            trade?.time
          ),

        recovered:
          Boolean(
            trade?.recovered
          ),
      };
    })
    .filter(
      (trade) =>
        trade.id.length > 0
    );
}

export function createSessionState(
  overrides = {}
) {
  return {
    ...DEFAULT_STATE,
    ...overrides,
    tradeHistory:
      normalizeTradeHistory(
        overrides.tradeHistory
      ),
  };
}

export function normalizeSessionState(
  input
) {
  if (
    !input ||
    typeof input !== 'object'
  ) {
    return {
      valid: false,
      reason:
        'Session state is invalid.',
      state: createSessionState(),
    };
  }

  const version =
    safeInteger(
      input.version,
      SESSION_STATE_VERSION
    );

  if (
    version !==
    SESSION_STATE_VERSION
  ) {
    return {
      valid: false,
      reason:
        'Session state version is unsupported.',
      state: createSessionState(),
    };
  }

  const state = {
    version:
      SESSION_STATE_VERSION,

    savedAt:
      safeNonNegativeNumber(
        input.savedAt,
        0
      ) || null,

    accountId:
      safeString(
        input.accountId
      ),

    accountType:
      normalizeAccountType(
        input.accountType
      ),

    currency:
      safeString(
        input.currency,
        'USD'
      ) || 'USD',

    symbol:
      safeString(
        input.symbol,
        'R_100'
      ) || 'R_100',

    strategy:
      safeString(
        input.strategy,
        'DIGITDIFF'
      ) || 'DIGITDIFF',

    predictionDigit:
      safeString(
        input.predictionDigit,
        '0'
      ),

    baseStake:
      safePositiveNumber(
        input.baseStake,
        1
      ),

    currentStake:
      safePositiveNumber(
        input.currentStake,
        1
      ),

    martingale:
      safePositiveNumber(
        input.martingale,
        2
      ),

    takeProfit:
      safeNonNegativeNumber(
        input.takeProfit,
        10
      ),

    stopLoss:
      safeNonNegativeNumber(
        input.stopLoss,
        20
      ),

    maxConsecutiveLosses:
      safePositiveInteger(
        input.maxConsecutiveLosses,
        3
      ),

    maxStake:
      safePositiveNumber(
        input.maxStake,
        10
      ),

    maxTrades:
      safePositiveInteger(
        input.maxTrades,
        10
      ),

    cooldownSeconds:
      safeNonNegativeNumber(
        input.cooldownSeconds,
        2
      ),

    minimumConfidence:
      safeNonNegativeNumber(
        input.minimumConfidence,
        60
      ),

    duration:
      safePositiveInteger(
        input.duration,
        1
      ),

    totalProfit:
      safeNumber(
        input.totalProfit,
        0
      ),

    tradeCount:
      safeNonNegativeNumber(
        input.tradeCount,
        0
      ),

    winCount:
      safeNonNegativeNumber(
        input.winCount,
        0
      ),

    lossCount:
      safeNonNegativeNumber(
        input.lossCount,
        0
      ),

    drawCount:
      safeNonNegativeNumber(
        input.drawCount,
        0
      ),

    consecutiveLosses:
      safeNonNegativeNumber(
        input.consecutiveLosses,
        0
      ),

    tradeHistory:
      normalizeTradeHistory(
        input.tradeHistory
      ),

    botWasRunning:
      Boolean(
        input.botWasRunning
      ),
  };

  return {
    valid: true,
    reason: '',
    state,
  };
}

export function saveSessionState(
  input
) {
  if (!hasSessionStorage()) {
    return {
      saved: false,
      reason:
        'Session storage is unavailable.',
    };
  }

  const normalized =
    normalizeSessionState({
      ...input,
      version:
        SESSION_STATE_VERSION,
      savedAt: Date.now(),
    });

  if (!normalized.valid) {
    return {
      saved: false,
      reason:
        normalized.reason,
    };
  }

  try {
    window.sessionStorage.setItem(
      SESSION_STATE_STORAGE_KEY,
      JSON.stringify(
        normalized.state
      )
    );

    return {
      saved: true,
      reason: '',
      state:
        normalized.state,
    };
  } catch {
    return {
      saved: false,
      reason:
        'Unable to save session state.',
    };
  }
}

export function loadSessionState() {
  if (!hasSessionStorage()) {
    return {
      found: false,
      valid: false,
      expired: false,
      reason:
        'Session storage is unavailable.',
      state: null,
    };
  }

  try {
    const raw =
      window.sessionStorage.getItem(
        SESSION_STATE_STORAGE_KEY
      );

    if (!raw) {
      return {
        found: false,
        valid: false,
        expired: false,
        reason:
          'No stored session state.',
        state: null,
      };
    }

    const parsed =
      JSON.parse(raw);

    const normalized =
      normalizeSessionState(
        parsed
      );

    if (!normalized.valid) {
      return {
        found: true,
        valid: false,
        expired: false,
        reason:
          normalized.reason,
        state: null,
      };
    }

    const savedAt =
      normalized.state.savedAt;

    if (
      !savedAt ||
      Date.now() - savedAt >
        MAX_STATE_AGE_MS
    ) {
      return {
        found: true,
        valid: false,
        expired: true,
        reason:
          'Stored session state expired.',
        state:
          normalized.state,
      };
    }

    return {
      found: true,
      valid: true,
      expired: false,
      reason: '',
      state:
        normalized.state,
    };
  } catch {
    return {
      found: true,
      valid: false,
      expired: false,
      reason:
        'Stored session state is unreadable.',
      state: null,
    };
  }
}

export function clearSessionState() {
  if (!hasSessionStorage()) {
    return false;
  }

  try {
    window.sessionStorage.removeItem(
      SESSION_STATE_STORAGE_KEY
    );

    return true;
  } catch {
    return false;
  }
}

export function canRestoreSessionState(
  storedState,
  {
    accountId,
    accountType,
  } = {}
) {
  const normalized =
    normalizeSessionState(
      storedState
    );

  if (!normalized.valid) {
    return {
      allowed: false,
      reason:
        normalized.reason,
      state: null,
    };
  }

  const state =
    normalized.state;

  if (
    state.accountType !==
    'demo'
  ) {
    return {
      allowed: false,
      reason:
        'Stored session state is not from a demo account.',
      state,
    };
  }

  if (
    accountType !== 'demo'
  ) {
    return {
      allowed: false,
      reason:
        'Session state can only be restored into a demo account.',
      state,
    };
  }

  if (
    !state.accountId ||
    !accountId ||
    state.accountId !==
      accountId
  ) {
    return {
      allowed: false,
      reason:
        'Stored session belongs to a different account.',
      state,
    };
  }

  return {
    allowed: true,
    reason: '',
    state,
  };
}

export function buildRestoredSessionState(
  storedState
) {
  const normalized =
    normalizeSessionState(
      storedState
    );

  if (!normalized.valid) {
    return {
      valid: false,
      reason:
        normalized.reason,
      state: null,
    };
  }

  const state =
    normalized.state;

  /*
   * IMPORTANT:
   * We intentionally DO NOT restore a running bot.
   *
   * The UI/session statistics can be restored,
   * but trading must always restart in Standby
   * and require an explicit user action.
   */
  return {
    valid: true,
    reason: '',
    state: {
      ...state,
      botWasRunning: false,
    },
  };
}

export function getSessionStateStatus(
  storedState
) {
  const normalized =
    normalizeSessionState(
      storedState
    );

  if (!normalized.valid) {
    return {
      valid: false,
      label:
        'No valid stored session',
      tradeCount: 0,
      totalProfit: 0,
      botAutoResume: false,
    };
  }

  const state =
    normalized.state;

  return {
    valid: true,

    label:
      state.tradeCount > 0
        ? `${state.tradeCount} trades stored`
        : 'Session state stored',

    tradeCount:
      state.tradeCount,

    totalProfit:
      state.totalProfit,

    symbol:
      state.symbol,

    strategy:
      state.strategy,

    accountId:
      state.accountId,

    accountType:
      state.accountType,

    savedAt:
      state.savedAt,

    botAutoResume: false,
  };
}
