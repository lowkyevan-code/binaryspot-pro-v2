/*
 * BinarySpot Pro
 * D-Bot -> Deriv Execution Bridge
 *
 * File:
 *   lib/dbotDerivBridge.js
 *
 * PURPOSE
 * -------
 * Connect the exact D-Bot XML runtime to BinarySpot's EXISTING
 * Deriv trading lifecycle.
 *
 * This file intentionally DOES NOT:
 * - create another WebSocket
 * - authenticate with Deriv
 * - bypass BinarySpot pending-BUY protection
 * - bypass contract recovery
 * - enable real-money execution
 * - rewrite XML strategy logic
 * - invent unsupported XML behavior
 *
 * page.jsx remains responsible for:
 * - proposal transport
 * - BUY transport
 * - request guards
 * - pending BUY persistence/reconciliation
 * - open-contract recovery
 * - account switching
 * - authenticated WebSocket ownership
 *
 * dbotXmlEngine.js remains responsible for:
 * - executing the XML strategy
 * - variables
 * - conditions
 * - purchase effects
 * - TRADE_AGAIN
 * - after-purchase XML logic
 */

const BRIDGE_VERSION = '1.0.0';

export const DBOT_BRIDGE_STATUS =
  Object.freeze({
    IDLE: 'IDLE',
    READY: 'READY',
    RUNNING: 'RUNNING',
    WAITING_FOR_TICK:
      'WAITING_FOR_TICK',
    REQUESTING_PROPOSAL:
      'REQUESTING_PROPOSAL',
    BUYING: 'BUYING',
    CONTRACT_OPEN:
      'CONTRACT_OPEN',
    SETTLING: 'SETTLING',
    STOPPING: 'STOPPING',
    STOPPED: 'STOPPED',
    ERROR: 'ERROR',
  });

const DIGIT_CONTRACTS =
  new Set([
    'DIGITEVEN',
    'DIGITODD',
    'DIGITOVER',
    'DIGITUNDER',
    'DIGITMATCH',
    'DIGITDIFF',
  ]);

const BARRIER_CONTRACTS =
  new Set([
    'DIGITOVER',
    'DIGITUNDER',
    'DIGITMATCH',
    'DIGITDIFF',
  ]);

function invariant(
  condition,
  message
) {
  if (!condition) {
    throw new Error(
      `[D-Bot Deriv Bridge] ${message}`
    );
  }
}

function asNumber(
  value,
  fallback = null
) {
  const number =
    Number(value);

  return Number.isFinite(
    number
  )
    ? number
    : fallback;
}

function asString(
  value,
  fallback = ''
) {
  if (
    value === undefined ||
    value === null
  ) {
    return fallback;
  }

  return String(value);
}

function normalizeContractType(
  value
) {
  return asString(
    value
  )
    .trim()
    .toUpperCase();
}

function normalizeDurationUnit(
  value
) {
  const normalized =
    asString(value)
      .trim()
      .toLowerCase();

  switch (normalized) {
    case 't':
    case 'tick':
    case 'ticks':
      return 't';

    case 's':
    case 'second':
    case 'seconds':
      return 's';

    case 'm':
    case 'minute':
    case 'minutes':
      return 'm';

    case 'h':
    case 'hour':
    case 'hours':
      return 'h';

    case 'd':
    case 'day':
    case 'days':
      return 'd';

    default:
      return normalized || 't';
  }
}

function normalizeAccountType(
  value
) {
  return asString(
    value
  )
    .trim()
    .toLowerCase();
}

function createBridgeError(
  code,
  message,
  details = null
) {
  const error =
    new Error(message);

  error.name =
    'DBotDerivBridgeError';

  error.code =
    code;

  error.details =
    details;

  return error;
}

function extractProposalId(
  proposal
) {
  return (
    proposal?.id ||
    proposal?.proposal?.id ||
    null
  );
}

function extractAskPrice(
  proposal
) {
  return asNumber(
    proposal?.ask_price ??
      proposal?.askPrice ??
      proposal?.proposal
        ?.ask_price,
    null
  );
}

