// ============================================================
// BinarySpot Pro
// Bot Safety & Session Risk Engine
// ============================================================

export const BOT_STOP_REASONS = {
  MANUAL: 'MANUAL',
  EMERGENCY: 'EMERGENCY',
  TAKE_PROFIT: 'TAKE_PROFIT',
  STOP_LOSS: 'STOP_LOSS',
  MAX_TRADES: 'MAX_TRADES',
  MAX_LOSSES: 'MAX_LOSSES',
  MAX_STAKE: 'MAX_STAKE',
  REAL_ACCOUNT: 'REAL_ACCOUNT',
  SOCKET: 'SOCKET',
  INVALID_SETTINGS: 'INVALID_SETTINGS',
};

// ============================================================
// NUMBER HELPERS
// ============================================================

function safeNumber(value, fallback = 0) {
  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : fallback;
}

function money(value) {
  return Number(
    safeNumber(value).toFixed(2)
  );
}

// ============================================================
// SETTINGS VALIDATION
// ============================================================

export function validateBotSettings({
  accountType,
  baseStake,
  maxStake,
  martingale,
  takeProfit,
  stopLoss,
  maxTrades,
  maxConsecutiveLosses,
  cooldownSeconds,
  minimumConfidence,
}) {
  if (accountType !== 'demo') {
    return {
      valid: false,
      reason:
        'Automatic execution is restricted to Demo accounts.',
      code: BOT_STOP_REASONS.REAL_ACCOUNT,
    };
  }

  const stake =
    safeNumber(baseStake);

  const maximumStake =
    safeNumber(maxStake);

  const multiplier =
    safeNumber(martingale);

  const trades =
    Math.floor(
      safeNumber(maxTrades)
    );

  const losses =
    Math.floor(
      safeNumber(
        maxConsecutiveLosses
      )
    );

  const cooldown =
    safeNumber(cooldownSeconds);

  const confidence =
    safeNumber(
      minimumConfidence
    );

  const tp =
    safeNumber(takeProfit);

  const sl =
    safeNumber(stopLoss);

  if (stake <= 0) {
    return {
      valid: false,
      reason:
        'Base stake must be greater than zero.',
      code:
        BOT_STOP_REASONS.INVALID_SETTINGS,
    };
  }

  if (maximumStake <= 0) {
    return {
      valid: false,
      reason:
        'Maximum stake must be greater than zero.',
      code:
        BOT_STOP_REASONS.INVALID_SETTINGS,
    };
  }

  if (stake > maximumStake) {
    return {
      valid: false,
      reason:
        'Base stake cannot exceed Maximum Stake.',
      code:
        BOT_STOP_REASONS.INVALID_SETTINGS,
    };
  }

  if (multiplier < 1) {
    return {
      valid: false,
      reason:
        'Martingale multiplier cannot be below 1.',
      code:
        BOT_STOP_REASONS.INVALID_SETTINGS,
    };
  }

  if (trades < 1) {
    return {
      valid: false,
      reason:
        'Maximum Trades must be at least 1.',
      code:
        BOT_STOP_REASONS.INVALID_SETTINGS,
    };
  }

  if (losses < 1) {
    return {
      valid: false,
      reason:
        'Maximum Consecutive Losses must be at least 1.',
      code:
        BOT_STOP_REASONS.INVALID_SETTINGS,
    };
  }

  if (cooldown < 0) {
    return {
      valid: false,
      reason:
        'Cooldown cannot be negative.',
      code:
        BOT_STOP_REASONS.INVALID_SETTINGS,
    };
  }

  if (
    confidence < 0 ||
    confidence > 100
  ) {
    return {
      valid: false,
      reason:
        'Minimum Confidence must be between 0 and 100.',
      code:
        BOT_STOP_REASONS.INVALID_SETTINGS,
    };
  }

  if (tp < 0) {
    return {
      valid: false,
      reason:
        'Take Profit cannot be negative.',
      code:
        BOT_STOP_REASONS.INVALID_SETTINGS,
    };
  }

  if (sl < 0) {
    return {
      valid: false,
      reason:
        'Stop Loss cannot be negative.',
      code:
        BOT_STOP_REASONS.INVALID_SETTINGS,
    };
  }

  return {
    valid: true,
    reason: 'Settings valid.',
    code: null,
  };
}

