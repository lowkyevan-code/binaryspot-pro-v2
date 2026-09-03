// ============================================================
// BinarySpot Pro
// Pending BUY Disconnect Recovery Guard
// ============================================================
//
// Purpose:
//
// Handle the dangerous window:
//
//   BUY request sent
//          ↓
//   WebSocket disconnects
//          ↓
//   BUY response / contract_id never reaches the browser
//
// In that situation BinarySpot Pro MUST NOT assume:
//
// - the purchase failed
// - the purchase succeeded
// - a random portfolio contract belongs to this BUY
//
// Instead we preserve an AMBIGUOUS state and block new entries
// until reconciliation can be performed safely.
//
// IMPORTANT:
//
// - This module does NOT place trades.
// - This module does NOT enable real-money execution.
// - This module does NOT automatically adopt portfolio contracts.
// - Demo-only reconciliation will be integrated separately.
// ============================================================

export const PENDING_BUY_STATE =
  Object.freeze({
    IDLE: 'idle',

    PENDING: 'pending',

    AMBIGUOUS: 'ambiguous',

    RECONCILING: 'reconciling',

    RESOLVED_CONTRACT:
      'resolved_contract',

    RESOLVED_NO_CONTRACT:
      'resolved_no_contract',
  });

export const PENDING_BUY_RESOLUTION =
  Object.freeze({
    NONE: 'none',

    CONTRACT_FOUND:
      'contract_found',

    NO_CONTRACT:
      'no_contract',
  });

// ============================================================
// HELPERS
// ============================================================

function safeString(value) {
  if (
    value === null ||
    value === undefined
  ) {
    return '';
  }

  return String(value).trim();
}

function safeReqId(value) {
  const number =
    Number(value);

  if (
    !Number.isInteger(number) ||
    number < 0
  ) {
    return null;
  }

  return number;
}

function safeTimestamp(value) {
  const number =
    Number(value);

  if (
    !Number.isFinite(number) ||
    number <= 0
  ) {
    return null;
  }

  return number;
}

function safeContractId(value) {
  if (
    value === null ||
    value === undefined
  ) {
    return null;
  }

  const text =
    String(value).trim();

  if (
    !text ||
    !/^\d+$/.test(text)
  ) {
    return null;
  }

  return text;
}

function normalizeOwner(value) {
  const owner =
    safeString(value)
      .toLowerCase();

  if (
    owner === 'auto' ||
    owner === 'manual'
  ) {
    return owner;
  }

  return 'unknown';
}

function normalizeAccountType(value) {
  const type =
    safeString(value)
      .toLowerCase();

  if (type === 'demo') {
    return 'demo';
  }

  if (type === 'real') {
    return 'real';
  }

  return 'unknown';
}

// ============================================================
// CREATE
// ============================================================

export function createPendingBuyRecovery() {
  return {
    state:
      PENDING_BUY_STATE.IDLE,

    reqId: null,

    proposalId: '',

    accountId: '',

    accountType: 'unknown',

    owner: 'unknown',

    symbol: '',

    strategy: '',

    expectedStake: null,

    startedAt: null,

    disconnectedAt: null,

    reconciliationStartedAt: null,

    resolvedAt: null,

    contractId: null,

    resolution:
      PENDING_BUY_RESOLUTION.NONE,
  };
}

// ============================================================
// REGISTER BUY
// ============================================================

