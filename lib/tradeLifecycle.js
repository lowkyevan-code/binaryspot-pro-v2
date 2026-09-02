// ============================================================
// BinarySpot Pro
// Automated Trade Lifecycle Guard
// ============================================================

export function createTradeLifecycle() {
  return {
    mode: null,
    contractId: null,
    startedAt: null,
    settled: false,
  };
}

// ============================================================
// MARK PROPOSAL / TRADE MODE
// ============================================================

export function beginTradeLifecycle({
  mode = 'manual',
} = {}) {
  return {
    mode:
      mode === 'auto'
        ? 'auto'
        : 'manual',

    contractId: null,

    startedAt:
      Date.now(),

    settled: false,
  };
}

// ============================================================
// ATTACH CONTRACT ID
// ============================================================

export function attachContractToLifecycle(
  lifecycle,
  contractId
) {
  if (!lifecycle) {
    lifecycle =
      createTradeLifecycle();
  }

  return {
    ...lifecycle,

    contractId:
      contractId ?? null,

    settled: false,
  };
}

// ============================================================
// CHECK OWNERSHIP
// ============================================================

export function isAutoTrade(
  lifecycle,
  contractId = null
) {
  if (!lifecycle) {
    return false;
  }

  if (
    lifecycle.mode !== 'auto'
  ) {
    return false;
  }

  if (
    contractId !== null &&
    lifecycle.contractId !== null &&
    String(
      lifecycle.contractId
    ) !== String(contractId)
  ) {
    return false;
  }

  return true;
}

export function isManualTrade(
  lifecycle,
  contractId = null
) {
  if (!lifecycle) {
    return false;
  }

  if (
    lifecycle.mode !== 'manual'
  ) {
    return false;
  }

  if (
    contractId !== null &&
    lifecycle.contractId !== null &&
    String(
      lifecycle.contractId
    ) !== String(contractId)
  ) {
    return false;
  }

  return true;
}

// ============================================================
// SETTLEMENT DEDUPLICATION
// ============================================================

export function shouldProcessSettlement(
  lifecycle,
  contractId
) {
  if (!lifecycle) {
    return true;
  }

  if (
    lifecycle.settled
  ) {
    return false;
  }

  if (
    lifecycle.contractId !== null &&
    contractId !== null &&
    String(
      lifecycle.contractId
    ) !== String(contractId)
  ) {
    return false;
  }

  return true;
}

export function markLifecycleSettled(
  lifecycle,
  contractId = null
) {
  if (!lifecycle) {
    lifecycle =
      createTradeLifecycle();
  }

  return {
    ...lifecycle,

    contractId:
      contractId ??
      lifecycle.contractId ??
      null,

    settled: true,
  };
}

// ============================================================
// RESULT CLASSIFICATION
// ============================================================

export function classifyTradeResult(
  profit
) {
  const value =
    Number(profit);

  const safeProfit =
    Number.isFinite(value)
      ? value
      : 0;

  if (safeProfit > 0) {
    return {
      result: 'WIN',

      won: true,
      lost: false,
      draw: false,

      profit:
        Number(
          safeProfit.toFixed(2)
        ),
    };
  }

  if (safeProfit < 0) {
    return {
      result: 'LOSS',

      won: false,
      lost: true,
      draw: false,

      profit:
        Number(
          safeProfit.toFixed(2)
        ),
    };
  }

  return {
    result: 'DRAW',

    won: false,
    lost: false,
    draw: true,

    profit: 0,
  };
}

// ============================================================
// NEXT ACTION AFTER SETTLEMENT
// ============================================================

export function getPostSettlementAction({
  lifecycle,
  botRunning,
  emergencyStopped,
  safetyStopTriggered,
}) {
  if (
    safetyStopTriggered
  ) {
    return {
      continueBot: false,

      reason:
        'Session safety limit reached.',
    };
  }

  if (
    emergencyStopped
  ) {
    return {
      continueBot: false,

      reason:
        'Emergency Stop is active.',
    };
  }

  if (
    !botRunning
  ) {
    return {
      continueBot: false,

      reason:
        'Bot was stopped before settlement.',
    };
  }

  if (
    lifecycle?.mode !==
    'auto'
  ) {
    return {
      continueBot: false,

      reason:
        'Manual trade settled.',
    };
  }

  return {
    continueBot: true,

    reason:
      'Automated trade settled normally.',
  };
}

// ============================================================
// DISPLAY HELPERS
// ============================================================

export function describeLifecycle(
  lifecycle
) {
  if (!lifecycle) {
    return 'No active lifecycle';
  }

  if (lifecycle.settled) {
    return `${
      lifecycle.mode === 'auto'
        ? 'AUTO'
        : 'MANUAL'
    } — SETTLED`;
  }

  if (
    lifecycle.contractId
  ) {
    return `${
      lifecycle.mode === 'auto'
        ? 'AUTO'
        : 'MANUAL'
    } — CONTRACT ACTIVE`;
  }

  if (lifecycle.mode) {
    return `${
      lifecycle.mode === 'auto'
        ? 'AUTO'
        : 'MANUAL'
    } — ENTRY PENDING`;
  }

  return 'No active lifecycle';
}
