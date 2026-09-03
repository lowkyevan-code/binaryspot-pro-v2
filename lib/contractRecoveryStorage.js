// ============================================================
// BinarySpot Pro
// Contract Recovery Persistence
// ============================================================
//
// Purpose:
//
// Keep the minimum known-contract recovery information in
// sessionStorage so an accidental page refresh does not
// immediately erase the identity of an active demo contract.
//
// This module:
// - does NOT place trades
// - does NOT reconnect sockets
// - does NOT enable real-money trading
// - does NOT store OAuth access tokens
//
// File 45 will integrate this into app/page.jsx.
// ============================================================

export const CONTRACT_RECOVERY_STORAGE_KEY =
  'binaryspot_contract_recovery_v1';

export const CONTRACT_RECOVERY_STORAGE_VERSION = 1;

const MAX_RECORD_AGE_MS =
  24 * 60 * 60 * 1000;

// ============================================================
// SAFE HELPERS
// ============================================================

function safeString(value) {
  if (
    typeof value !== 'string'
  ) {
    return '';
  }

  return value.trim();
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

  if (
    type === 'demo'
  ) {
    return 'demo';
  }

  if (
    type === 'real'
  ) {
    return 'real';
  }

  return 'unknown';
}

function getBrowserSessionStorage() {
  if (
    typeof window === 'undefined'
  ) {
    return null;
  }

  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

// ============================================================
// CREATE RECORD
// ============================================================

export function createStoredContractRecovery({
  contractId,
  accountId,
  accountType = 'unknown',
  owner = 'unknown',
  symbol = '',
  createdAt = Date.now(),
} = {}) {
  const normalizedContractId =
    safeContractId(
      contractId
    );

  const normalizedAccountId =
    safeString(
      accountId
    );

  const normalizedCreatedAt =
    safeTimestamp(
      createdAt
    );

  if (
    !normalizedContractId
  ) {
    return {
      valid: false,

      reason:
        'A valid contract ID is required.',

      record: null,
    };
  }

  if (
    !normalizedAccountId
  ) {
    return {
      valid: false,

      reason:
        'A Deriv account ID is required.',

      record: null,
    };
  }

  if (
    !normalizedCreatedAt
  ) {
    return {
      valid: false,

      reason:
        'A valid creation timestamp is required.',

      record: null,
    };
  }

  return {
    valid: true,

    reason: '',

    record: {
      version:
        CONTRACT_RECOVERY_STORAGE_VERSION,

      contractId:
        normalizedContractId,

      accountId:
        normalizedAccountId,

      accountType:
        normalizeAccountType(
          accountType
        ),

      owner:
        normalizeOwner(
          owner
        ),

      symbol:
        safeString(
          symbol
        ),

      createdAt:
        normalizedCreatedAt,

      savedAt:
        Date.now(),
    },
  };
}

// ============================================================
// VALIDATE RECORD
// ============================================================

export function validateStoredContractRecovery(
  value,
  now = Date.now()
) {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value)
  ) {
    return {
      valid: false,

      reason:
        'Stored recovery data is invalid.',

      record: null,
    };
  }

  if (
    Number(value.version) !==
    CONTRACT_RECOVERY_STORAGE_VERSION
  ) {
    return {
      valid: false,

      reason:
        'Stored recovery data uses an unsupported version.',

      record: null,
    };
  }

  const contractId =
    safeContractId(
      value.contractId
    );

  const accountId =
    safeString(
      value.accountId
    );

  const createdAt =
    safeTimestamp(
      value.createdAt
    );

  const savedAt =
    safeTimestamp(
      value.savedAt
    );

  const currentTime =
    safeTimestamp(now) ||
    Date.now();

  if (!contractId) {
    return {
      valid: false,

      reason:
        'Stored recovery contract ID is invalid.',

      record: null,
    };
  }

  if (!accountId) {
    return {
      valid: false,

      reason:
        'Stored recovery account ID is invalid.',

      record: null,
    };
  }

  if (
    !createdAt ||
    !savedAt
  ) {
    return {
      valid: false,

      reason:
        'Stored recovery timestamps are invalid.',

      record: null,
    };
  }

  if (
    savedAt >
    currentTime + 60000
  ) {
    return {
      valid: false,

      reason:
        'Stored recovery timestamp is in the future.',

      record: null,
    };
  }

  const ageMs =
    Math.max(
      0,
      currentTime - savedAt
    );

  if (
    ageMs >
    MAX_RECORD_AGE_MS
  ) {
    return {
      valid: false,

      reason:
        'Stored contract recovery record has expired.',

      record: null,
    };
  }

  return {
    valid: true,

    reason: '',

    record: {
      version:
        CONTRACT_RECOVERY_STORAGE_VERSION,

      contractId,

      accountId,

      accountType:
        normalizeAccountType(
          value.accountType
        ),

      owner:
        normalizeOwner(
          value.owner
        ),

      symbol:
        safeString(
          value.symbol
        ),

      createdAt,

      savedAt,
    },
  };
}

