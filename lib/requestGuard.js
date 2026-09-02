// ============================================================
// BinarySpot Pro
// WebSocket In-Flight Request Guard
// ============================================================
//
// Purpose:
//
// 1. Track exactly which proposal request belongs to AUTO/MANUAL.
// 2. Track exactly which BUY request belongs to AUTO/MANUAL.
// 3. Reject stale proposal responses after STOP / restart.
// 4. Preserve an already-sent BUY request because a BUY cannot
//    safely be assumed cancelled merely because the UI stopped.
// 5. Use Deriv req_id to match responses to requests.
//
// ============================================================

export const REQUEST_OWNER = Object.freeze({
  AUTO: 'auto',
  MANUAL: 'manual',
});

export const REQUEST_TYPE = Object.freeze({
  PROPOSAL: 'proposal',
  BUY: 'buy',
});

// ============================================================
// BASIC HELPERS
// ============================================================

function normalizeReqId(value) {
  const number = Number(value);

  if (
    !Number.isInteger(number) ||
    number < 0
  ) {
    return null;
  }

  return number;
}

function normalizeOwner(owner) {
  return owner === REQUEST_OWNER.AUTO
    ? REQUEST_OWNER.AUTO
    : REQUEST_OWNER.MANUAL;
}

function nextGeneration(current) {
  const number =
    Number(current) || 0;

  return number + 1;
}

// ============================================================
// CREATE GUARD
// ============================================================

export function createRequestGuard() {
  return {
    generation: 1,

    proposal: null,

    buy: null,
  };
}

// ============================================================
// BEGIN PROPOSAL
// ============================================================

export function beginProposalRequest(
  guard,
  {
    reqId,
    owner,
  }
) {
  const current =
    guard ||
    createRequestGuard();

  const normalizedReqId =
    normalizeReqId(reqId);

  if (
    normalizedReqId === null
  ) {
    return {
      guard: current,

      valid: false,

      reason:
        'Invalid proposal request ID.',
    };
  }

  if (
    current.proposal?.pending
  ) {
    return {
      guard: current,

      valid: false,

      reason:
        'A proposal request is already pending.',
    };
  }

  return {
    valid: true,

    reason: '',

    guard: {
      ...current,

      proposal: {
        reqId:
          normalizedReqId,

        owner:
          normalizeOwner(
            owner
          ),

        generation:
          current.generation,

        pending: true,

        startedAt:
          Date.now(),
      },
    },
  };
}

// ============================================================
// BEGIN BUY
// ============================================================

export function beginBuyRequest(
  guard,
  {
    reqId,
    owner,
    proposalId = null,
  }
) {
  const current =
    guard ||
    createRequestGuard();

  const normalizedReqId =
    normalizeReqId(reqId);

  if (
    normalizedReqId === null
  ) {
    return {
      guard: current,

      valid: false,

      reason:
        'Invalid buy request ID.',
    };
  }

  if (
    current.buy?.pending
  ) {
    return {
      guard: current,

      valid: false,

      reason:
        'A buy request is already pending.',
    };
  }

  return {
    valid: true,

    reason: '',

    guard: {
      ...current,

      buy: {
        reqId:
          normalizedReqId,

        owner:
          normalizeOwner(
            owner
          ),

        proposalId:
          proposalId ??
          null,

        generation:
          current.generation,

        pending: true,

        startedAt:
          Date.now(),
      },
    },
  };
}

// ============================================================
// RESPONSE REQUEST-ID EXTRACTION
// ============================================================

export function getResponseReqId(
  message
) {
  if (!message) {
    return null;
  }

  const direct =
    normalizeReqId(
      message.req_id
    );

  if (direct !== null) {
    return direct;
  }

  const echoed =
    normalizeReqId(
      message.echo_req
        ?.req_id
    );

  if (echoed !== null) {
    return echoed;
  }

  return null;
}

// ============================================================
// PROPOSAL RESPONSE MATCH
// ============================================================

export function matchProposalResponse(
  guard,
  message
) {
  const current =
    guard ||
    createRequestGuard();

  const request =
    current.proposal;

  if (
    !request ||
    !request.pending
  ) {
    return {
      matched: false,

      stale: true,

      owner: null,

      reqId:
        getResponseReqId(
          message
        ),

      reason:
        'No proposal request is currently pending.',
    };
  }

  const responseReqId =
    getResponseReqId(
      message
    );

  if (
    responseReqId === null
  ) {
    return {
      matched: false,

      stale: true,

      owner:
        request.owner,

      reqId: null,

      reason:
        'Proposal response does not contain a usable request ID.',
    };
  }

  if (
    responseReqId !==
    request.reqId
  ) {
    return {
      matched: false,

      stale: true,

      owner:
        request.owner,

      reqId:
        responseReqId,

      expectedReqId:
        request.reqId,

      reason:
        'Proposal response belongs to a different request.',
    };
  }

  if (
    request.generation !==
    current.generation
  ) {
    return {
      matched: false,

      stale: true,

      owner:
        request.owner,

      reqId:
        responseReqId,

      reason:
        'Proposal response belongs to an expired bot generation.',
    };
  }

  return {
    matched: true,

    stale: false,

    owner:
      request.owner,

    reqId:
      responseReqId,

    request,
  };
}