export function registerPendingBuy(
  current,
  {
    reqId,
    proposalId,
    accountId,
    accountType,
    owner,
    symbol,
    strategy,
    expectedStake,
    startedAt = Date.now(),
  } = {}
) {
  const normalizedReqId =
    safeReqId(reqId);

  const normalizedProposalId =
    safeString(proposalId);

  const normalizedAccountId =
    safeString(accountId);

  const normalizedStartedAt =
    safeTimestamp(startedAt);

  const stake =
    Number(expectedStake);

  if (
    normalizedReqId === null
  ) {
    return {
      valid: false,

      reason:
        'A valid BUY request ID is required.',

      recovery:
        current ||
        createPendingBuyRecovery(),
    };
  }

  if (
    !normalizedProposalId
  ) {
    return {
      valid: false,

      reason:
        'A proposal ID is required for BUY recovery.',

      recovery:
        current ||
        createPendingBuyRecovery(),
    };
  }

  if (!normalizedAccountId) {
    return {
      valid: false,

      reason:
        'A Deriv account ID is required for BUY recovery.',

      recovery:
        current ||
        createPendingBuyRecovery(),
    };
  }

  if (!normalizedStartedAt) {
    return {
      valid: false,

      reason:
        'A valid BUY start time is required.',

      recovery:
        current ||
        createPendingBuyRecovery(),
    };
  }

  if (
    !Number.isFinite(stake) ||
    stake <= 0
  ) {
    return {
      valid: false,

      reason:
        'A valid expected BUY stake is required.',

      recovery:
        current ||
        createPendingBuyRecovery(),
    };
  }

  return {
    valid: true,

    reason: '',

    recovery: {
      state:
        PENDING_BUY_STATE.PENDING,

      reqId:
        normalizedReqId,

      proposalId:
        normalizedProposalId,

      accountId:
        normalizedAccountId,

      accountType:
        normalizeAccountType(
          accountType
        ),

      owner:
        normalizeOwner(owner),

      symbol:
        safeString(symbol),

      strategy:
        safeString(strategy),

      expectedStake: stake,

      startedAt:
        normalizedStartedAt,

      disconnectedAt: null,

      reconciliationStartedAt:
        null,

      resolvedAt: null,

      contractId: null,

      resolution:
        PENDING_BUY_RESOLUTION.NONE,
    },
  };
}

// ============================================================
// DISCONNECT
// ============================================================

export function markPendingBuyAmbiguous(
  current,
  disconnectedAt = Date.now()
) {
  const recovery =
    current ||
    createPendingBuyRecovery();

  if (
    recovery.state !==
    PENDING_BUY_STATE.PENDING
  ) {
    return recovery;
  }

  return {
    ...recovery,

    state:
      PENDING_BUY_STATE.AMBIGUOUS,

    disconnectedAt:
      safeTimestamp(
        disconnectedAt
      ) || Date.now(),

    resolution:
      PENDING_BUY_RESOLUTION.NONE,

    contractId: null,
  };
}

// ============================================================
// RECONCILIATION
// ============================================================

export function canReconcilePendingBuy(
  current,
  {
    accountId,
    accountType,
    tradingConnected,
  } = {}
) {
  const recovery =
    current ||
    createPendingBuyRecovery();

  if (
    recovery.state !==
      PENDING_BUY_STATE.AMBIGUOUS &&
    recovery.state !==
      PENDING_BUY_STATE.RECONCILING
  ) {
    return {
      allowed: false,

      reason:
        'There is no ambiguous BUY to reconcile.',
    };
  }

  if (
    recovery.accountType !==
      'demo' ||
    normalizeAccountType(
      accountType
    ) !== 'demo'
  ) {
    return {
      allowed: false,

      reason:
        'Pending BUY reconciliation is restricted to demo accounts.',
    };
  }

  if (
    !safeString(accountId) ||
    safeString(accountId) !==
      recovery.accountId
  ) {
    return {
      allowed: false,

      reason:
        'Pending BUY belongs to a different Deriv account.',
    };
  }

  if (!tradingConnected) {
    return {
      allowed: false,

      reason:
        'Authenticated trading socket is not connected.',
    };
  }

  return {
    allowed: true,

    reason: '',
  };
}

export function beginPendingBuyReconciliation(
  current,
  now = Date.now()
) {
  const recovery =
    current ||
    createPendingBuyRecovery();

  if (
    recovery.state !==
    PENDING_BUY_STATE.AMBIGUOUS
  ) {
    return recovery;
  }

  return {
    ...recovery,

    state:
      PENDING_BUY_STATE.RECONCILING,

    reconciliationStartedAt:
      safeTimestamp(now) ||
      Date.now(),
  };
}

