// ============================================================
// BinarySpot Pro
// Pending BUY Reconciliation Engine
// ============================================================
//
// Purpose:
//
// Reconcile this dangerous situation:
//
//   BUY sent
//      ↓
//   WebSocket disconnect
//      ↓
//   BUY response / contract_id lost
//
// Deriv portfolio only contains OPEN contracts.
//
// Therefore:
//
//   empty portfolio !== proof BUY failed
//
// A very short contract may already have settled before
// BinarySpot reconnects.
//
// We therefore support:
//
//   1. Open-contract inspection via portfolio
//   2. Recently settled-contract inspection via profit_table
//   3. Conservative candidate matching
//   4. Explicit ambiguity when evidence is insufficient
//
// IMPORTANT:
//
// - Does NOT place trades.
// - Does NOT enable real-money trading.
// - Does NOT blindly adopt arbitrary account positions.
// - Demo account reconciliation only.
// ============================================================

export const BUY_RECONCILIATION_STATE =
  Object.freeze({
    IDLE: 'idle',
    SEARCHING: 'searching',
    OPEN_CONTRACT_FOUND:
      'open_contract_found',
    SETTLED_CONTRACT_FOUND:
      'settled_contract_found',
    NO_MATCH: 'no_match',
    AMBIGUOUS: 'ambiguous',
    ERROR: 'error',
  });

export const BUY_RECONCILIATION_SOURCE =
  Object.freeze({
    NONE: 'none',
    PORTFOLIO: 'portfolio',
    PROFIT_TABLE: 'profit_table',
    BOTH: 'both',
  });

export const DEFAULT_RECONCILIATION_WINDOW_SECONDS =
  120;

// ============================================================
// BASIC HELPERS
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

function safeNumber(value) {
  const number =
    Number(value);

  return Number.isFinite(number)
    ? number
    : null;
}

