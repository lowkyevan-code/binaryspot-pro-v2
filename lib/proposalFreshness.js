// ============================================================
// BinarySpot Pro
// Proposal Freshness Guard
// ============================================================
//
// Purpose:
//
// 1. Timestamp manual proposals.
// 2. Prevent buying an old proposal after it has sat too long.
// 3. Give a clear freshness status for the UI.
// 4. Keep manual demo execution safer without affecting auto mode.
//
// ============================================================

export const DEFAULT_PROPOSAL_MAX_AGE_MS = 15000;

// ============================================================
// SAFE HELPERS
// ============================================================

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

function safeMaxAge(value) {
  const number = Number(value);

  if (
    !Number.isFinite(number) ||
    number <= 0
  ) {
    return DEFAULT_PROPOSAL_MAX_AGE_MS;
  }

  return number;
}

// ============================================================
// CREATE EMPTY STATE
// ============================================================

export function createProposalFreshness() {
  return {
    proposalId: null,
    createdAt: null,
    maxAgeMs: DEFAULT_PROPOSAL_MAX_AGE_MS,
  };
}

// ============================================================
// REGISTER PROPOSAL
// ============================================================

export function registerProposalFreshness(
  current,
  {
    proposalId,
    createdAt = Date.now(),
    maxAgeMs = DEFAULT_PROPOSAL_MAX_AGE_MS,
  }
) {
  if (
    !proposalId
  ) {
    return {
      valid: false,

      reason:
        'Proposal ID is required.',

      freshness:
        current ||
        createProposalFreshness(),
    };
  }

  const timestamp =
    safeTimestamp(
      createdAt
    );

  if (!timestamp) {
    return {
      valid: false,

      reason:
        'Invalid proposal timestamp.',

      freshness:
        current ||
        createProposalFreshness(),
    };
  }

  return {
    valid: true,

    reason: '',

    freshness: {
      proposalId,
      createdAt:
        timestamp,
      maxAgeMs:
        safeMaxAge(
          maxAgeMs
        ),
    },
  };
}

// ============================================================
// AGE
// ============================================================

export function getProposalAgeMs(
  freshness,
  now = Date.now()
) {
  if (
    !freshness ||
    !freshness.createdAt
  ) {
    return null;
  }

  const createdAt =
    safeTimestamp(
      freshness.createdAt
    );

  const currentTime =
    safeTimestamp(
      now
    );

  if (
    !createdAt ||
    !currentTime
  ) {
    return null;
  }

  return Math.max(
    0,
    currentTime -
      createdAt
  );
}

// ============================================================
// FRESH?
// ============================================================

export function isProposalFresh(
  freshness,
  now = Date.now()
) {
  if (
    !freshness ||
    !freshness.proposalId
  ) {
    return false;
  }

  const ageMs =
    getProposalAgeMs(
      freshness,
      now
    );

  if (
    ageMs === null
  ) {
    return false;
  }

  const maxAgeMs =
    safeMaxAge(
      freshness.maxAgeMs
    );

  return (
    ageMs <=
    maxAgeMs
  );
}

// ============================================================
// BUY PERMISSION
// ============================================================

export function canBuyFreshProposal(
  freshness,
  {
    proposalId,
    now = Date.now(),
  } = {}
) {
  if (
    !freshness ||
    !freshness.proposalId
  ) {
    return {
      allowed: false,

      reason:
        'No manual proposal is available.',
    };
  }

  if (
    proposalId &&
    freshness.proposalId !==
      proposalId
  ) {
    return {
      allowed: false,

      reason:
        'The proposal has changed. Request a new proposal.',
    };
  }

  const ageMs =
    getProposalAgeMs(
      freshness,
      now
    );

  if (
    ageMs === null
  ) {
    return {
      allowed: false,

      reason:
        'Proposal freshness could not be verified.',
    };
  }

  const maxAgeMs =
    safeMaxAge(
      freshness.maxAgeMs
    );

  if (
    ageMs >
    maxAgeMs
  ) {
    return {
      allowed: false,

      reason:
        'This proposal is too old. Request a fresh proposal before buying.',

      ageMs,

      maxAgeMs,
    };
  }

  return {
    allowed: true,

    reason: '',

    ageMs,

    maxAgeMs,

    remainingMs:
      Math.max(
        0,
        maxAgeMs -
          ageMs
      ),
  };
}

// ============================================================
// CLEAR
// ============================================================

export function clearProposalFreshness() {
  return createProposalFreshness();
}

// ============================================================
// STATUS
// ============================================================

export function getProposalFreshnessStatus(
  freshness,
  now = Date.now()
) {
  if (
    !freshness ||
    !freshness.proposalId
  ) {
    return {
      hasProposal: false,

      fresh: false,

      expired: false,

      proposalId: null,

      ageMs: null,

      remainingMs: null,

      label:
        'No proposal',
    };
  }

  const ageMs =
    getProposalAgeMs(
      freshness,
      now
    );

  const maxAgeMs =
    safeMaxAge(
      freshness.maxAgeMs
    );

  const fresh =
    ageMs !== null &&
    ageMs <=
      maxAgeMs;

  const remainingMs =
    ageMs === null
      ? null
      : Math.max(
          0,
          maxAgeMs -
            ageMs
        );

  return {
    hasProposal: true,

    fresh,

    expired:
      !fresh,

    proposalId:
      freshness.proposalId,

    ageMs,

    remainingMs,

    label:
      fresh
        ? `Fresh — ${Math.ceil(
            remainingMs /
              1000
          )}s remaining`
        : 'Expired — request a new proposal',
  };
}
