// ============================================================
// BinarySpot Pro
// Pending BUY Recovery Storage
// ============================================================
//
// Purpose:
//
// Persist a dangerous BUY ambiguity across page refresh:
//
//   BUY sent
//      ↓
//   connection lost
//      ↓
//   contract ID unknown
//      ↓
//   page refreshed
//
// Without persistence, the application could forget that an
// unresolved BUY existed and accidentally allow another entry.
//
// This module stores only minimal recovery metadata.
//
// IMPORTANT:
//
// - Demo accounts only.
// - No OAuth token is stored.
// - No WebSocket URL is stored.
// - No automatic real-money execution.
// - sessionStorage is used intentionally.
// ============================================================

export const PENDING_BUY_STORAGE_KEY =
  'binaryspot_pending_buy_recovery_v1';

export const PENDING_BUY_STORAGE_VERSION = 1;

export const DEFAULT_PENDING_BUY_MAX_AGE_MS =
  10 * 60 * 1000;

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
  const number = Number(value);

  if (
    !Number.isInteger(number) ||
    number < 0
  ) {
    return null;
  }

  return number;
}

function safeTimestamp(value) {
  const number = Number(value);

  if (
    !Number.isFinite(number) ||
    number <= 0
  ) {
    return null;
  }

  return number;
}

function safePositiveNumber(value) {
  const number = Number(value);

  if (
    !Number.isFinite(number) ||
    number <= 0
  ) {
    return null;
  }

  return number;
}

function normalizeAccountType(value) {
  const type =
    safeString(value).toLowerCase();

  if (type === 'demo') {
    return 'demo';
  }

  if (type === 'real') {
    return 'real';
  }

  return 'unknown';
}

function normalizeOwner(value) {
  const owner =
    safeString(value).toLowerCase();

  if (owner === 'auto') {
    return 'auto';
  }

  if (owner === 'manual') {
    return 'manual';
  }

  return 'unknown';
}