// ============================================================
// RESOLVE WITH KNOWN CONTRACT
// ============================================================

export function resolvePendingBuyWithContract(
  current,
  contractId,
  now = Date.now()
) {
  const recovery =
    current ||
    createPendingBuyRecovery();

  const normalizedContractId =
    safeContractId(contractId);

  if (!normalizedContractId) {
    return {
      valid: false,

      reason:
        'A valid recovered contract ID is required.',

      recovery,
    };
  }

  if (
    ![
      PENDING_BUY_STATE.PENDING,
      PENDING_BUY_STATE.AMBIGUOUS,
      PENDING_BUY_STATE.RECONCILING,
    ].includes(recovery.state)
  ) {
    return {
      valid: false,

      reason:
        'Pending BUY is not in a recoverable state.',

      recovery,
    };
  }

  return {
    valid: true,

    reason: '',

    recovery: {
      ...recovery,

      state:
        PENDING_BUY_STATE.RESOLVED_CONTRACT,

      contractId:
        normalizedContractId,

      resolvedAt:
        safeTimestamp(now) ||
        Date.now(),

      resolution:
        PENDING_BUY_RESOLUTION.CONTRACT_FOUND,
    },
  };
}

// ============================================================
// RESOLVE AS NO CONTRACT
// ============================================================
//
// IMPORTANT:
//
// This function only records a decision.
//
// It does NOT decide that no contract exists.
//
// File 47+ must only call this after a reconciliation process
// has enough evidence to make that conclusion safely.
// ============================================================

export function resolvePendingBuyWithoutContract(
  current,
  now = Date.now()
) {
  const recovery =
    current ||
    createPendingBuyRecovery();

  if (
    ![
      PENDING_BUY_STATE.AMBIGUOUS,
      PENDING_BUY_STATE.RECONCILING,
    ].includes(recovery.state)
  ) {
    return {
      valid: false,

      reason:
        'Pending BUY is not awaiting reconciliation.',

      recovery,
    };
  }

  return {
    valid: true,

    reason: '',

    recovery: {
      ...recovery,

      state:
        PENDING_BUY_STATE.RESOLVED_NO_CONTRACT,

      contractId: null,

      resolvedAt:
        safeTimestamp(now) ||
        Date.now(),

      resolution:
        PENDING_BUY_RESOLUTION.NO_CONTRACT,
    },
  };
}

// ============================================================
// RESET
// ============================================================

export function clearPendingBuyRecovery() {
  return createPendingBuyRecovery();
}

// ============================================================
// STATUS
// ============================================================

export function getPendingBuyRecoveryStatus(
  current
) {
  const recovery =
    current ||
    createPendingBuyRecovery();

  const ambiguous =
    recovery.state ===
      PENDING_BUY_STATE.AMBIGUOUS ||
    recovery.state ===
      PENDING_BUY_STATE.RECONCILING;

  const blocking =
    recovery.state ===
      PENDING_BUY_STATE.PENDING ||
    ambiguous;

  let label =
    'No pending BUY ambiguity';

  if (
    recovery.state ===
    PENDING_BUY_STATE.PENDING
  ) {
    label =
      `BUY #${recovery.reqId} awaiting response`;
  }

  if (
    recovery.state ===
    PENDING_BUY_STATE.AMBIGUOUS
  ) {
    label =
      `BUY #${recovery.reqId} requires reconciliation`;
  }

  if (
    recovery.state ===
    PENDING_BUY_STATE.RECONCILING
  ) {
    label =
      `Reconciling BUY #${recovery.reqId}`;
  }

  if (
    recovery.state ===
    PENDING_BUY_STATE.RESOLVED_CONTRACT
  ) {
    label =
      `BUY resolved → Contract #${recovery.contractId}`;
  }

  if (
    recovery.state ===
    PENDING_BUY_STATE.RESOLVED_NO_CONTRACT
  ) {
    label =
      `BUY #${recovery.reqId} resolved without contract`;
  }

  return {
    state:
      recovery.state,

    label,

    blocking,

    ambiguous,

    reqId:
      recovery.reqId,

    proposalId:
      recovery.proposalId,

    accountId:
      recovery.accountId,

    accountType:
      recovery.accountType,

    owner:
      recovery.owner,

    symbol:
      recovery.symbol,

    strategy:
      recovery.strategy,

    expectedStake:
      recovery.expectedStake,

    startedAt:
      recovery.startedAt,

    disconnectedAt:
      recovery.disconnectedAt,

    contractId:
      recovery.contractId,

    resolution:
      recovery.resolution,
  };
}