function safeInteger(value) {
  const number =
    Number(value);

  if (
    !Number.isInteger(number)
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

function safeTimestampSeconds(value) {
  const number =
    Number(value);

  if (
    !Number.isFinite(number) ||
    number <= 0
  ) {
    return null;
  }

  return Math.floor(number);
}

function millisecondsToSeconds(value) {
  const number =
    Number(value);

  if (
    !Number.isFinite(number) ||
    number <= 0
  ) {
    return null;
  }

  return Math.floor(
    number / 1000
  );
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

function normalizeContractType(value) {
  return safeString(value)
    .toUpperCase();
}

function pricesMatch(
  expected,
  actual,
  tolerance = 0.01
) {
  const expectedNumber =
    safeNumber(expected);

  const actualNumber =
    safeNumber(actual);

  if (
    expectedNumber === null ||
    actualNumber === null
  ) {
    return false;
  }

  return (
    Math.abs(
      expectedNumber -
        actualNumber
    ) <= tolerance
  );
}

// ============================================================
// CREATE STATE
// ============================================================

export function createPendingBuyReconciliation() {
  return {
    state:
      BUY_RECONCILIATION_STATE.IDLE,

    source:
      BUY_RECONCILIATION_SOURCE.NONE,

    startedAt: null,

    completedAt: null,

    portfolioReceived: false,

    profitTableReceived: false,

    openCandidates: [],

    settledCandidates: [],

    selectedCandidate: null,

    reason: '',

    error: '',
  };
}

// ============================================================
// REQUEST BUILDERS
// ============================================================

export function buildPortfolioReconciliationRequest(
  reqId
) {
  const normalizedReqId =
    safeInteger(reqId);

  if (
    normalizedReqId === null ||
    normalizedReqId < 0
  ) {
    return {
      valid: false,

      reason:
        'A valid portfolio request ID is required.',

      payload: null,
    };
  }

  return {
    valid: true,

    reason: '',

    payload: {
      portfolio: 1,
      req_id:
        normalizedReqId,
    },
  };
}

export function buildProfitTableReconciliationRequest(
  reqId,
  {
    limit = 50,
  } = {}
) {
  const normalizedReqId =
    safeInteger(reqId);

  if (
    normalizedReqId === null ||
    normalizedReqId < 0
  ) {
    return {
      valid: false,

      reason:
        'A valid profit table request ID is required.',

      payload: null,
    };
  }

  let normalizedLimit =
    safeInteger(limit);

  if (
    normalizedLimit === null ||
    normalizedLimit < 1
  ) {
    normalizedLimit = 50;
  }

  normalizedLimit =
    Math.min(
      normalizedLimit,
      500
    );

  return {
    valid: true,

    reason: '',

    payload: {
      profit_table: 1,

      limit:
        normalizedLimit,

      sort: 'DESC',

      req_id:
        normalizedReqId,
    },
  };
}

// ============================================================
// START RECONCILIATION
// ============================================================

export function beginPendingBuyReconciliationSearch(
  current,
  now = Date.now()
) {
  return {
    ...(current ||
      createPendingBuyReconciliation()),

    state:
      BUY_RECONCILIATION_STATE.SEARCHING,

    source:
      BUY_RECONCILIATION_SOURCE.NONE,

    startedAt:
      Number.isFinite(
        Number(now)
      )
        ? Number(now)
        : Date.now(),

    completedAt: null,

    portfolioReceived: false,

    profitTableReceived: false,

    openCandidates: [],

    settledCandidates: [],

    selectedCandidate: null,

    reason:
      'Searching Deriv account history for the uncertain BUY.',

    error: '',
  };
}

// ============================================================
// NORMALIZE PORTFOLIO
// ============================================================

export function normalizePortfolioContracts(
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

      return {
        source:
          BUY_RECONCILIATION_SOURCE.PORTFOLIO,

        contractId,

        transactionId:
          contract.transaction_id !==
            undefined
            ? safeString(
                contract.transaction_id
              )
            : '',

        appId:
          safeInteger(
            contract.app_id
          ),

        contractType:
          normalizeContractType(
            contract.contract_type
          ),

        symbol:
          safeString(
            contract.underlying_symbol
          ),

        buyPrice:
          safeNumber(
            contract.buy_price
          ),

        currency:
          safeString(
            contract.currency
          ),

        purchaseTime:
          safeTimestampSeconds(
            contract.purchase_time
          ),

        isOpen: true,

        raw: contract,
      };
    })
    .filter(Boolean);
}

// ============================================================
// NORMALIZE PROFIT TABLE
// ============================================================

export function normalizeProfitTableTransactions(
  transactions
) {
  if (
    !Array.isArray(
      transactions
    )
  ) {
    return [];
  }

  return transactions
    .map((transaction) => {
      if (
        !transaction ||
        typeof transaction !==
          'object'
      ) {
        return null;
      }

      const purchaseTime =
        safeTimestampSeconds(
          transaction.purchase_time
        );

      if (!purchaseTime) {
        return null;
      }

      return {
        source:
          BUY_RECONCILIATION_SOURCE.PROFIT_TABLE,

        contractId:
          safeContractId(
            transaction.contract_id
          ),

        transactionId:
          transaction.transaction_id !==
            undefined
            ? safeString(
                transaction.transaction_id
              )
            : '',

        appId:
          safeInteger(
            transaction.app_id
          ),

        contractType:
          normalizeContractType(
            transaction.contract_type
          ),

        symbol:
          safeString(
            transaction.underlying_symbol
          ),

        buyPrice:
          safeNumber(
            transaction.buy_price
          ),

        sellPrice:
          safeNumber(
            transaction.sell_price
          ),

        payout:
          safeNumber(
            transaction.payout
          ),

        profit:
          safeNumber(
            transaction.profit
          ),

        currency:
          safeString(
            transaction.currency
          ),

        purchaseTime,

        isOpen: false,

        raw: transaction,
      };
    })
    .filter(Boolean);
}

// ============================================================
// VALIDATE PENDING BUY CONTEXT
// ============================================================

export function validatePendingBuyContext(
  pendingBuy,
  {
    accountId,
    accountType,
  } = {}
) {
  if (
    !pendingBuy ||
    typeof pendingBuy !==
      'object'
  ) {
    return {
      valid: false,

      reason:
        'Pending BUY recovery information is missing.',
    };
  }

  if (
    normalizeAccountType(
      pendingBuy.accountType
    ) !== 'demo' ||
    normalizeAccountType(
      accountType
    ) !== 'demo'
  ) {
    return {
      valid: false,

      reason:
        'BUY reconciliation is restricted to demo accounts.',
    };
  }

  const pendingAccount =
    safeString(
      pendingBuy.accountId
    );

  const currentAccount =
    safeString(accountId);

  if (
    !pendingAccount ||
    !currentAccount ||
    pendingAccount !==
      currentAccount
  ) {
    return {
      valid: false,

      reason:
        'The uncertain BUY belongs to a different Deriv account.',
    };
  }

  if (
    !safeString(
      pendingBuy.proposalId
    )
  ) {
    return {
      valid: false,

      reason:
        'The uncertain BUY has no proposal identity.',
    };
  }

  if (
    !Number.isFinite(
      Number(
        pendingBuy.startedAt
      )
    )
  ) {
    return {
      valid: false,

      reason:
        'The uncertain BUY has no valid start time.',
    };
  }

  return {
    valid: true,
    reason: '',
  };
}

// ============================================================
// TIME WINDOW
// ============================================================

export function getPendingBuyTimeWindow(
  pendingBuy,
  {
    windowSeconds =
      DEFAULT_RECONCILIATION_WINDOW_SECONDS,
  } = {}
) {
  const startedAtSeconds =
    millisecondsToSeconds(
      pendingBuy?.startedAt
    );

  if (!startedAtSeconds) {
    return {
      valid: false,

      from: null,

      to: null,
    };
  }

  let window =
    safeInteger(
      windowSeconds
    );

  if (
    window === null ||
    window < 5
  ) {
    window =
      DEFAULT_RECONCILIATION_WINDOW_SECONDS;
  }

  return {
    valid: true,

    from:
      startedAtSeconds - 10,

    to:
      startedAtSeconds +
      window,
  };
}

// ============================================================
// CANDIDATE MATCHING
// ============================================================

export function candidateMatchesPendingBuy(
  pendingBuy,
  candidate,
  {
    windowSeconds =
      DEFAULT_RECONCILIATION_WINDOW_SECONDS,
    priceTolerance = 0.01,
  } = {}
) {
  if (
    !pendingBuy ||
    !candidate
  ) {
    return {
      matched: false,

      score: 0,

      reasons: [],
    };
  }

  const reasons = [];

  let score = 0;

  const expectedSymbol =
    safeString(
      pendingBuy.symbol
    );

  const candidateSymbol =
    safeString(
      candidate.symbol
    );

  if (
    expectedSymbol &&
    candidateSymbol
  ) {
    if (
      expectedSymbol !==
      candidateSymbol
    ) {
      return {
        matched: false,

        score: 0,

        reasons: [
          'Symbol does not match.',
        ],
      };
    }

    score += 3;

    reasons.push(
      'Symbol matches.'
    );
  }

  const expectedType =
    normalizeContractType(
      pendingBuy.strategy
    );

  const candidateType =
    normalizeContractType(
      candidate.contractType
    );

  if (
    expectedType &&
    candidateType
  ) {
    if (
      expectedType !==
      candidateType
    ) {
      return {
        matched: false,

        score: 0,

        reasons: [
          'Contract type does not match.',
        ],
      };
    }

    score += 3;

    reasons.push(
      'Contract type matches.'
    );
  }

  if (
    candidate.buyPrice !==
      null &&
    pendingBuy.expectedStake !==
      null &&
    pendingBuy.expectedStake !==
      undefined
  ) {
    if (
      !pricesMatch(
        pendingBuy.expectedStake,
        candidate.buyPrice,
        priceTolerance
      )
    ) {
      return {
        matched: false,

        score: 0,

        reasons: [
          'Purchase price does not match.',
        ],
      };
    }

    score += 3;

    reasons.push(
      'Purchase price matches.'
    );
  }

  const timeWindow =
    getPendingBuyTimeWindow(
      pendingBuy,
      {
        windowSeconds,
      }
    );

  if (
    timeWindow.valid &&
    candidate.purchaseTime
  ) {
    if (
      candidate.purchaseTime <
        timeWindow.from ||
      candidate.purchaseTime >
        timeWindow.to
    ) {
      return {
        matched: false,

        score: 0,

        reasons: [
          'Purchase time is outside the reconciliation window.',
        ],
      };
    }

    score += 4;

    reasons.push(
      'Purchase time matches.'
    );
  }

  if (candidate.contractId) {
    score += 2;

    reasons.push(
      'Contract ID available.'
    );
  }

  if (candidate.transactionId) {
    score += 1;

    reasons.push(
      'Transaction ID available.'
    );
  }

  // ----------------------------------------------------------
  // A candidate requires multiple independent matching facts.
  //
  // We intentionally do not accept weak one-field matches.
  // ----------------------------------------------------------

  return {
    matched: score >= 6,

    score,

    reasons,
  };
}

// ============================================================
// FILTER OPEN CANDIDATES
// ============================================================

export function findOpenBuyCandidates(
  pendingBuy,
  contracts,
  options = {}
) {
  const normalized =
    normalizePortfolioContracts(
      contracts
    );

  return normalized
    .map((candidate) => {
      const match =
        candidateMatchesPendingBuy(
          pendingBuy,
          candidate,
          options
        );

      return {
        ...candidate,

        matchScore:
          match.score,

        matchReasons:
          match.reasons,

        matched:
          match.matched,
      };
    })
    .filter(
      (candidate) =>
        candidate.matched
    )
    .sort(
      (a, b) =>
        b.matchScore -
        a.matchScore
    );
}

// ============================================================
// FILTER SETTLED CANDIDATES
// ============================================================

export function findSettledBuyCandidates(
  pendingBuy,
  transactions,
  options = {}
) {
  const normalized =
    normalizeProfitTableTransactions(
      transactions
    );

  return normalized
    .map((candidate) => {
      const match =
        candidateMatchesPendingBuy(
          pendingBuy,
          candidate,
          options
        );

      return {
        ...candidate,

        matchScore:
          match.score,

        matchReasons:
          match.reasons,

        matched:
          match.matched,
      };
    })
    .filter(
      (candidate) =>
        candidate.matched
    )
    .sort(
      (a, b) =>
        b.matchScore -
        a.matchScore
    );
}

// ============================================================
// STORE PORTFOLIO RESULT
// ============================================================

export function applyPortfolioReconciliationResult(
  current,
  pendingBuy,
  contracts
) {
  const state =
    current ||
    createPendingBuyReconciliation();

  const candidates =
    findOpenBuyCandidates(
      pendingBuy,
      contracts
    );

  return {
    ...state,

    portfolioReceived: true,

    openCandidates:
      candidates,

    source:
      state.profitTableReceived
        ? BUY_RECONCILIATION_SOURCE.BOTH
        : BUY_RECONCILIATION_SOURCE.PORTFOLIO,
  };
}

// ============================================================
// STORE PROFIT TABLE RESULT
// ============================================================

export function applyProfitTableReconciliationResult(
  current,
  pendingBuy,
  transactions
) {
  const state =
    current ||
    createPendingBuyReconciliation();

  const candidates =
    findSettledBuyCandidates(
      pendingBuy,
      transactions
    );

  return {
    ...state,

    profitTableReceived: true,

    settledCandidates:
      candidates,

    source:
      state.portfolioReceived
        ? BUY_RECONCILIATION_SOURCE.BOTH
        : BUY_RECONCILIATION_SOURCE.PROFIT_TABLE,
  };
}

// ============================================================
// FINAL DECISION
// ============================================================

export function evaluatePendingBuyReconciliation(
  current,
  now = Date.now()
) {
  const state =
    current ||
    createPendingBuyReconciliation();

  if (
    !state.portfolioReceived ||
    !state.profitTableReceived
  ) {
    return {
      ...state,

      state:
        BUY_RECONCILIATION_STATE.SEARCHING,

      reason:
        'Waiting for both portfolio and profit table reconciliation responses.',
    };
  }

  const open =
    Array.isArray(
      state.openCandidates
    )
      ? state.openCandidates
      : [];

  const settled =
    Array.isArray(
      state.settledCandidates
    )
      ? state.settledCandidates
      : [];

  // ----------------------------------------------------------
  // Exactly one strong OPEN candidate.
  //
  // This is the safest automatic recovery case because
  // portfolio contains an actual current contract_id.
  // ----------------------------------------------------------

  if (
    open.length === 1 &&
    settled.length === 0
  ) {
    return {
      ...state,

      state:
        BUY_RECONCILIATION_STATE.OPEN_CONTRACT_FOUND,

      completedAt:
        Number(now) ||
        Date.now(),

      selectedCandidate:
        open[0],

      reason:
        `One matching open contract was found: #${open[0].contractId}.`,
    };
  }

  // ----------------------------------------------------------
  // Exactly one historical match.
  //
  // The missing BUY may have already settled before reconnect.
  // ----------------------------------------------------------

  if (
    open.length === 0 &&
    settled.length === 1
  ) {
    return {
      ...state,

      state:
        BUY_RECONCILIATION_STATE.SETTLED_CONTRACT_FOUND,

      completedAt:
        Number(now) ||
        Date.now(),

      selectedCandidate:
        settled[0],

      reason:
        settled[0].contractId
          ? `One matching settled contract was found: #${settled[0].contractId}.`
          : `One matching settled transaction was found: ${settled[0].transactionId || 'unknown transaction'}.`,
    };
  }

  // ----------------------------------------------------------
  // Nothing matched.
  //
  // IMPORTANT:
  //
  // We still do NOT automatically claim that the BUY failed.
  // Historical API timing/data availability can vary.
  // ----------------------------------------------------------

  if (
    open.length === 0 &&
    settled.length === 0
  ) {
    return {
      ...state,

      state:
        BUY_RECONCILIATION_STATE.NO_MATCH,

      completedAt:
        Number(now) ||
        Date.now(),

      selectedCandidate: null,

      reason:
        'No sufficiently strong matching contract was found. Automatic trading must remain paused.',
    };
  }

  // ----------------------------------------------------------
  // Multiple plausible positions = unsafe to guess.
  // ----------------------------------------------------------

  return {
    ...state,

    state:
      BUY_RECONCILIATION_STATE.AMBIGUOUS,

    completedAt:
      Number(now) ||
      Date.now(),

    selectedCandidate: null,

    reason:
      `Multiple plausible matches were found (${open.length} open, ${settled.length} settled). BinarySpot will not guess which one belongs to the missing BUY.`,
  };
}

// ============================================================
// ERROR
// ============================================================

export function failPendingBuyReconciliation(
  current,
  error,
  now = Date.now()
) {
  return {
    ...(current ||
      createPendingBuyReconciliation()),

    state:
      BUY_RECONCILIATION_STATE.ERROR,

    completedAt:
      Number(now) ||
      Date.now(),

    error:
      safeString(error) ||
      'Unknown reconciliation error.',

    reason:
      'BUY reconciliation could not be completed safely.',
  };
}

// ============================================================
// STATUS
// ============================================================

export function getPendingBuyReconciliationStatus(
  current
) {
  const state =
    current ||
    createPendingBuyReconciliation();

  let label =
    'Reconciliation idle';

  if (
    state.state ===
    BUY_RECONCILIATION_STATE.SEARCHING
  ) {
    label =
      'Checking Deriv account history';
  }

  if (
    state.state ===
    BUY_RECONCILIATION_STATE.OPEN_CONTRACT_FOUND
  ) {
    label =
      `Recovered open contract #${state.selectedCandidate?.contractId || '?'}`;
  }

  if (
    state.state ===
    BUY_RECONCILIATION_STATE.SETTLED_CONTRACT_FOUND
  ) {
    label =
      state.selectedCandidate?.contractId
        ? `Recovered settled contract #${state.selectedCandidate.contractId}`
        : 'Recovered settled BUY transaction';
  }

  if (
    state.state ===
    BUY_RECONCILIATION_STATE.NO_MATCH
  ) {
    label =
      'No safe BUY match found';
  }

  if (
    state.state ===
    BUY_RECONCILIATION_STATE.AMBIGUOUS
  ) {
    label =
      'Multiple BUY matches — manual review required';
  }

  if (
    state.state ===
    BUY_RECONCILIATION_STATE.ERROR
  ) {
    label =
      'BUY reconciliation error';
  }

  return {
    state:
      state.state,

    label,

    source:
      state.source,

    searching:
      state.state ===
      BUY_RECONCILIATION_STATE.SEARCHING,

    resolvedOpen:
      state.state ===
      BUY_RECONCILIATION_STATE.OPEN_CONTRACT_FOUND,

    resolvedSettled:
      state.state ===
      BUY_RECONCILIATION_STATE.SETTLED_CONTRACT_FOUND,

    noMatch:
      state.state ===
      BUY_RECONCILIATION_STATE.NO_MATCH,

    ambiguous:
      state.state ===
      BUY_RECONCILIATION_STATE.AMBIGUOUS,

    failed:
      state.state ===
      BUY_RECONCILIATION_STATE.ERROR,

    portfolioReceived:
      state.portfolioReceived,

    profitTableReceived:
      state.profitTableReceived,

    openCandidateCount:
      state.openCandidates?.length ||
      0,

    settledCandidateCount:
      state.settledCandidates?.length ||
      0,

    selectedCandidate:
      state.selectedCandidate,

    reason:
      state.reason,

    error:
      state.error,
  };
}

// ============================================================
// RESET
// ============================================================

export function clearPendingBuyReconciliation() {
  return createPendingBuyReconciliation();
}