function storageAvailable() {
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

// ============================================================
// CREATE STORED RECORD
// ============================================================

export function createStoredPendingBuy({
  reqId,
  proposalId,
  accountId,
  accountType,
  owner,
  symbol,
  strategy,
  expectedStake,
  startedAt,
  disconnectedAt,
} = {}) {
  const normalizedReqId =
    safeReqId(reqId);

  const normalizedProposalId =
    safeString(proposalId);

  const normalizedAccountId =
    safeString(accountId);

  const normalizedAccountType =
    normalizeAccountType(accountType);

  const normalizedOwner =
    normalizeOwner(owner);

  const normalizedSymbol =
    safeString(symbol);

  const normalizedStrategy =
    safeString(strategy).toUpperCase();

  const normalizedStake =
    safePositiveNumber(expectedStake);

  const normalizedStartedAt =
    safeTimestamp(startedAt);

  const normalizedDisconnectedAt =
    safeTimestamp(disconnectedAt);

  if (normalizedReqId === null) {
    return {
      valid: false,
      reason:
        'Pending BUY request ID is invalid.',
      record: null,
    };
  }

  if (!normalizedProposalId) {
    return {
      valid: false,
      reason:
        'Pending BUY proposal ID is missing.',
      record: null,
    };
  }

  if (!normalizedAccountId) {
    return {
      valid: false,
      reason:
        'Pending BUY account ID is missing.',
      record: null,
    };
  }

  if (
    normalizedAccountType !== 'demo'
  ) {
    return {
      valid: false,
      reason:
        'Pending BUY persistence is restricted to demo accounts.',
      record: null,
    };
  }

  if (!normalizedStartedAt) {
    return {
      valid: false,
      reason:
        'Pending BUY start time is invalid.',
      record: null,
    };
  }

  return {
    valid: true,
    reason: '',
    record: {
      version:
        PENDING_BUY_STORAGE_VERSION,

      reqId:
        normalizedReqId,

      proposalId:
        normalizedProposalId,

      accountId:
        normalizedAccountId,

      accountType:
        normalizedAccountType,

      owner:
        normalizedOwner,

      symbol:
        normalizedSymbol,

      strategy:
        normalizedStrategy,

      expectedStake:
        normalizedStake,

      startedAt:
        normalizedStartedAt,

      disconnectedAt:
        normalizedDisconnectedAt ||
        Date.now(),

      storedAt:
        Date.now(),
    },
  };
}

// ============================================================
// VALIDATE STORED RECORD
// ============================================================

export function validateStoredPendingBuy(
  record,
  {
    maxAgeMs =
      DEFAULT_PENDING_BUY_MAX_AGE_MS,
    now = Date.now(),
  } = {}
) {
  if (
    !record ||
    typeof record !== 'object'
  ) {
    return {
      valid: false,
      reason:
        'Stored pending BUY record is missing.',
      record: null,
    };
  }

  if (
    Number(record.version) !==
    PENDING_BUY_STORAGE_VERSION
  ) {
    return {
      valid: false,
      reason:
        'Stored pending BUY version is unsupported.',
      record: null,
    };
  }

  const rebuilt =
    createStoredPendingBuy({
      reqId:
        record.reqId,

      proposalId:
        record.proposalId,

      accountId:
        record.accountId,

      accountType:
        record.accountType,

      owner:
        record.owner,

      symbol:
        record.symbol,

      strategy:
        record.strategy,

      expectedStake:
        record.expectedStake,

      startedAt:
        record.startedAt,

      disconnectedAt:
        record.disconnectedAt,
    });

  if (!rebuilt.valid) {
    return rebuilt;
  }

  const storedAt =
    safeTimestamp(record.storedAt);

  if (!storedAt) {
    return {
      valid: false,
      reason:
        'Stored pending BUY timestamp is invalid.',
      record: null,
    };
  }

  const currentTime =
    Number(now);

  const age =
    Number.isFinite(currentTime)
      ? currentTime - storedAt
      : Date.now() - storedAt;

  const allowedAge =
    Number(maxAgeMs);

  if (
    Number.isFinite(allowedAge) &&
    allowedAge > 0 &&
    age > allowedAge
  ) {
    return {
      valid: false,
      reason:
        'Stored pending BUY record expired.',
      record: null,
    };
  }

  return {
    valid: true,
    reason: '',
    record: {
      ...rebuilt.record,
      storedAt,
    },
  };
}

// ============================================================
// SAVE
// ============================================================

export function savePendingBuyRecoveryRecord(
  record
) {
  if (!storageAvailable()) {
    return {
      saved: false,
      reason:
        'sessionStorage is unavailable.',
    };
  }

  const validation =
    validateStoredPendingBuy(record, {
      maxAgeMs:
        Number.MAX_SAFE_INTEGER,
    });

  if (!validation.valid) {
    return {
      saved: false,
      reason:
        validation.reason,
    };
  }

  try {
    window.sessionStorage.setItem(
      PENDING_BUY_STORAGE_KEY,
      JSON.stringify(
        validation.record
      )
    );

    return {
      saved: true,
      reason: '',
      record:
        validation.record,
    };
  } catch {
    return {
      saved: false,
      reason:
        'Unable to store pending BUY recovery information.',
    };
  }
}

// ============================================================
// CONVENIENCE PERSIST
// ============================================================

export function persistPendingBuyRecovery(
  pendingBuy
) {
  const created =
    createStoredPendingBuy({
      reqId:
        pendingBuy?.reqId,

      proposalId:
        pendingBuy?.proposalId,

      accountId:
        pendingBuy?.accountId,

      accountType:
        pendingBuy?.accountType,

      owner:
        pendingBuy?.owner,

      symbol:
        pendingBuy?.symbol,

      strategy:
        pendingBuy?.strategy,

      expectedStake:
        pendingBuy?.expectedStake,

      startedAt:
        pendingBuy?.startedAt,

      disconnectedAt:
        pendingBuy?.disconnectedAt ||
        Date.now(),
    });

  if (!created.valid) {
    return {
      saved: false,
      reason:
        created.reason,
    };
  }

  return savePendingBuyRecoveryRecord(
    created.record
  );
}

// ============================================================
// LOAD
// ============================================================

export function loadPendingBuyRecoveryRecord(
  options = {}
) {
  if (!storageAvailable()) {
    return {
      found: false,
      valid: false,
      reason:
        'sessionStorage is unavailable.',
      record: null,
    };
  }

  let raw;

  try {
    raw =
      window.sessionStorage.getItem(
        PENDING_BUY_STORAGE_KEY
      );
  } catch {
    return {
      found: false,
      valid: false,
      reason:
        'Unable to access pending BUY storage.',
      record: null,
    };
  }

  if (!raw) {
    return {
      found: false,
      valid: false,
      reason: '',
      record: null,
    };
  }

  try {
    const parsed =
      JSON.parse(raw);

    const validation =
      validateStoredPendingBuy(
        parsed,
        options
      );

    if (!validation.valid) {
      return {
        found: true,
        valid: false,
        reason:
          validation.reason,
        record: null,
      };
    }

    return {
      found: true,
      valid: true,
      reason: '',
      record:
        validation.record,
    };
  } catch {
    return {
      found: true,
      valid: false,
      reason:
        'Stored pending BUY record is corrupted.',
      record: null,
    };
  }
}

// ============================================================
// CLEAR
// ============================================================

export function clearPendingBuyRecoveryRecord() {
  if (!storageAvailable()) {
    return {
      cleared: false,
      reason:
        'sessionStorage is unavailable.',
    };
  }

  try {
    window.sessionStorage.removeItem(
      PENDING_BUY_STORAGE_KEY
    );

    return {
      cleared: true,
      reason: '',
    };
  } catch {
    return {
      cleared: false,
      reason:
        'Unable to clear pending BUY storage.',
    };
  }
}

// ============================================================
// RESTORE PERMISSION
// ============================================================

export function canRestoreStoredPendingBuy(
  record,
  {
    accountId,
    accountType,
    now = Date.now(),
  } = {}
) {
  const validation =
    validateStoredPendingBuy(
      record,
      {
        now,
      }
    );

  if (!validation.valid) {
    return {
      allowed: false,
      reason:
        validation.reason,
      record: null,
    };
  }

  const stored =
    validation.record;

  if (
    normalizeAccountType(
      accountType
    ) !== 'demo'
  ) {
    return {
      allowed: false,
      reason:
        'Pending BUY restore requires a demo account.',
      record: null,
    };
  }

  if (
    stored.accountType !==
    'demo'
  ) {
    return {
      allowed: false,
      reason:
        'Stored pending BUY does not belong to a demo account.',
      record: null,
    };
  }

  if (
    safeString(accountId) !==
    stored.accountId
  ) {
    return {
      allowed: false,
      reason:
        'Stored pending BUY belongs to a different Deriv account.',
      record: null,
    };
  }

  return {
    allowed: true,
    reason: '',
    record: stored,
  };
}

// ============================================================
// STATUS
// ============================================================

export function getStoredPendingBuyStatus(
  record
) {
  const validation =
    validateStoredPendingBuy(
      record
    );

  if (!validation.valid) {
    return {
      valid: false,
      label:
        'No stored BUY ambiguity',
      accountId: '',
      reqId: null,
      ageSeconds: null,
    };
  }

  const stored =
    validation.record;

  const ageSeconds =
    Math.max(
      0,
      Math.floor(
        (Date.now() -
          stored.storedAt) /
          1000
      )
    );

  return {
    valid: true,

    label:
      `Stored BUY #${stored.reqId} — ${ageSeconds}s old`,

    accountId:
      stored.accountId,

    reqId:
      stored.reqId,

    owner:
      stored.owner,

    symbol:
      stored.symbol,

    strategy:
      stored.strategy,

    expectedStake:
      stored.expectedStake,

    startedAt:
      stored.startedAt,

    disconnectedAt:
      stored.disconnectedAt,

    ageSeconds,
  };
}