// ============================================================
// ENTRY LOCK
// ============================================================

export function canOpenNewContract({
  botRunning,
  emergencyStopped,
  accountType,
  tradingConnected,
  proposalPending,
  buyPending,
  contractOpen,
  cooldownUntil,
  tradeCount,
  maxTrades,
}) {
  if (!botRunning) {
    return {
      allowed: false,
      reason: 'Bot is not running.',
    };
  }

  if (emergencyStopped) {
    return {
      allowed: false,
      reason:
        'Emergency Stop is active.',
    };
  }

  if (accountType !== 'demo') {
    return {
      allowed: false,
      reason:
        'Real-account execution is blocked.',
      stopBot: true,
      code:
        BOT_STOP_REASONS.REAL_ACCOUNT,
    };
  }

  if (!tradingConnected) {
    return {
      allowed: false,
      reason:
        'Trading socket is disconnected.',
      stopBot: true,
      code:
        BOT_STOP_REASONS.SOCKET,
    };
  }

  if (contractOpen) {
    return {
      allowed: false,
      reason:
        'An existing contract is still open.',
    };
  }

  if (proposalPending) {
    return {
      allowed: false,
      reason:
        'A proposal request is already pending.',
    };
  }

  if (buyPending) {
    return {
      allowed: false,
      reason:
        'A purchase request is already pending.',
    };
  }

  const now = Date.now();

  const cooldown =
    safeNumber(cooldownUntil);

  if (now < cooldown) {
    return {
      allowed: false,

      reason:
        'Bot is cooling down.',

      cooldownRemaining:
        Math.max(
          0,
          Math.ceil(
            (cooldown - now) /
              1000
          )
        ),
    };
  }

  if (
    safeNumber(tradeCount) >=
    safeNumber(maxTrades)
  ) {
    return {
      allowed: false,
      reason:
        'Maximum trade limit reached.',
      stopBot: true,
      code:
        BOT_STOP_REASONS.MAX_TRADES,
    };
  }

  return {
    allowed: true,
    reason:
      'Entry permitted.',
  };
}

// ============================================================
// SETTLEMENT SAFETY
// ============================================================

export function evaluateSettlementSafety({
  profit,
  totalProfit,
  tradeCount,
  consecutiveLosses,
  takeProfit,
  stopLoss,
  maxTrades,
  maxConsecutiveLosses,
}) {
  const contractProfit =
    money(profit);

  const nextTotal =
    money(
      safeNumber(
        totalProfit
      ) + contractProfit
    );

  const nextTradeCount =
    Math.floor(
      safeNumber(tradeCount)
    ) + 1;

  const won =
    contractProfit > 0;

  const lost =
    contractProfit < 0;

  const nextLosses = won
    ? 0
    : lost
    ? Math.floor(
        safeNumber(
          consecutiveLosses
        )
      ) + 1
    : Math.floor(
        safeNumber(
          consecutiveLosses
        )
      );

  const tp =
    safeNumber(takeProfit);

  const sl =
    safeNumber(stopLoss);

  const tradeLimit =
    Math.floor(
      safeNumber(maxTrades)
    );

  const lossLimit =
    Math.floor(
      safeNumber(
        maxConsecutiveLosses
      )
    );

  let stopBot = false;
  let stopReason = null;
  let stopCode = null;

  if (
    tp > 0 &&
    nextTotal >= tp
  ) {
    stopBot = true;

    stopReason =
      `Take Profit reached: +${nextTotal.toFixed(
        2
      )}`;

    stopCode =
      BOT_STOP_REASONS.TAKE_PROFIT;
  } else if (
    sl > 0 &&
    nextTotal <= -sl
  ) {
    stopBot = true;

    stopReason =
      `Stop Loss reached: ${nextTotal.toFixed(
        2
      )}`;

    stopCode =
      BOT_STOP_REASONS.STOP_LOSS;
  } else if (
    tradeLimit > 0 &&
    nextTradeCount >=
      tradeLimit
  ) {
    stopBot = true;

    stopReason =
      `Maximum trades reached (${tradeLimit})`;

    stopCode =
      BOT_STOP_REASONS.MAX_TRADES;
  } else if (
    lost &&
    lossLimit > 0 &&
    nextLosses >= lossLimit
  ) {
    stopBot = true;

    stopReason =
      `Maximum consecutive losses reached (${lossLimit})`;

    stopCode =
      BOT_STOP_REASONS.MAX_LOSSES;
  }

  return {
    profit:
      contractProfit,

    won,
    lost,

    nextTotalProfit:
      nextTotal,

    nextTradeCount,

    nextConsecutiveLosses:
      nextLosses,

    stopBot,
    stopReason,
    stopCode,
  };
}