function extractContractId(
  purchase
) {
  return (
    purchase?.contract_id ??
    purchase?.contractId ??
    purchase?.buy
      ?.contract_id ??
    null
  );
}

function extractProfit(
  contract
) {
  return asNumber(
    contract?.profit,
    0
  );
}

function extractSettlementState(
  contract
) {
  const status =
    asString(
      contract?.status
    ).toLowerCase();

  const isSold =
    Boolean(
      contract?.is_sold
    );

  const isExpired =
    Boolean(
      contract?.is_expired
    );

  const settled =
    isSold ||
    isExpired ||
    status === 'sold' ||
    status === 'won' ||
    status === 'lost';

  return {
    settled,
    status,
    isSold,
    isExpired,
  };
}

function classifyResult(
  contract
) {
  const profit =
    extractProfit(
      contract
    );

  if (profit > 0) {
    return 'win';
  }

  if (profit < 0) {
    return 'loss';
  }

  const status =
    asString(
      contract?.status
    ).toLowerCase();

  if (
    status === 'won'
  ) {
    return 'win';
  }

  if (
    status === 'lost'
  ) {
    return 'loss';
  }

  return null;
}

function resolveEffectContractType(
  effect,
  runtime
) {
  const direct =
    normalizeContractType(
      effect?.contractType
    );

  if (
    direct &&
    direct !== 'BOTH'
  ) {
    return direct;
  }

  const modelSelection =
    normalizeContractType(
      runtime?.model?.trade
        ?.contractSelection
    );

  if (
    modelSelection &&
    modelSelection !==
      'BOTH'
  ) {
    return modelSelection;
  }

  return null;
}

function findVariableByNames(
  runtime,
  names
) {
  if (
    !runtime?.model
      ?.variables
  ) {
    return undefined;
  }

  const normalizedNames =
    names.map(
      (name) =>
        asString(name)
          .trim()
          .toLowerCase()
    );

  for (
    const variable of
    Object.values(
      runtime.model
        .variables
    )
  ) {
    const variableName =
      asString(
        variable.name
      )
        .trim()
        .toLowerCase();

    if (
      normalizedNames.includes(
        variableName
      )
    ) {
      return runtime.variables[
        variable.id
      ];
    }
  }

  return undefined;
}

function resolveStake(
  runtime
) {
  const value =
    findVariableByNames(
      runtime,
      [
        'stake',
        'initial stake',
        'initial_stake',
        'amount',
      ]
    );

  const stake =
    asNumber(
      value,
      null
    );

  if (
    stake !== null &&
    stake > 0
  ) {
    return stake;
  }

  return null;
}

function resolvePrediction(
  runtime
) {
  const value =
    findVariableByNames(
      runtime,
      [
        'prediction',
        'prediction one',
        'prediction two',
        'prediction before loss',
        'prediction after loss',
        'entrypoint-digit',
        'entry point',
        'entrypoint',
      ]
    );

  const prediction =
    asNumber(
      value,
      null
    );

  if (
    prediction === null
  ) {
    return null;
  }

  return Math.trunc(
    prediction
  );
}

function resolveTradeOptions(
  runtime
) {
  const block =
    runtime?.model?.trade
      ?.tradeOptionsBlock;

  const evaluateSimple =
    (valueBlock) => {
      if (!valueBlock) {
        return null;
      }

      if (
        valueBlock.type ===
          'math_number' ||
        valueBlock.type ===
          'math_number_positive'
      ) {
        return asNumber(
          valueBlock.fields
            ?.NUM,
          null
        );
      }

      if (
        valueBlock.type ===
        'variables_get'
      ) {
        return runtime
          .variables[
            valueBlock.fields
              ?.VAR
          ];
      }

      return null;
    };

  const duration =
    asNumber(
      evaluateSimple(
        block?.values
          ?.DURATION
      ),
      1
    );

  const amount =
    asNumber(
      evaluateSimple(
        block?.values
          ?.AMOUNT
      ),
      null
    );

  const barrier =
    evaluateSimple(
      block?.values
        ?.PREDICTION
    );

  return {
    duration:
      duration > 0
        ? duration
        : 1,

    durationUnit:
      normalizeDurationUnit(
        runtime?.model?.trade
          ?.durationType ||
          't'
      ),

    amount,

    barrier,
  };
}

