// ============================================================
// BinarySpot Pro
// Active Contract Recovery Helper
// ============================================================
//
// Purpose:
//
// 1. Remember an active contract independently of WebSocket state.
// 2. Mark a live contract as needing recovery after disconnect.
// 3. Prevent recovery from attaching to the wrong account.
// 4. Resume proposal_open_contract monitoring after reconnect.
// 5. Avoid duplicate recovery subscriptions.
//
// Demo-only trading protection remains handled by app/page.jsx.
//
// ============================================================

// ============================================================
// RECOVERY STATES
// ============================================================

export const RECOVERY_STATE = Object.freeze({
  IDLE: 'idle',
  TRACKING: 'tracking',
  RECOVERY_REQUIRED: 'recovery_required',
  RECOVERING: 'recovering',
  SETTLED: 'settled',
});

// ============================================================
// SAFE HELPERS
// ============================================================

function normalizeContractId(value) {
  const numeric =
    Number(value);

  if (
    !Number.isInteger(numeric) ||
    numeric <= 0
  ) {
    return null;
  }

  return numeric;
}

function normalizeAccountId(value) {
  if (
    typeof value !== 'string'
  ) {
    return '';
  }

  return value.trim();
}

function normalizeOwner(owner) {
  if (owner === 'auto') {
    return 'auto';
  }

  if (owner === 'manual') {
    return 'manual';
  }

  return null;
}

// ============================================================
// CREATE EMPTY RECOVERY STATE
// ============================================================

export function createContractRecovery() {
  return {
    state:
      RECOVERY_STATE.IDLE,

    contractId: null,

    accountId: '',

    owner: null,

    subscriptionId: null,

    recoveryAttempts: 0,

    disconnectedAt: null,

    recoveryStartedAt: null,

    lastRecoveredAt: null,

    settledAt: null,
  };
}

// ============================================================
// REGISTER LIVE CONTRACT
// ============================================================

export function registerLiveContract(
  recovery,
  {
    contractId,
    accountId,
    owner,
  }
) {
  const id =
    normalizeContractId(
      contractId
    );

  const account =
    normalizeAccountId(
      accountId
    );

  if (!id) {
    return {
      valid: false,

      reason:
        'Invalid contract ID.',

      recovery:
        recovery ||
        createContractRecovery(),
    };
  }

  if (!account) {
    return {
      valid: false,

      reason:
        'Account ID is required for contract recovery.',

      recovery:
        recovery ||
        createContractRecovery(),
    };
  }

  return {
    valid: true,

    reason: '',

    recovery: {
      state:
        RECOVERY_STATE.TRACKING,

      contractId: id,

      accountId:
        account,

      owner:
        normalizeOwner(
          owner
        ),

      subscriptionId: null,

      recoveryAttempts: 0,

      disconnectedAt: null,

      recoveryStartedAt: null,

      lastRecoveredAt: null,

      settledAt: null,
    },
  };
}

// ============================================================
// ATTACH SUBSCRIPTION
// ============================================================

export function attachRecoverySubscription(
  recovery,
  subscriptionId
) {
  const current =
    recovery ||
    createContractRecovery();

  if (
    !current.contractId
  ) {
    return current;
  }

  return {
    ...current,

    state:
      RECOVERY_STATE.TRACKING,

    subscriptionId:
      subscriptionId ||
      null,
  };
}

// ============================================================
// MARK SOCKET DISCONNECTED
// ============================================================

export function markContractDisconnected(
  recovery
) {
  const current =
    recovery ||
    createContractRecovery();

  if (
    !current.contractId ||
    current.state ===
      RECOVERY_STATE.SETTLED
  ) {
    return current;
  }

  return {
    ...current,

    state:
      RECOVERY_STATE.RECOVERY_REQUIRED,

    subscriptionId: null,

    disconnectedAt:
      Date.now(),
  };
}

// ============================================================
// CAN RECOVER?
// ============================================================

export function canRecoverContract(
  recovery,
  {
    accountId,
    tradingConnected,
  }
) {
  const current =
    recovery ||
    createContractRecovery();

  if (
    !current.contractId
  ) {
    return {
      allowed: false,

      reason:
        'No contract is available for recovery.',
    };
  }

  if (
    current.state ===
    RECOVERY_STATE.SETTLED
  ) {
    return {
      allowed: false,

      reason:
        'Contract has already settled.',
    };
  }

  if (
    current.state ===
    RECOVERY_STATE.RECOVERING
  ) {
    return {
      allowed: false,

      reason:
        'Contract recovery is already in progress.',
    };
  }

  const currentAccount =
    normalizeAccountId(
      accountId
    );

  if (
    !currentAccount ||
    currentAccount !==
      current.accountId
  ) {
    return {
      allowed: false,

      reason:
        'Contract belongs to a different account.',
    };
  }

  if (!tradingConnected) {
    return {
      allowed: false,

      reason:
        'Trading socket is not connected.',
    };
  }

  return {
    allowed: true,

    reason: '',
  };
}