// ============================================================
// BUY RESPONSE MATCH
// ============================================================

export function matchBuyResponse(
  guard,
  message
) {
  const current =
    guard ||
    createRequestGuard();

  const request =
    current.buy;

  if (
    !request ||
    !request.pending
  ) {
    return {
      matched: false,

      stale: true,

      owner: null,

      reqId:
        getResponseReqId(
          message
        ),

      reason:
        'No buy request is currently pending.',
    };
  }

  const responseReqId =
    getResponseReqId(
      message
    );

  if (
    responseReqId === null
  ) {
    return {
      matched: false,

      stale: true,

      owner:
        request.owner,

      reqId: null,

      reason:
        'Buy response does not contain a usable request ID.',
    };
  }

  if (
    responseReqId !==
    request.reqId
  ) {
    return {
      matched: false,

      stale: true,

      owner:
        request.owner,

      reqId:
        responseReqId,

      expectedReqId:
        request.reqId,

      reason:
        'Buy response belongs to a different request.',
    };
  }

  /*
   * IMPORTANT:
   *
   * Unlike proposals, we deliberately DO NOT reject a BUY
   * merely because the bot generation later changed.
   *
   * Once a BUY request has been sent, we cannot assume the
   * purchase was cancelled just because STOP was pressed.
   *
   * We therefore keep accepting the exact matching BUY
   * response and preserve its original AUTO/MANUAL owner.
   */

  return {
    matched: true,

    stale: false,

    owner:
      request.owner,

    reqId:
      responseReqId,

    request,
  };
}

// ============================================================
// RESOLVE PROPOSAL
// ============================================================

export function resolveProposalRequest(
  guard,
  message
) {
  const current =
    guard ||
    createRequestGuard();

  const match =
    matchProposalResponse(
      current,
      message
    );

  if (!match.matched) {
    return {
      guard: current,
      match,
    };
  }

  return {
    match,

    guard: {
      ...current,

      proposal: null,
    },
  };
}

// ============================================================
// RESOLVE BUY
// ============================================================

export function resolveBuyRequest(
  guard,
  message
) {
  const current =
    guard ||
    createRequestGuard();

  const match =
    matchBuyResponse(
      current,
      message
    );

  if (!match.matched) {
    return {
      guard: current,
      match,
    };
  }

  return {
    match,

    guard: {
      ...current,

      buy: null,
    },
  };
}

// ============================================================
// CANCEL PROPOSAL ONLY
// ============================================================

export function cancelPendingProposal(
  guard
) {
  const current =
    guard ||
    createRequestGuard();

  return {
    ...current,

    proposal: null,
  };
}

// ============================================================
// INVALIDATE BOT GENERATION
// ============================================================

export function invalidateBotGeneration(
  guard
) {
  const current =
    guard ||
    createRequestGuard();

  /*
   * Proposal is cleared because a stale proposal must never
   * become a new purchase after STOP/restart.
   *
   * BUY is intentionally preserved. A BUY may already have
   * reached Deriv and can still return a valid contract.
   */

  return {
    ...current,

    generation:
      nextGeneration(
        current.generation
      ),

    proposal: null,
  };
}

// ============================================================
// FULL RESET
// ============================================================

export function resetRequestGuard() {
  return createRequestGuard();
}

// ============================================================
// STATUS
// ============================================================

export function getRequestGuardStatus(
  guard
) {
  const current =
    guard ||
    createRequestGuard();

  return {
    generation:
      current.generation,

    proposalPending:
      Boolean(
        current.proposal?.pending
      ),

    proposalOwner:
      current.proposal?.owner ??
      null,

    proposalReqId:
      current.proposal?.reqId ??
      null,

    buyPending:
      Boolean(
        current.buy?.pending
      ),

    buyOwner:
      current.buy?.owner ??
      null,

    buyReqId:
      current.buy?.reqId ??
      null,
  };
}

// ============================================================
// START PERMISSION
// ============================================================

export function canStartNewBotSession(
  guard
) {
  const status =
    getRequestGuardStatus(
      guard
    );

  if (
    status.buyPending
  ) {
    return {
      allowed: false,

      reason:
        'Wait for the in-flight purchase request to finish before starting a new bot session.',
    };
  }

  if (
    status.proposalPending
  ) {
    return {
      allowed: false,

      reason:
        'Wait for the pending proposal request to finish before starting a new bot session.',
    };
  }

  return {
    allowed: true,

    reason: '',
  };
}

// ============================================================
// OWNER HELPERS
// ============================================================

export function isAutoOwner(
  owner
) {
  return (
    owner ===
    REQUEST_OWNER.AUTO
  );
}

export function isManualOwner(
  owner
) {
  return (
    owner ===
    REQUEST_OWNER.MANUAL
  );
}