function buildProposalRequest({
  runtime,
  effect,
  currency,
}) {
  const trade =
    runtime.model.trade ||
    {};

  const options =
    resolveTradeOptions(
      runtime
    );

  const contractType =
    resolveEffectContractType(
      effect,
      runtime
    );

  invariant(
    contractType,
    'The XML purchase block did not resolve to a contract type.'
  );

  const symbol =
    trade.symbol;

  invariant(
    symbol,
    'The XML bot does not define an underlying symbol.'
  );

  const stake =
    resolveStake(
      runtime
    ) ??
    options.amount;

  invariant(
    Number.isFinite(
      Number(stake)
    ) &&
      Number(stake) > 0,
    'The XML bot did not resolve to a valid stake.'
  );

  const request = {
    proposal: 1,

    amount:
      Number(stake),

    basis:
      'stake',

    contract_type:
      contractType,

    currency,

    duration:
      options.duration,

    duration_unit:
      options.durationUnit,

    underlying_symbol:
      symbol,
  };

  if (
    BARRIER_CONTRACTS.has(
      contractType
    )
  ) {
    const prediction =
      resolvePrediction(
        runtime
      ) ??
      asNumber(
        options.barrier,
        null
      );

    invariant(
      prediction !== null,
      `${contractType} requires a prediction/barrier, but the XML runtime did not produce one.`
    );

    invariant(
      prediction >= 0 &&
        prediction <= 9,
      `Invalid digit prediction ${prediction}.`
    );

    request.barrier =
      String(
        Math.trunc(
          prediction
        )
      );
  }

  return request;
}

function createDefaultState() {
  return {
    status:
      DBOT_BRIDGE_STATUS
        .IDLE,

    running:
      false,

    stopping:
      false,

    botId:
      null,

    proposal:
      null,

    contractId:
      null,

    lastContract:
      null,

    lastError:
      null,

    lastTick:
      null,

    purchaseCount:
      0,

    settlementCount:
      0,

    startedAt:
      null,

    stoppedAt:
      null,
  };
}