// ============================================================
// NEW ENTRY GUARD
// ============================================================

export function canOpenAfterPendingBuy(
  current
) {
  const status =
    getPendingBuyRecoveryStatus(
      current
    );

  if (status.blocking) {
    return {
      allowed: false,

      reason:
        status.ambiguous
          ? 'A BUY request may have executed before the connection was lost. Reconcile it before opening another contract.'
          : 'A BUY request is still awaiting its response.',
    };
  }

  return {
    allowed: true,

    reason: '',
  };
}

// ============================================================
// PORTFOLIO RECONCILIATION SUPPORT
// ============================================================
//
// Deriv portfolio returns ALL currently open contracts for the
// authenticated account.
//
// Therefore BinarySpot Pro must not automatically claim a
// portfolio contract merely because one exists.
//
// This helper only extracts normalized candidate information.
// It intentionally does NOT choose a winner.
// ============================================================

export function normalizePortfolioCandidates(
  contracts
) {
  if (!Array.isArray(contracts)) {
    return [];
  }

  return contracts
    .map((contract) => {
      if (
        !contract ||
        typeof contract !==
          'object'
      ) {
        return null;
      }

      const contractId =
        safeContractId(
          contract.contract_id
        );

      if (!contractId) {
        return null;
      }

      const buyPrice =
        Number(
          contract.buy_price
        );

      return {
        contractId,

        contractType:
          safeString(
            contract.contract_type
          ),

        underlyingSymbol:
          safeString(
            contract.underlying_symbol
          ),

        buyPrice:
          Number.isFinite(
            buyPrice
          )
            ? buyPrice
            : null,

        currency:
          safeString(
            contract.currency
          ),

        appId:
          contract.app_id ??
          null,

        raw: contract,
      };
    })
    .filter(Boolean);
}

// ============================================================
// CONSERVATIVE CANDIDATE FILTER
// ============================================================
//
// This is intentionally only a FILTER.
//
// A single returned candidate is NOT automatically proof that
// it belongs to our missing BUY.
//
// File 47 can combine this with stronger reconciliation rules.
// ============================================================

export function filterPendingBuyCandidates(
  current,
  contracts
) {
  const recovery =
    current ||
    createPendingBuyRecovery();

  const candidates =
    normalizePortfolioCandidates(
      contracts
    );

  return candidates.filter(
    (candidate) => {
      if (
        recovery.symbol &&
        candidate.underlyingSymbol &&
        candidate.underlyingSymbol !==
          recovery.symbol
      ) {
        return false;
      }

      if (
        recovery.strategy &&
        candidate.contractType &&
        candidate.contractType !==
          recovery.strategy
      ) {
        return false;
      }

      if (
        Number.isFinite(
          recovery.expectedStake
        ) &&
        Number.isFinite(
          candidate.buyPrice
        )
      ) {
        const difference =
          Math.abs(
            recovery.expectedStake -
              candidate.buyPrice
          );

        if (difference > 0.01) {
          return false;
        }
      }

      return true;
    }
  );
}