// ============================================================
// SAVE
// ============================================================

export function saveContractRecoveryRecord(
  record
) {
  const storage =
    getBrowserSessionStorage();

  if (!storage) {
    return {
      saved: false,

      reason:
        'sessionStorage is unavailable.',
    };
  }

  const validation =
    validateStoredContractRecovery(
      record
    );

  if (
    !validation.valid
  ) {
    return {
      saved: false,

      reason:
        validation.reason,
    };
  }

  try {
    storage.setItem(
      CONTRACT_RECOVERY_STORAGE_KEY,
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
        'Unable to save contract recovery state.',
    };
  }
}

// ============================================================
// CREATE + SAVE
// ============================================================

export function persistLiveContractRecovery(
  details
) {
  const created =
    createStoredContractRecovery(
      details
    );

  if (
    !created.valid
  ) {
    return {
      saved: false,

      reason:
        created.reason,

      record: null,
    };
  }

  return saveContractRecoveryRecord(
    created.record
  );
}

// ============================================================
// LOAD
// ============================================================

export function loadContractRecoveryRecord(
  now = Date.now()
) {
  const storage =
    getBrowserSessionStorage();

  if (!storage) {
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
      storage.getItem(
        CONTRACT_RECOVERY_STORAGE_KEY
      );
  } catch {
    return {
      found: false,

      valid: false,

      reason:
        'Unable to read contract recovery state.',

      record: null,
    };
  }

  if (!raw) {
    return {
      found: false,

      valid: false,

      reason:
        'No stored contract recovery record.',

      record: null,
    };
  }

  let parsed;

  try {
    parsed =
      JSON.parse(raw);
  } catch {
    clearContractRecoveryRecord();

    return {
      found: true,

      valid: false,

      reason:
        'Stored contract recovery data could not be parsed.',

      record: null,
    };
  }

  const validation =
    validateStoredContractRecovery(
      parsed,
      now
    );

  if (
    !validation.valid
  ) {
    clearContractRecoveryRecord();

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
}

// ============================================================
// CLEAR
// ============================================================

export function clearContractRecoveryRecord() {
  const storage =
    getBrowserSessionStorage();

  if (!storage) {
    return {
      cleared: false,

      reason:
        'sessionStorage is unavailable.',
    };
  }

  try {
    storage.removeItem(
      CONTRACT_RECOVERY_STORAGE_KEY
    );

    return {
      cleared: true,

      reason: '',
    };
  } catch {
    return {
      cleared: false,

      reason:
        'Unable to clear contract recovery state.',
    };
  }
}

// ============================================================
// ACCOUNT SAFETY CHECK
// ============================================================

export function canRestoreStoredContract(
  record,
  {
    accountId,
    accountType,
  } = {}
) {
  const validation =
    validateStoredContractRecovery(
      record
    );

  if (
    !validation.valid
  ) {
    return {
      allowed: false,

      reason:
        validation.reason,

      record: null,
    };
  }

  const currentAccountId =
    safeString(
      accountId
    );

  const currentAccountType =
    normalizeAccountType(
      accountType
    );

  if (
    !currentAccountId
  ) {
    return {
      allowed: false,

      reason:
        'Current Deriv account is unavailable.',

      record:
        validation.record,
    };
  }

  if (
    validation.record.accountId !==
    currentAccountId
  ) {
    return {
      allowed: false,

      reason:
        'Stored contract belongs to a different Deriv account.',

      record:
        validation.record,
    };
  }

  // ==========================================================
  // DEMO-ONLY SAFETY
  // ==========================================================
  //
  // BinarySpot Pro currently executes demo contracts only.
  // Therefore automatic restore/recovery is permitted only when
  // both stored and current account types are demo.
  //
  // ==========================================================

  if (
    validation.record.accountType !==
      'demo' ||
    currentAccountType !==
      'demo'
  ) {
    return {
      allowed: false,

      reason:
        'Persistent contract recovery is restricted to demo accounts.',

      record:
        validation.record,
    };
  }

  return {
    allowed: true,

    reason: '',

    record:
      validation.record,
  };
}

// ============================================================
// STATUS
// ============================================================

export function getStoredRecoveryStatus(
  record,
  now = Date.now()
) {
  const validation =
    validateStoredContractRecovery(
      record,
      now
    );

  if (
    !validation.valid
  ) {
    return {
      valid: false,

      label:
        'No persisted contract',

      contractId: null,

      accountId: '',

      owner: 'unknown',

      ageSeconds: null,
    };
  }

  const ageMs =
    Math.max(
      0,
      Number(now) -
        validation.record.savedAt
    );

  return {
    valid: true,

    label:
      `Contract #${validation.record.contractId} persisted`,

    contractId:
      validation.record.contractId,

    accountId:
      validation.record.accountId,

    accountType:
      validation.record.accountType,

    owner:
      validation.record.owner,

    symbol:
      validation.record.symbol,

    ageSeconds:
      Math.floor(
        ageMs / 1000
      ),
  };
}