export function createDBotDerivBridge(
  options = {}
) {
  const {
    getAccountType,

    getCurrency,

    isTradingConnected,

    hasOpenContract,

    hasPendingBuy,

    requestProposal,

    executeBuy,

    onContractPurchased,

    onStatusChange,

    onLog,

    onError,

    onStop,
  } = options;

  invariant(
    typeof getAccountType ===
      'function',
    'getAccountType callback is required.'
  );

  invariant(
    typeof getCurrency ===
      'function',
    'getCurrency callback is required.'
  );

  invariant(
    typeof isTradingConnected ===
      'function',
    'isTradingConnected callback is required.'
  );

  invariant(
    typeof hasOpenContract ===
      'function',
    'hasOpenContract callback is required.'
  );

  invariant(
    typeof hasPendingBuy ===
      'function',
    'hasPendingBuy callback is required.'
  );

  invariant(
    typeof requestProposal ===
      'function',
    'requestProposal callback is required.'
  );

  invariant(
    typeof executeBuy ===
      'function',
    'executeBuy callback is required.'
  );

  let runtime = null;

  let state =
    createDefaultState();

  let executionToken = 0;

  function emitStatus(
    status,
    extra = {}
  ) {
    state = {
      ...state,
      status,
      ...extra,
    };

    onStatusChange?.({
      ...state,
    });
  }

  function log(
    message,
    type = 'system'
  ) {
    onLog?.(
      message,
      type
    );
  }

  function fail(
    error
  ) {
    const normalized =
      error instanceof Error
        ? error
        : new Error(
            String(error)
          );

    state = {
      ...state,
      status:
        DBOT_BRIDGE_STATUS
          .ERROR,
      lastError:
        normalized.message,
    };

    onStatusChange?.({
      ...state,
    });

    onError?.(
      normalized
    );

    log(
      normalized.message,
      'error'
    );

    return normalized;
  }

  function assertDemo() {
    const accountType =
      normalizeAccountType(
        getAccountType()
      );

    if (
      accountType !==
      'demo'
    ) {
      throw createBridgeError(
        'REAL_ACCOUNT_BLOCKED',
        'D-Bot XML execution is currently restricted to Demo accounts.'
      );
    }
  }

  function assertCanTrade() {
    assertDemo();

    if (
      !isTradingConnected()
    ) {
      throw createBridgeError(
        'SOCKET_NOT_READY',
        'The authenticated Deriv trading connection is not ready.'
      );
    }

    if (
      hasOpenContract()
    ) {
      throw createBridgeError(
        'CONTRACT_ALREADY_OPEN',
        'A contract is already open. The XML bot cannot open another trade yet.'
      );
    }

    if (
      hasPendingBuy()
    ) {
      throw createBridgeError(
        'BUY_PENDING',
        'A BUY is pending or being reconciled. Another purchase is blocked.'
      );
    }
  }

  async function processPurchaseEffect(
    effect,
    token
  ) {
    if (
      !state.running ||
      token !==
        executionToken
    ) {
      return null;
    }

    assertCanTrade();

    const currency =
      asString(
        getCurrency()
      ).trim();

    invariant(
      currency,
      'Account currency is unavailable.'
    );

    const proposalRequest =
      buildProposalRequest({
        runtime,
        effect,
        currency,
      });

    emitStatus(
      DBOT_BRIDGE_STATUS
        .REQUESTING_PROPOSAL
    );

    log(
      `XML bot requesting ${proposalRequest.contract_type} proposal on ${proposalRequest.underlying_symbol}.`,
      'system'
    );

    const proposal =
      await requestProposal({
        request:
          proposalRequest,

        source:
          'dbot-xml',

        runtime,

        effect,
      });

    if (
      !state.running ||
      token !==
        executionToken
    ) {
      return null;
    }

    const proposalId =
      extractProposalId(
        proposal
      );

    const askPrice =
      extractAskPrice(
        proposal
      );

    invariant(
      proposalId,
      'Deriv returned a proposal without a proposal ID.'
    );

    invariant(
      askPrice !== null &&
        askPrice > 0,
      'Deriv returned an invalid proposal price.'
    );

    state = {
      ...state,
      proposal,
    };

    assertCanTrade();

    emitStatus(
      DBOT_BRIDGE_STATUS
        .BUYING
    );

    log(
      `XML bot proposal ready. Sending Demo BUY for ${proposalRequest.contract_type}.`,
      'system'
    );

    /*
     * IMPORTANT:
     *
     * executeBuy MUST be wired to BinarySpot's existing
     * protected BUY lifecycle.
     *
     * The callback is responsible for:
     * - request guard registration
     * - pending BUY persistence
     * - duplicate BUY protection
     * - sending the Deriv BUY request
     * - reconciliation if the connection drops
     */
    const purchase =
      await executeBuy({
        proposalId,

        price:
          askPrice,

        proposal,

        proposalRequest,

        source:
          'dbot-xml',

        runtime,

        effect,
      });

    if (
      token !==
      executionToken
    ) {
      return purchase;
    }

    const contractId =
      extractContractId(
        purchase
      );

    invariant(
      contractId,
      'Deriv BUY completed without a contract ID.'
    );

    state = {
      ...state,
      status:
        DBOT_BRIDGE_STATUS
          .CONTRACT_OPEN,

      proposal:
        null,

      contractId,

      purchaseCount:
        state.purchaseCount +
        1,
    };

    onStatusChange?.({
      ...state,
    });

    /*
     * page.jsx owns proposal_open_contract subscription
     * and contract recovery.
     */
    await onContractPurchased?.({
      contractId,
      purchase,
      proposalRequest,
      runtime,
    });

    log(
      `XML bot Demo contract opened: ${contractId}.`,
      'success'
    );

    return purchase;
  }

  async function processEffects(
    effects,
    token =
      executionToken
  ) {
    if (
      !Array.isArray(
        effects
      )
    ) {
      return [];
    }

    const results = [];

    for (
      const effect of
      effects
    ) {
      if (
        !state.running ||
        token !==
          executionToken
      ) {
        break;
      }

      if (!effect) {
        continue;
      }

      switch (
        effect.type
      ) {
        case 'PURCHASE': {
          const result =
            await processPurchaseEffect(
              effect,
              token
            );

          results.push({
            effect,
            result,
          });

          break;
        }

        case 'TRADE_AGAIN':
          emitStatus(
            DBOT_BRIDGE_STATUS
              .WAITING_FOR_TICK
          );

          results.push({
            effect,
            result:
              'WAITING_FOR_NEXT_TICK',
          });

          break;

        case 'MESSAGE':
          log(
            effect.message ||
              effect.text ||
              'D-Bot message',
            'system'
          );

          results.push({
            effect,
            result:
              'MESSAGE_HANDLED',
          });

          break;

        case 'VARIABLE_SET':
        case 'VARIABLE_CHANGE':
          /*
           * Already applied inside dbotXmlEngine.
           * Nothing should be duplicated here.
           */
          results.push({
            effect,
            result:
              'RUNTIME_ALREADY_UPDATED',
          });

          break;

        case 'TIMEOUT':
          /*
           * We do not guess timeout semantics here.
           * Exact timing execution can be added when the
           * XML engine exposes the complete timeout block
           * semantics for the uploaded bot.
           */
          results.push({
            effect,
            result:
              'TIMEOUT_DEFERRED_TO_ENGINE',
          });

          break;

        case 'SELL_AT_MARKET':
          throw createBridgeError(
            'SELL_HANDLER_REQUIRED',
            'The XML requested Sell At Market, but this bridge version does not execute early sells without BinarySpot recovery integration.'
          );

        case 'CUSTOM_PREDICTION':
          throw createBridgeError(
            'CUSTOM_PREDICTION_UNRESOLVED',
            'The XML reached a custom prediction block whose exact semantics must be handled by the XML engine before trading can continue.'
          );

        default:
          throw createBridgeError(
            'UNKNOWN_EFFECT',
            `Unsupported XML runtime effect: ${effect.type}`
          );
      }
    }

    return results;
  }

  async function start(
    nextRuntime
  ) {
    try {
      invariant(
        nextRuntime,
        'A D-Bot runtime is required.'
      );

      invariant(
        typeof nextRuntime
          .initialize ===
          'function',
        'The supplied object is not a valid D-Bot runtime.'
      );

      if (
        state.running
      ) {
        throw createBridgeError(
          'ALREADY_RUNNING',
          'A D-Bot XML strategy is already running.'
        );
      }

      assertDemo();

      if (
        hasOpenContract()
      ) {
        throw createBridgeError(
          'OPEN_CONTRACT',
          'Cannot start the XML bot while a contract is open.'
        );
      }

      if (
        hasPendingBuy()
      ) {
        throw createBridgeError(
          'PENDING_BUY',
          'Cannot start the XML bot while a BUY is pending or being reconciled.'
        );
      }

      runtime =
        nextRuntime;

      executionToken += 1;

      const token =
        executionToken;

      state = {
        ...createDefaultState(),

        status:
          DBOT_BRIDGE_STATUS
            .READY,

        running:
          true,

        botId:
          runtime.model
            ?.source
            ?.fileName ||
          null,

        startedAt:
          Date.now(),
      };

      onStatusChange?.({
        ...state,
      });

      const effects =
        runtime.initialize();

      log(
        `Loaded original XML bot: ${
          runtime.model
            ?.source
            ?.fileName ||
          'D-Bot'
        }.`,
        'success'
      );

      await processEffects(
        effects,
        token
      );

      if (
        state.running &&
        state.status ===
          DBOT_BRIDGE_STATUS
            .READY
      ) {
        emitStatus(
          DBOT_BRIDGE_STATUS
            .WAITING_FOR_TICK
        );
      }

      return {
        runtime,
        state: {
          ...state,
        },
      };
    } catch (error) {
      throw fail(error);
    }
  }

  async function handleTick(
    tick
  ) {
    if (
      !state.running ||
      !runtime
    ) {
      return [];
    }

    try {
      const token =
        executionToken;

      const normalizedTick =
        runtime.pushTick({
          quote:
            tick?.quote,

          epoch:
            tick?.epoch,

          pipSize:
            tick?.pipSize ??
            tick?.pip_size ??
            null,
        });

      state = {
        ...state,
        lastTick:
          normalizedTick,
      };

      if (
        state.status ===
          DBOT_BRIDGE_STATUS
            .CONTRACT_OPEN ||
        state.status ===
          DBOT_BRIDGE_STATUS
            .BUYING ||
        state.status ===
          DBOT_BRIDGE_STATUS
            .REQUESTING_PROPOSAL
      ) {
        return [];
      }

      /*
       * beforePurchase() is the exact XML entry logic.
       *
       * If its conditions do not reach a purchase block,
       * no PURCHASE effect is emitted and no trade occurs.
       */
      const effects =
        runtime.beforePurchase();

      const results =
        await processEffects(
          effects,
          token
        );

      if (
        state.running &&
        !hasOpenContract() &&
        !hasPendingBuy() &&
        state.status !==
          DBOT_BRIDGE_STATUS
            .REQUESTING_PROPOSAL &&
        state.status !==
          DBOT_BRIDGE_STATUS
            .BUYING
      ) {
        emitStatus(
          DBOT_BRIDGE_STATUS
            .WAITING_FOR_TICK
        );
      }

      return results;
    } catch (error) {
      throw fail(error);
    }
  }

  async function handleSettlement(
    contract
  ) {
    if (
      !runtime
    ) {
      return [];
    }

    try {
      const contractId =
        contract
          ?.contract_id ??
        contract
          ?.contractId ??
        state.contractId;

      if (
        state.contractId &&
        contractId &&
        String(
          state.contractId
        ) !==
          String(
            contractId
          )
      ) {
        return [];
      }

      const settlement =
        extractSettlementState(
          contract
        );

      if (
        !settlement
          .settled
      ) {
        return [];
      }

      emitStatus(
        DBOT_BRIDGE_STATUS
          .SETTLING
      );

      const result =
        classifyResult(
          contract
        );

      const profit =
        extractProfit(
          contract
        );

      /*
       * The settled Deriv result is fed directly back
       * into the original XML after_purchase chain.
       */
      const effects =
        runtime.afterPurchase({
          ...contract,

          id:
            contractId,

          contractId,

          result,

          profit,
        });

      state = {
        ...state,

        contractId:
          null,

        proposal:
          null,

        lastContract: {
          ...contract,
          result,
          profit,
        },

        settlementCount:
          state
            .settlementCount +
          1,
      };

      log(
        `XML bot contract settled | ${
          profit >= 0
            ? '+'
            : ''
        }${profit.toFixed(2)} | ${
          result ||
          'neutral'
        }`,
        result === 'win'
          ? 'success'
          : result ===
              'loss'
            ? 'error'
            : 'system'
      );

      const token =
        executionToken;

      const processed =
        await processEffects(
          effects,
          token
        );

      if (
        state.running &&
        !hasOpenContract() &&
        !hasPendingBuy() &&
        state.status !==
          DBOT_BRIDGE_STATUS
            .REQUESTING_PROPOSAL &&
        state.status !==
          DBOT_BRIDGE_STATUS
            .BUYING &&
        state.status !==
          DBOT_BRIDGE_STATUS
            .CONTRACT_OPEN
      ) {
        emitStatus(
          DBOT_BRIDGE_STATUS
            .WAITING_FOR_TICK
        );
      }

      return processed;
    } catch (error) {
      throw fail(error);
    }
  }

  function handleContractUpdate(
    contract
  ) {
    if (
      !state.running ||
      !runtime
    ) {
      return null;
    }

    const contractId =
      contract
        ?.contract_id ??
      contract
        ?.contractId ??
      null;

    if (
      state.contractId &&
      contractId &&
      String(
        state.contractId
      ) !==
        String(
          contractId
        )
    ) {
      return null;
    }

    const settlement =
      extractSettlementState(
        contract
      );

    if (
      settlement.settled
    ) {
      return handleSettlement(
        contract
      );
    }

    state = {
      ...state,

      status:
        DBOT_BRIDGE_STATUS
          .CONTRACT_OPEN,

      contractId:
        contractId ||
        state.contractId,

      lastContract: {
        ...contract,
      },
    };

    onStatusChange?.({
      ...state,
    });

    return {
      ...state,
    };
  }

  function markPurchaseRecovered(
    recovery
  ) {
    if (
      !runtime
    ) {
      return;
    }

    const contractId =
      recovery
        ?.contractId ??
      recovery
        ?.contract_id ??
      null;

    if (!contractId) {
      return;
    }

    state = {
      ...state,

      status:
        DBOT_BRIDGE_STATUS
          .CONTRACT_OPEN,

      contractId,

      proposal:
        null,
    };

    onStatusChange?.({
      ...state,
    });

    log(
      `XML bot BUY recovered. Contract ${contractId} is being monitored.`,
      'system'
    );
  }

  function markReconciliationPending() {
    if (
      !runtime
    ) {
      return;
    }

    state = {
      ...state,

      status:
        DBOT_BRIDGE_STATUS
          .BUYING,
    };

    onStatusChange?.({
      ...state,
    });

    log(
      'XML bot BUY outcome is being reconciled. New purchases remain blocked.',
      'system'
    );
  }

  function stop(
    reason =
      'Stopped by user.'
  ) {
    if (
      !state.running &&
      state.status ===
        DBOT_BRIDGE_STATUS
          .STOPPED
    ) {
      return {
        ...state,
      };
    }

    executionToken += 1;

    state = {
      ...state,

      running:
        false,

      stopping:
        false,

      status:
        DBOT_BRIDGE_STATUS
          .STOPPED,

      stoppedAt:
        Date.now(),
    };

    onStatusChange?.({
      ...state,
    });

    log(
      `XML bot stopped: ${reason}`,
      'system'
    );

    onStop?.(
      reason,
      {
        ...state,
      }
    );

    return {
      ...state,
    };
  }

  function reset() {
    if (
      state.running
    ) {
      stop(
        'Runtime reset.'
      );
    }

    executionToken += 1;

    runtime = null;

    state =
      createDefaultState();

    onStatusChange?.({
      ...state,
    });
  }

  function getState() {
    return {
      ...state,
    };
  }

  function getRuntime() {
    return runtime;
  }

  function isRunning() {
    return Boolean(
      state.running
    );
  }

  function canStart() {
    const accountType =
      normalizeAccountType(
        getAccountType()
      );

    if (
      accountType !==
      'demo'
    ) {
      return {
        allowed: false,
        reason:
          'Demo account required.',
      };
    }

    if (
      !isTradingConnected()
    ) {
      return {
        allowed: false,
        reason:
          'Trading connection is not ready.',
      };
    }

    if (
      hasPendingBuy()
    ) {
      return {
        allowed: false,
        reason:
          'A BUY is pending or being reconciled.',
      };
    }

    if (
      hasOpenContract()
    ) {
      return {
        allowed: false,
        reason:
          'A contract is already open.',
      };
    }

    if (
      state.running
    ) {
      return {
        allowed: false,
        reason:
          'An XML bot is already running.',
      };
    }

    return {
      allowed: true,
      reason: null,
    };
  }

  return {
    start,
    stop,
    reset,

    handleTick,

    handleContractUpdate,

    handleSettlement,

    markPurchaseRecovered,

    markReconciliationPending,

    processEffects,

    getState,

    getRuntime,

    isRunning,

    canStart,

    get version() {
      return BRIDGE_VERSION;
    },
  };
}

export function isDigitContractType(
  contractType
) {
  return DIGIT_CONTRACTS.has(
    normalizeContractType(
      contractType
    )
  );
}

export function requiresDigitBarrier(
  contractType
) {
  return BARRIER_CONTRACTS.has(
    normalizeContractType(
      contractType
    )
  );
}

export function getDBotDerivBridgeVersion() {
  return BRIDGE_VERSION;
}

export default {
  create:
    createDBotDerivBridge,

  isDigitContractType,

  requiresDigitBarrier,

  getVersion:
    getDBotDerivBridgeVersion,
};