// ============================================================
// NEXT STAKE
// ============================================================

export function calculateNextStake({
  won,
  baseStake,
  currentStake,
  martingale,
  maxStake,
}) {
  const base =
    money(baseStake);

  const current =
    money(currentStake);

  const multiplier =
    Math.max(
      1,
      safeNumber(
        martingale,
        1
      )
    );

  const maximum =
    money(maxStake);

  if (won) {
    return {
      allowed: true,

      stake: base,

      reset: true,

      reason:
        'Winning trade — stake reset to base stake.',
    };
  }

  const proposed =
    money(
      current *
        multiplier
    );

  if (
    proposed > maximum
  ) {
    return {
      allowed: false,

      stake: current,

      proposedStake:
        proposed,

      reason:
        `Next stake ${proposed.toFixed(
          2
        )} exceeds Maximum Stake ${maximum.toFixed(
          2
        )}.`,

      stopCode:
        BOT_STOP_REASONS.MAX_STAKE,
    };
  }

  return {
    allowed: true,

    stake:
      proposed,

    reset: false,

    reason:
      `Next stake set to ${proposed.toFixed(
        2
      )}.`,
  };
}

// ============================================================
// COOLDOWN
// ============================================================

export function createCooldown(
  seconds
) {
  const duration =
    Math.max(
      0,
      safeNumber(seconds)
    );

  return Date.now() +
    duration * 1000;
}

export function getCooldownStatus(
  cooldownUntil
) {
  const remaining =
    Math.max(
      0,
      Math.ceil(
        (
          safeNumber(
            cooldownUntil
          ) -
          Date.now()
        ) / 1000
      )
    );

  return {
    active:
      remaining > 0,

    remaining,
  };
}

// ============================================================
// SESSION STATUS
// ============================================================

export function buildSessionStatus({
  running,
  emergencyStopped,
  contractOpen,
  proposalPending,
  buyPending,
  cooldownUntil,
}) {
  if (emergencyStopped) {
    return {
      state:
        'EMERGENCY_STOP',

      label:
        'Emergency Stop',

      severity:
        'danger',
    };
  }

  if (!running) {
    return {
      state:
        'STANDBY',

      label:
        'Standby',

      severity:
        'neutral',
    };
  }

  if (contractOpen) {
    return {
      state:
        'CONTRACT_ACTIVE',

      label:
        'Contract Active',

      severity:
        'warning',
    };
  }

  if (buyPending) {
    return {
      state:
        'BUY_PENDING',

      label:
        'Purchase Pending',

      severity:
        'warning',
    };
  }

  if (proposalPending) {
    return {
      state:
        'PROPOSAL_PENDING',

      label:
        'Proposal Pending',

      severity:
        'info',
    };
  }

  const cooldown =
    getCooldownStatus(
      cooldownUntil
    );

  if (cooldown.active) {
    return {
      state:
        'COOLDOWN',

      label:
        `Cooldown ${cooldown.remaining}s`,

      severity:
        'info',
    };
  }

  return {
    state:
      'SCANNING',

    label:
      'Scanning Market',

    severity:
      'success',
  };
}