// ============================================================
// BEGIN RECOVERY
// ============================================================

export function beginContractRecovery(
  recovery
) {
  const current =
    recovery ||
    createContractRecovery();

  if (
    !current.contractId
  ) {
    return current;
  }

  return {
    ...current,

    state:
      RECOVERY_STATE.RECOVERING,

    subscriptionId: null,

    recoveryAttempts:
      Number(
        current.recoveryAttempts ||
          0
      ) + 1,

    recoveryStartedAt:
      Date.now(),
  };
}

// ============================================================
// COMPLETE RECOVERY
// ============================================================

export function completeContractRecovery(
  recovery,
  subscriptionId = null
) {
  const current =
    recovery ||
    createContractRecovery();

  if (
    !current.contractId
  ) {
    return current;
  }

  return {
    ...current,

    state:
      RECOVERY_STATE.TRACKING,

    subscriptionId:
      subscriptionId ||
      current.subscriptionId ||
      null,

    lastRecoveredAt:
      Date.now(),
  };
}

// ============================================================
// RECOVERY FAILED
// ============================================================

export function failContractRecovery(
  recovery
) {
  const current =
    recovery ||
    createContractRecovery();

  if (
    !current.contractId
  ) {
    return current;
  }

  return {
    ...current,

    state:
      RECOVERY_STATE.RECOVERY_REQUIRED,

    subscriptionId: null,
  };
}

// ============================================================
// MARK SETTLED
// ============================================================

export function markRecoveredContractSettled(
  recovery,
  contractId
) {
  const current =
    recovery ||
    createContractRecovery();

  const id =
    normalizeContractId(
      contractId
    );

  if (
    !id ||
    current.contractId !==
      id
  ) {
    return current;
  }

  return {
    ...current,

    state:
      RECOVERY_STATE.SETTLED,

    subscriptionId: null,

    settledAt:
      Date.now(),
  };
}

// ============================================================
// CLEAR RECOVERY
// ============================================================

export function clearContractRecovery() {
  return createContractRecovery();
}

// ============================================================
// GET RECOVERY STATUS
// ============================================================

export function getContractRecoveryStatus(
  recovery
) {
  const current =
    recovery ||
    createContractRecovery();

  return {
    hasContract:
      Boolean(
        current.contractId
      ),

    state:
      current.state,

    contractId:
      current.contractId,

    accountId:
      current.accountId,

    owner:
      current.owner,

    subscriptionId:
      current.subscriptionId,

    recoveryAttempts:
      Number(
        current.recoveryAttempts ||
          0
      ),

    needsRecovery:
      current.state ===
      RECOVERY_STATE.RECOVERY_REQUIRED,

    recovering:
      current.state ===
      RECOVERY_STATE.RECOVERING,

    tracking:
      current.state ===
      RECOVERY_STATE.TRACKING,

    settled:
      current.state ===
      RECOVERY_STATE.SETTLED,
  };
}

// ============================================================
// BUILD RECOVERY REQUEST
// ============================================================

export function buildContractRecoveryRequest(
  recovery,
  reqId
) {
  const current =
    recovery ||
    createContractRecovery();

  const contractId =
    normalizeContractId(
      current.contractId
    );

  const requestId =
    Number(reqId);

  if (!contractId) {
    return {
      valid: false,

      reason:
        'No valid contract is available for recovery.',

      payload: null,
    };
  }

  if (
    !Number.isInteger(
      requestId
    ) ||
    requestId < 0
  ) {
    return {
      valid: false,

      reason:
        'Invalid recovery request ID.',

      payload: null,
    };
  }

  return {
    valid: true,

    reason: '',

    payload: {
      proposal_open_contract:
        1,

      contract_id:
        contractId,

      subscribe: 1,

      req_id:
        requestId,
    },
  };
}

// ============================================================
// HUMAN LABEL
// ============================================================

export function describeContractRecovery(
  recovery
) {
  const status =
    getContractRecoveryStatus(
      recovery
    );

  if (!status.hasContract) {
    return 'No recovery needed';
  }

  if (status.settled) {
    return `Contract #${status.contractId} settled`;
  }

  if (status.recovering) {
    return `Recovering #${status.contractId}`;
  }

  if (status.needsRecovery) {
    return `Recovery required #${status.contractId}`;
  }

  if (status.tracking) {
    return `Tracking #${status.contractId}`;
  }

  return `Contract #${status.contractId}`;
}
