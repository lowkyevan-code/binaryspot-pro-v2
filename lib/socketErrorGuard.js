// ============================================================
// BinarySpot Pro
// Socket Error Guard
// ============================================================
//
// Purpose:
//
// Deriv can return errors for many different WebSocket requests.
// Not every error should stop the automated bot.
//
// This helper classifies an incoming error by:
// - request type
// - ownership
// - contract relevance
// - severity
//
// IMPORTANT:
// This module does NOT place trades.
// This module does NOT enable real-money execution.
// ============================================================

export const SOCKET_ERROR_ACTION = Object.freeze({
  IGNORE: 'ignore',
  LOG_ONLY: 'log_only',
  STOP_BOT: 'stop_bot',
  RECOVER_CONTRACT: 'recover_contract',
});

export const SOCKET_REQUEST_TYPE = Object.freeze({
  PROPOSAL: 'proposal',
  BUY: 'buy',
  CONTRACT: 'proposal_open_contract',
  BALANCE: 'balance',
  FORGET: 'forget',
  PING: 'ping',
  UNKNOWN: 'unknown',
});

// ============================================================
// HELPERS
// ============================================================

function safeObject(value) {
  if (
    value &&
    typeof value === 'object' &&
    !Array.isArray(value)
  ) {
    return value;
  }

  return {};
}

function safeString(value) {
  if (
    typeof value !== 'string'
  ) {
    return '';
  }

  return value.trim();
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

// ============================================================
// REQUEST TYPE
// ============================================================

export function getSocketErrorRequestType(
  message
) {
  const data =
    safeObject(message);

  const echo =
    safeObject(
      data.echo_req
    );

  if (
    echo.proposal === 1
  ) {
    return SOCKET_REQUEST_TYPE.PROPOSAL;
  }

  if (
    Object.prototype.hasOwnProperty.call(
      echo,
      'buy'
    )
  ) {
    return SOCKET_REQUEST_TYPE.BUY;
  }

  if (
    echo.proposal_open_contract ===
    1
  ) {
    return SOCKET_REQUEST_TYPE.CONTRACT;
  }

  if (
    echo.balance === 1
  ) {
    return SOCKET_REQUEST_TYPE.BALANCE;
  }

  if (
    Object.prototype.hasOwnProperty.call(
      echo,
      'forget'
    )
  ) {
    return SOCKET_REQUEST_TYPE.FORGET;
  }

  if (
    echo.ping === 1
  ) {
    return SOCKET_REQUEST_TYPE.PING;
  }

  return SOCKET_REQUEST_TYPE.UNKNOWN;
}

// ============================================================
// ERROR DETAILS
// ============================================================

export function getSocketErrorDetails(
  message
) {
  const data =
    safeObject(message);

  const error =
    safeObject(
      data.error
    );

  const echo =
    safeObject(
      data.echo_req
    );

  return {
    hasError:
      Boolean(
        data.error
      ),

    code:
      safeString(
        error.code
      ),

    message:
      safeString(
        error.message
      ) ||
      'Deriv WebSocket request failed.',

    reqId:
      safeReqId(
        data.req_id ??
          echo.req_id
      ),

    requestType:
      getSocketErrorRequestType(
        data
      ),

    echoReq:
      echo,
  };
}

// ============================================================
// CLASSIFY ERROR
// ============================================================

export function classifySocketError(
  message,
  context = {}
) {
  const details =
    getSocketErrorDetails(
      message
    );

  if (
    !details.hasError
  ) {
    return {
      ...details,

      action:
        SOCKET_ERROR_ACTION.IGNORE,

      stopBot: false,

      recoveryRequired:
        false,

      reason:
        'Message does not contain a Deriv error.',
    };
  }

  const botRunning =
    Boolean(
      context.botRunning
    );

  const contractOpen =
    Boolean(
      context.contractOpen
    );

  const recoveryInProgress =
    Boolean(
      context.recoveryInProgress
    );

  const matchedProposal =
    Boolean(
      context.matchedProposal
    );

  const proposalOwner =
    safeString(
      context.proposalOwner
    );

  const matchedBuy =
    Boolean(
      context.matchedBuy
    );

  const buyOwner =
    safeString(
      context.buyOwner
    );

  // ==========================================================
  // PROPOSAL ERROR
  // ==========================================================

  if (
    details.requestType ===
    SOCKET_REQUEST_TYPE.PROPOSAL
  ) {
    const autoOwned =
      matchedProposal &&
      proposalOwner ===
        'auto';

    if (
      botRunning &&
      autoOwned
    ) {
      return {
        ...details,

        action:
          SOCKET_ERROR_ACTION.STOP_BOT,

        stopBot: true,

        recoveryRequired:
          false,

        reason:
          'The active automated proposal request failed.',
      };
    }

    return {
      ...details,

      action:
        SOCKET_ERROR_ACTION.LOG_ONLY,

      stopBot: false,

      recoveryRequired:
        false,

      reason:
        'A manual, stale, or unrelated proposal request failed.',
    };
  }

  // ==========================================================
  // BUY ERROR
  // ==========================================================

  if (
    details.requestType ===
    SOCKET_REQUEST_TYPE.BUY
  ) {
    const autoOwned =
      matchedBuy &&
      buyOwner ===
        'auto';

    if (
      botRunning &&
      autoOwned
    ) {
      return {
        ...details,

        action:
          SOCKET_ERROR_ACTION.STOP_BOT,

        stopBot: true,

        recoveryRequired:
          false,

        reason:
          'The active automated BUY request failed.',
      };
    }

    return {
      ...details,

      action:
        SOCKET_ERROR_ACTION.LOG_ONLY,

      stopBot: false,

      recoveryRequired:
        false,

      reason:
        'A manual, stale, or unrelated BUY request failed.',
    };
  }

  // ==========================================================
  // CONTRACT MONITOR ERROR
  // ==========================================================

  if (
    details.requestType ===
    SOCKET_REQUEST_TYPE.CONTRACT
  ) {
    if (
      contractOpen ||
      recoveryInProgress
    ) {
      return {
        ...details,

        action:
          SOCKET_ERROR_ACTION.RECOVER_CONTRACT,

        stopBot:
          botRunning,

        recoveryRequired:
          true,

        reason:
          'The active contract monitor failed and requires recovery.',
      };
    }

    return {
      ...details,

      action:
        SOCKET_ERROR_ACTION.LOG_ONLY,

      stopBot: false,

      recoveryRequired:
        false,

      reason:
        'Contract-monitor error occurred without a tracked live contract.',
    };
  }

  // ==========================================================
  // BALANCE
  // ==========================================================

  if (
    details.requestType ===
    SOCKET_REQUEST_TYPE.BALANCE
  ) {
    return {
      ...details,

      action:
        SOCKET_ERROR_ACTION.LOG_ONLY,

      stopBot: false,

      recoveryRequired:
        false,

      reason:
        'Balance request failure does not invalidate the trading session.',
    };
  }

  // ==========================================================
  // FORGET
  // ==========================================================

  if (
    details.requestType ===
    SOCKET_REQUEST_TYPE.FORGET
  ) {
    return {
      ...details,

      action:
        SOCKET_ERROR_ACTION.LOG_ONLY,

      stopBot: false,

      recoveryRequired:
        false,

      reason:
        'Subscription cleanup failure does not require stopping the bot.',
    };
  }

  // ==========================================================
  // PING
  // ==========================================================

  if (
    details.requestType ===
    SOCKET_REQUEST_TYPE.PING
  ) {
    return {
      ...details,

      action:
        SOCKET_ERROR_ACTION.LOG_ONLY,

      stopBot: false,

      recoveryRequired:
        false,

      reason:
        'Ping request error is logged without changing bot state.',
    };
  }

  // ==========================================================
  // UNKNOWN ERROR
  // ==========================================================
  //
  // Conservative behavior:
  //
  // Unknown WebSocket errors are logged, but they do not
  // automatically stop the bot unless we can prove they belong
  // to a critical proposal, BUY, or contract-monitor request.
  //
  // ==========================================================

  return {
    ...details,

    action:
      SOCKET_ERROR_ACTION.LOG_ONLY,

    stopBot: false,

    recoveryRequired:
      false,

    reason:
      'Unclassified WebSocket error. Logged without automatically changing bot state.',
  };
}

// ============================================================
// SIMPLE STATUS
// ============================================================

export function getSocketErrorActionLabel(
  classification
) {
  const result =
    safeObject(
      classification
    );

  switch (
    result.action
  ) {
    case SOCKET_ERROR_ACTION.STOP_BOT:
      return 'Stop Bot';

    case SOCKET_ERROR_ACTION.RECOVER_CONTRACT:
      return 'Recover Contract';

    case SOCKET_ERROR_ACTION.LOG_ONLY:
      return 'Log Only';

    case SOCKET_ERROR_ACTION.IGNORE:
      return 'Ignore';

    default:
      return 'Unknown';
  }
}
