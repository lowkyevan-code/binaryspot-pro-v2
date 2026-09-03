'use client';

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  evaluateEntrySignal,
  buildDigitAnalysis,
  getSuggestedDigit,
  getExecutionFromSignal,
  getConfidenceLabel,
  getStrategyLibrary,
  getStrategyById,
  isAdvancedStrategy,
} from '../lib/strategyEngine';

import {
  validateBotSettings,
  canOpenNewContract,
  evaluateSettlementSafety,
  calculateNextStake,
  createCooldown,
  buildSessionStatus,
} from '../lib/botSafety';

import {
  createTradeLifecycle,
  beginTradeLifecycle,
  attachContractToLifecycle,
  isAutoTrade,
  shouldProcessSettlement,
  markLifecycleSettled,
  classifyTradeResult,
  getPostSettlementAction,
  describeLifecycle,
} from '../lib/tradeLifecycle';

import {
  normalizeDerivTick,
  prependDigitToHistory,
} from '../lib/tickPrecision';

import {
  createPipSizeCache,
  applyCachedPipSize,
  getPipSizeCacheStatus,
} from '../lib/pipSizeCache';

import {
  REQUEST_OWNER,
  createRequestGuard,
  beginProposalRequest,
  beginBuyRequest,
  resolveProposalRequest,
  resolveBuyRequest,
  invalidateBotGeneration,
  resetRequestGuard,
  canStartNewBotSession,
  getRequestGuardStatus,
  isAutoOwner,
} from '../lib/requestGuard';

import {
  createContractRecovery,
  registerLiveContract,
  attachRecoverySubscription,
  markContractDisconnected,
  canRecoverContract,
  beginContractRecovery,
  completeContractRecovery,
  failContractRecovery,
  markRecoveredContractSettled,
  clearContractRecovery,
  getContractRecoveryStatus,
  buildContractRecoveryRequest,
  describeContractRecovery,
} from '../lib/contractRecovery';

import {
  createProposalFreshness,
  registerProposalFreshness,
  canBuyFreshProposal,
  clearProposalFreshness,
  getProposalFreshnessStatus,
} from '../lib/proposalFreshness';

import {
  createRecoveryBackoff,
  canAttemptRecovery,
  getNextRecoveryDelay,
  recordRecoveryFailure,
  resetRecoveryBackoff,
  getRecoveryBackoffStatus,
} from '../lib/recoveryBackoff';

import {
  SOCKET_ERROR_ACTION,
  classifySocketError,
  getSocketErrorActionLabel,
} from '../lib/socketErrorGuard';

import {
  persistLiveContractRecovery,
  loadContractRecoveryRecord,
  clearContractRecoveryRecord,
  canRestoreStoredContract,
  getStoredRecoveryStatus,
} from '../lib/contractRecoveryStorage';

import {
  createPendingBuyRecovery,
  registerPendingBuy,
  markPendingBuyAmbiguous,
  beginPendingBuyReconciliation,
  resolvePendingBuyWithContract,
  clearPendingBuyRecovery,
  getPendingBuyRecoveryStatus,
  canOpenAfterPendingBuy,
} from '../lib/pendingBuyRecovery';

import {
  BUY_RECONCILIATION_STATE,
  createPendingBuyReconciliation,
  buildPortfolioReconciliationRequest,
  buildProfitTableReconciliationRequest,
  beginPendingBuyReconciliationSearch,
  applyPortfolioReconciliationResult,
  applyProfitTableReconciliationResult,
  evaluatePendingBuyReconciliation,
  failPendingBuyReconciliation,
  getPendingBuyReconciliationStatus,
  clearPendingBuyReconciliation,
  validatePendingBuyContext,
} from '../lib/pendingBuyReconciliation';

import {
  persistPendingBuyRecovery,
  loadPendingBuyRecoveryRecord,
  clearPendingBuyRecoveryRecord,
  canRestoreStoredPendingBuy,
  getStoredPendingBuyStatus,
} from '../lib/pendingBuyRecoveryStorage';

import {
  saveSessionState,
  loadSessionState,
  clearSessionState,
  canRestoreSessionState,
  buildRestoredSessionState,
  getSessionStateStatus,
} from '../lib/sessionStateStorage';

const CLIENT_ID =
  '34hh45FQkPfMgbgj20uoR';

const REDIRECT_URI =
  'https://binaryspot-pro-v2.vercel.app/auth/deriv/callback';

const PUBLIC_WS_URL =
  'wss://api.derivws.com/trading/v1/options/ws/public';

const INPUT_CLASS =
  'w-full mt-2 bg-[#111827] border border-slate-700 p-3 rounded-xl text-sm text-slate-100 font-mono outline-none focus:border-emerald-500 disabled:opacity-50';

const strategyLibrary =
  getStrategyLibrary();

const nativeStrategies = [
  'DIGITDIFF',
  'DIGITMATCH',
  'DIGITEVEN',
  'DIGITODD',
  'DIGITOVER',
  'DIGITUNDER',
];

const barrierContracts = [
  'DIGITDIFF',
  'DIGITMATCH',
  'DIGITOVER',
  'DIGITUNDER',
];

export default function BinarySpotPro() {
  const [isLoading, setIsLoading] =
    useState(true);

  const [isConnecting, setIsConnecting] =
    useState(false);

  const [isLoggingOut, setIsLoggingOut] =
    useState(false);

  const [isAuthorized, setIsAuthorized] =
    useState(false);

  const [
    isTradingConnected,
    setIsTradingConnected,
  ] = useState(false);

  const [accounts, setAccounts] =
    useState([]);

  const [
    selectedAccountId,
    setSelectedAccountId,
  ] = useState('');

  const [accountId, setAccountId] =
    useState('');

  const [accountType, setAccountType] =
    useState('');

  const [balance, setBalance] =
    useState(null);

  const [currency, setCurrency] =
    useState('USD');

  const [authError, setAuthError] =
    useState('');

  const [activeTab, setActiveTab] =
    useState('overview');

  const [
    isMarketConnected,
    setIsMarketConnected,
  ] = useState(false);

  const [symbol, setSymbol] =
    useState('R_100');

  const [lastTick, setLastTick] =
    useState(null);

  const [prevTick, setPrevTick] =
    useState(null);

  const [
    formattedTick,
    setFormattedTick,
  ] = useState('Waiting...');

  const [lastDigit, setLastDigit] =
    useState(null);

  const [pipSize, setPipSize] =
    useState(null);

  const [pipSource, setPipSource] =
    useState('none');

  const [usedPipSize, setUsedPipSize] =
    useState(false);

  const [digitHistory, setDigitHistory] =
    useState([]);

  const [strategy, setStrategy] =
    useState('DIGITDIFF');

  const [
    predictionDigit,
    setPredictionDigit,
  ] = useState('0');

  const [
    minimumConfidence,
    setMinimumConfidence,
  ] = useState('62');

  const [signal, setSignal] = useState({
    shouldTrade: false,
    strategyId: 'DIGITDIFF',
    confidence: 0,
    contractType: 'DIGITDIFF',
    predictionDigit: 0,
    reason: 'Waiting for market data.',
    sampleSize: 0,
    metrics: {},
  });

  const [baseStake, setBaseStake] =
    useState('1.00');

  const [
    currentStake,
    setCurrentStake,
  ] = useState('1.00');

  const [duration, setDuration] =
    useState('1');

  const [martingale, setMartingale] =
    useState('2.00');

  const [takeProfit, setTakeProfit] =
    useState('10.00');

  const [stopLoss, setStopLoss] =
    useState('20.00');

  const [
    maxConsecutiveLosses,
    setMaxConsecutiveLosses,
  ] = useState('3');

  const [maxStake, setMaxStake] =
    useState('10.00');

  const [maxTrades, setMaxTrades] =
    useState('10');

  const [
    cooldownSeconds,
    setCooldownSeconds,
  ] = useState('2');

  const [
    isAutoBotRunning,
    setIsAutoBotRunning,
  ] = useState(false);

  const [autoBotStatus, setAutoBotStatus] =
    useState('Standby');

  const [
    emergencyStopped,
    setEmergencyStopped,
  ] = useState(false);

  const [totalProfit, setTotalProfit] =
    useState(0);

  const [tradeCount, setTradeCount] =
    useState(0);

  const [winCount, setWinCount] =
    useState(0);

  const [lossCount, setLossCount] =
    useState(0);

  const [drawCount, setDrawCount] =
    useState(0);

  const [
    consecutiveLosses,
    setConsecutiveLosses,
  ] = useState(0);

  const [botLogs, setBotLogs] =
    useState([]);

  const [tradeHistory, setTradeHistory] =
    useState([]);

  const [
    proposalLoading,
    setProposalLoading,
  ] = useState(false);

  const [
    proposalError,
    setProposalError,
  ] = useState('');

  const [proposalData, setProposalData] =
    useState(null);

  const [
    proposalClock,
    setProposalClock,
  ] = useState(0);

  const [buyLoading, setBuyLoading] =
    useState(false);

  const [buyError, setBuyError] =
    useState('');

  const [
    activeContract,
    setActiveContract,
  ] = useState(null);

  const [
    contractStatus,
    setContractStatus,
  ] = useState('No active contract');

  const [
    contractProfit,
    setContractProfit,
  ] = useState(null);

  const [
    lifecycleLabel,
    setLifecycleLabel,
  ] = useState('No active lifecycle');

  const [
    requestStatusLabel,
    setRequestStatusLabel,
  ] = useState('No in-flight request');

  const [
    recoveryLabel,
    setRecoveryLabel,
  ] = useState('No recovery needed');

  const [
    persistedRecoveryLabel,
    setPersistedRecoveryLabel,
  ] = useState('No persisted contract');

  const [
    pendingBuyLabel,
    setPendingBuyLabel,
  ] = useState(
    'No pending BUY ambiguity'
  );

  const [
    persistedPendingBuyLabel,
    setPersistedPendingBuyLabel,
  ] = useState(
    'No stored BUY ambiguity'
  );

  const [
    reconciliationLabel,
    setReconciliationLabel,
  ] = useState('Reconciliation idle');

  const [
    reconciliationReason,
    setReconciliationReason,
  ] = useState('');

  const [
    reconciliationRunning,
    setReconciliationRunning,
  ] = useState(false);

  const [
    storedSessionLabel,
    setStoredSessionLabel,
  ] = useState('No stored session');

  const [
    sessionPersistenceReady,
    setSessionPersistenceReady,
  ] = useState(false);

  const [
    recoveryBackoffUi,
    setRecoveryBackoffUi,
  ] = useState(
    getRecoveryBackoffStatus(
      createRecoveryBackoff()
    )
  );

  const [
    socketErrorLabel,
    setSocketErrorLabel,
  ] = useState('No socket errors');

  const publicWsRef = useRef(null);
  const tradingWsRef = useRef(null);

  const connectTradingSocketRef =
    useRef(null);

  const contractSubscriptionRef =
    useRef(null);

  const publicPingRef = useRef(null);
  const tradingPingRef = useRef(null);

  const pipSizeCacheRef = useRef(
    createPipSizeCache()
  );

  const proposalFreshnessRef = useRef(
    createProposalFreshness()
  );

  const recoveryRef = useRef(
    createContractRecovery()
  );

  const recoveryBackoffRef = useRef(
    createRecoveryBackoff()
  );

  const pendingBuyRecoveryRef = useRef(
    createPendingBuyRecovery()
  );

  const pendingBuyReconciliationRef =
    useRef(
      createPendingBuyReconciliation()
    );

  const reconciliationRequestRef =
    useRef({
      portfolioReqId: null,
      profitTableReqId: null,
    });

  const pendingReconciliationRunnerRef =
    useRef(null);

  const pendingReconciliationFetchRef =
    useRef(false);

  const recoveryTimerRef = useRef(null);

  const recoveryRunnerRef = useRef(null);

  const recoveryFetchRunningRef =
    useRef(false);

  const requestIdRef = useRef(1000);

  const autoBotRunningRef =
    useRef(false);

  const emergencyStoppedRef =
    useRef(false);

  const proposalPendingRef =
    useRef(false);

  const buyPendingRef = useRef(false);

  const contractOpenRef = useRef(false);

  const cooldownUntilRef = useRef(0);

  const digitHistoryRef = useRef([]);

  const symbolRef = useRef('R_100');

  const accountIdRef = useRef('');

  const accountTypeRef = useRef('');

  const currencyRef = useRef('USD');

  const strategyRef =
    useRef('DIGITDIFF');

  const predictionDigitRef =
    useRef('0');

  const minimumConfidenceRef =
    useRef(62);

  const baseStakeRef = useRef(1);
  const currentStakeRef = useRef(1);
  const durationRef = useRef(1);
  const martingaleRef = useRef(2);
  const takeProfitRef = useRef(10);
  const stopLossRef = useRef(20);
  const maxLossesRef = useRef(3);
  const maxStakeRef = useRef(10);
  const maxTradesRef = useRef(10);

  const cooldownSecondsRef =
    useRef(2);

  const totalProfitRef = useRef(0);
  const tradeCountRef = useRef(0);

  const consecutiveLossesRef =
    useRef(0);

  const lifecycleRef = useRef(
    createTradeLifecycle()
  );

  const requestGuardRef = useRef(
    createRequestGuard()
  );

  useEffect(() => {
    autoBotRunningRef.current =
      isAutoBotRunning;
  }, [isAutoBotRunning]);

  useEffect(() => {
    emergencyStoppedRef.current =
      emergencyStopped;
  }, [emergencyStopped]);

  useEffect(() => {
    symbolRef.current = symbol;
  }, [symbol]);

  useEffect(() => {
    accountIdRef.current = accountId;
  }, [accountId]);

  useEffect(() => {
    accountTypeRef.current =
      accountType;
  }, [accountType]);

  useEffect(() => {
    currencyRef.current = currency;
  }, [currency]);

  useEffect(() => {
    strategyRef.current = strategy;
  }, [strategy]);

  useEffect(() => {
    predictionDigitRef.current =
      predictionDigit;
  }, [predictionDigit]);

  useEffect(() => {
    minimumConfidenceRef.current =
      Number(minimumConfidence) || 0;
  }, [minimumConfidence]);

  useEffect(() => {
    baseStakeRef.current =
      Number(baseStake) || 1;
  }, [baseStake]);

  useEffect(() => {
    currentStakeRef.current =
      Number(currentStake) || 1;
  }, [currentStake]);

  useEffect(() => {
    durationRef.current =
      Number(duration) || 1;
  }, [duration]);

  useEffect(() => {
    martingaleRef.current =
      Number(martingale) || 1;
  }, [martingale]);

  useEffect(() => {
    takeProfitRef.current =
      Number(takeProfit) || 0;
  }, [takeProfit]);

  useEffect(() => {
    stopLossRef.current =
      Number(stopLoss) || 0;
  }, [stopLoss]);

  useEffect(() => {
    maxLossesRef.current =
      Number(maxConsecutiveLosses) || 1;
  }, [maxConsecutiveLosses]);

  useEffect(() => {
    maxStakeRef.current =
      Number(maxStake) || 1;
  }, [maxStake]);

  useEffect(() => {
    maxTradesRef.current =
      Number(maxTrades) || 1;
  }, [maxTrades]);

  useEffect(() => {
    cooldownSecondsRef.current =
      Number(cooldownSeconds) || 0;
  }, [cooldownSeconds]);

  useEffect(() => {
    if (!proposalData?.id) {
      return undefined;
    }

    setProposalClock(Date.now());

    const timer = setInterval(() => {
      setProposalClock(Date.now());
    }, 1000);

    return () => {
      clearInterval(timer);
    };
  }, [proposalData?.id]);

  const nextReqId = () => {
    requestIdRef.current += 1;
    return requestIdRef.current;
  };

  const addBotLog = useCallback(
    (message, type = 'info') => {
      const time =
        new Date().toLocaleTimeString();

      setBotLogs((previous) => [
        {
          time,
          message,
          type,
        },
        ...previous.slice(0, 149),
      ]);
    },
    []
  );

  const syncStoredSession =
    useCallback(() => {
      const stored =
        loadSessionState();

      if (
        !stored.found ||
        !stored.valid ||
        !stored.state
      ) {
        setStoredSessionLabel(
          'No stored session'
        );
        return;
      }

      const status =
        getSessionStateStatus(
          stored.state
        );

      setStoredSessionLabel(
        status.label
      );
    }, []);

  const clearManualProposal =
    useCallback(() => {
      proposalFreshnessRef.current =
        clearProposalFreshness();

      setProposalData(null);
      setProposalClock(Date.now());
    }, []);

  const syncLifecycleLabel =
    useCallback(() => {
      setLifecycleLabel(
        describeLifecycle(
          lifecycleRef.current
        )
      );
    }, []);

  const syncRecoveryLabel =
    useCallback(() => {
      setRecoveryLabel(
        describeContractRecovery(
          recoveryRef.current
        )
      );
    }, []);

  const syncRecoveryBackoff =
    useCallback(() => {
      setRecoveryBackoffUi(
        getRecoveryBackoffStatus(
          recoveryBackoffRef.current
        )
      );
    }, []);

  const syncPendingBuyRecovery =
    useCallback(() => {
      const status =
        getPendingBuyRecoveryStatus(
          pendingBuyRecoveryRef.current
        );

      setPendingBuyLabel(status.label);
    }, []);

  const syncStoredPendingBuy =
    useCallback(() => {
      const stored =
        loadPendingBuyRecoveryRecord();

      if (
        !stored.found ||
        !stored.valid ||
        !stored.record
      ) {
        setPersistedPendingBuyLabel(
          'No stored BUY ambiguity'
        );
        return;
      }

      const status =
        getStoredPendingBuyStatus(
          stored.record
        );

      setPersistedPendingBuyLabel(
        status.label
      );
    }, []);

  const clearStoredPendingBuy =
    useCallback(() => {
      clearPendingBuyRecoveryRecord();
      syncStoredPendingBuy();
    }, [syncStoredPendingBuy]);

  const syncPendingBuyReconciliation =
    useCallback(() => {
      const status =
        getPendingBuyReconciliationStatus(
          pendingBuyReconciliationRef.current
        );

      setReconciliationLabel(
        status.label
      );

      setReconciliationReason(
        status.error ||
          status.reason ||
          ''
      );

      setReconciliationRunning(
        status.searching
      );
    }, []);

  const syncPersistedRecovery =
    useCallback(() => {
      const stored =
        loadContractRecoveryRecord();

      if (
        !stored.found ||
        !stored.valid ||
        !stored.record
      ) {
        setPersistedRecoveryLabel(
          'No persisted contract'
        );
        return;
      }

      const status =
        getStoredRecoveryStatus(
          stored.record
        );

      setPersistedRecoveryLabel(
        status.label
      );
    }, []);

  const syncRequestStatus =
    useCallback(() => {
      const status =
        getRequestGuardStatus(
          requestGuardRef.current
        );

      proposalPendingRef.current =
        status.proposalPending;

      buyPendingRef.current =
        status.buyPending;

      if (status.buyPending) {
        setRequestStatusLabel(
          `BUY #${status.buyReqId} — ${String(
            status.buyOwner || ''
          ).toUpperCase()}`
        );
        return;
      }

      if (status.proposalPending) {
        setRequestStatusLabel(
          `PROPOSAL #${status.proposalReqId} — ${String(
            status.proposalOwner || ''
          ).toUpperCase()}`
        );
        return;
      }

      setRequestStatusLabel(
        `Generation ${status.generation} — Clear`
      );
    }, []);

  useEffect(() => {
    if (
      !sessionPersistenceReady ||
      !accountId ||
      accountType !== 'demo'
    ) {
      return;
    }

    const result =
      saveSessionState({
        accountId,
        accountType,
        currency,
        symbol,
        strategy,
        predictionDigit,

        baseStake:
          Number(baseStake) || 1,

        currentStake:
          Number(currentStake) || 1,

        martingale:
          Number(martingale) || 2,

        takeProfit:
          Number(takeProfit) || 0,

        stopLoss:
          Number(stopLoss) || 0,

        maxConsecutiveLosses:
          Number(
            maxConsecutiveLosses
          ) || 1,

        maxStake:
          Number(maxStake) || 1,

        maxTrades:
          Number(maxTrades) || 1,

        cooldownSeconds:
          Number(cooldownSeconds) || 0,

        minimumConfidence:
          Number(
            minimumConfidence
          ) || 0,

        duration:
          Number(duration) || 1,

        totalProfit,
        tradeCount,
        winCount,
        lossCount,
        drawCount,
        consecutiveLosses,
        tradeHistory,

        botWasRunning:
          isAutoBotRunning,
      });

    if (result.saved) {
      const status =
        getSessionStateStatus(
          result.state
        );

      setStoredSessionLabel(
        status.label
      );
    }
  }, [
    sessionPersistenceReady,
    accountId,
    accountType,
    currency,
    symbol,
    strategy,
    predictionDigit,
    baseStake,
    currentStake,
    martingale,
    takeProfit,
    stopLoss,
    maxConsecutiveLosses,
    maxStake,
    maxTrades,
    cooldownSeconds,
    minimumConfidence,
    duration,
    totalProfit,
    tradeCount,
    winCount,
    lossCount,
    drawCount,
    consecutiveLosses,
    tradeHistory,
    isAutoBotRunning,
  ]);

  const clearRecoveryTimer =
    useCallback(() => {
      if (recoveryTimerRef.current) {
        clearTimeout(
          recoveryTimerRef.current
        );

        recoveryTimerRef.current = null;
      }
    }, []);

  const clearReconciliationRequests =
    useCallback(() => {
      reconciliationRequestRef.current = {
        portfolioReqId: null,
        profitTableReqId: null,
      };
    }, []);

  const queueContractRecovery =
    useCallback(
      (requestedDelay = null) => {
        const recoveryStatus =
          getContractRecoveryStatus(
            recoveryRef.current
          );

        if (
          !recoveryStatus.hasContract ||
          recoveryStatus.settled
        ) {
          return;
        }

        const permission =
          canAttemptRecovery(
            recoveryBackoffRef.current
          );

        if (!permission.allowed) {
          clearRecoveryTimer();

          setContractStatus(
            'RECOVERY PAUSED'
          );

          syncRecoveryBackoff();

          addBotLog(
            'Automatic contract recovery paused because the retry limit was reached.',
            'error'
          );

          return;
        }

        if (recoveryTimerRef.current) {
          return;
        }

        const delay =
          requestedDelay !== null &&
          Number.isFinite(
            Number(requestedDelay)
          ) &&
          Number(requestedDelay) >= 0
            ? Number(requestedDelay)
            : getNextRecoveryDelay(
                recoveryBackoffRef.current
              );

        const seconds =
          Math.ceil(delay / 1000);

        if (delay > 0) {
          setContractStatus(
            `RECOVERY IN ${seconds}s`
          );
        }

        recoveryTimerRef.current =
          setTimeout(() => {
            recoveryTimerRef.current =
              null;

            recoveryRunnerRef.current?.();
          }, delay);
      },
      [
        addBotLog,
        clearRecoveryTimer,
        syncRecoveryBackoff,
      ]
    );

  const registerRecoveryFailure =
    useCallback(
      (reason) => {
        recoveryBackoffRef.current =
          recordRecoveryFailure(
            recoveryBackoffRef.current
          );

        recoveryRef.current =
          failContractRecovery(
            recoveryRef.current
          );

        syncRecoveryLabel();
        syncRecoveryBackoff();

        const status =
          getRecoveryBackoffStatus(
            recoveryBackoffRef.current
          );

        if (status.exhausted) {
          clearRecoveryTimer();

          setContractStatus(
            'RECOVERY PAUSED'
          );

          addBotLog(
            `${reason} Automatic recovery exhausted after ${status.attempts}/${status.maxAttempts} attempts.`,
            'error'
          );

          return;
        }

        setContractStatus(
          'RECOVERY REQUIRED'
        );

        addBotLog(
          `${reason} Next retry in ${status.nextDelaySeconds}s.`,
          'error'
        );

        queueContractRecovery();
      },
      [
        addBotLog,
        clearRecoveryTimer,
        queueContractRecovery,
        syncRecoveryBackoff,
        syncRecoveryLabel,
      ]
    );

  const stopAutoBot =
    useCallback(
      (reason = 'Stopped manually') => {
        autoBotRunningRef.current =
          false;

        setIsAutoBotRunning(false);

        requestGuardRef.current =
          invalidateBotGeneration(
            requestGuardRef.current
          );

        const status =
          getRequestGuardStatus(
            requestGuardRef.current
          );

        proposalPendingRef.current =
          status.proposalPending;

        buyPendingRef.current =
          status.buyPending;

        setProposalLoading(
          status.proposalPending
        );

        setBuyLoading(
          status.buyPending
        );

        syncRequestStatus();

        setAutoBotStatus(reason);

        addBotLog(
          status.buyPending
            ? `Auto bot stopped: ${reason}. In-flight BUY remains unresolved until its outcome is known.`
            : `Auto bot stopped: ${reason}`,
          'system'
        );
      },
      [addBotLog, syncRequestStatus]
    );

  const emergencyStop =
    useCallback(() => {
      emergencyStoppedRef.current = true;

      setEmergencyStopped(true);

      autoBotRunningRef.current = false;

      setIsAutoBotRunning(false);

      requestGuardRef.current =
        invalidateBotGeneration(
          requestGuardRef.current
        );

      const status =
        getRequestGuardStatus(
          requestGuardRef.current
        );

      proposalPendingRef.current =
        status.proposalPending;

      buyPendingRef.current =
        status.buyPending;

      setProposalLoading(
        status.proposalPending
      );

      setBuyLoading(status.buyPending);

      syncRequestStatus();

      setAutoBotStatus(
        'EMERGENCY STOP ACTIVATED'
      );

      addBotLog(
        contractOpenRef.current ||
          status.buyPending
          ? 'EMERGENCY STOP: New entries blocked. Any active or uncertain BUY will still be accounted for.'
          : 'EMERGENCY STOP: New entries blocked.',
        'error'
      );
    },
    [addBotLog, syncRequestStatus]
  );

  const clearEmergencyStop = () => {
    const requestStatus =
      getRequestGuardStatus(
        requestGuardRef.current
      );

    const pendingPermission =
      canOpenAfterPendingBuy(
        pendingBuyRecoveryRef.current
      );

    if (
      contractOpenRef.current ||
      requestStatus.buyPending ||
      !pendingPermission.allowed
    ) {
      setBuyError(
        'Wait until the active or uncertain BUY state is resolved first.'
      );
      return;
    }

    emergencyStoppedRef.current =
      false;

    setEmergencyStopped(false);
    setBuyError('');
    setAutoBotStatus('Standby');

    addBotLog(
      'Emergency Stop cleared.',
      'system'
    );
  };

  const closeTradingSocket =
    useCallback(() => {
      clearRecoveryTimer();

      if (tradingPingRef.current) {
        clearInterval(
          tradingPingRef.current
        );

        tradingPingRef.current = null;
      }

      if (tradingWsRef.current) {
        try {
          tradingWsRef.current.onclose =
            null;

          tradingWsRef.current.onerror =
            null;

          tradingWsRef.current.close();
        } catch {}

        tradingWsRef.current = null;
      }

      contractSubscriptionRef.current =
        null;

      proposalPendingRef.current = false;
      buyPendingRef.current = false;

      requestGuardRef.current =
        resetRequestGuard();

      setProposalLoading(false);
      setBuyLoading(false);

      setRequestStatusLabel(
        'Socket closed — requests reset'
      );

      setIsTradingConnected(false);
    },
    [clearRecoveryTimer]
  );

  /*
   * IMPORTANT:
   *
   * strategyRef is BinarySpot's strategy.
   * executionSignal.contractType is the actual
   * contract sent to Deriv.
   *
   * Advanced strategy IDs are NEVER sent as
   * contract_type.
   */
  const buildProposalPayload =
    useCallback(
      (
        stakeAmount,
        executionSignal = null
      ) => {
        const parsedStake =
          Number(stakeAmount);

        const parsedDuration =
          Number(durationRef.current);

        const currentStrategy =
          strategyRef.current;

        const currentSymbol =
          symbolRef.current;

        let contractType =
          currentStrategy;

        let prediction =
          Number(
            predictionDigitRef.current
          );

        if (executionSignal) {
          const execution =
            getExecutionFromSignal(
              executionSignal
            );

          if (!execution.valid) {
            throw new Error(
              execution.reason
            );
          }

          contractType =
            execution.contractType;

          if (
            execution.predictionDigit !==
              null &&
            execution.predictionDigit !==
              undefined
          ) {
            prediction =
              Number(
                execution.predictionDigit
              );
          }
        } else if (
          !nativeStrategies.includes(
            currentStrategy
          )
        ) {
          throw new Error(
            'This advanced strategy requires a qualified execution signal before requesting a Deriv proposal.'
          );
        }

        if (
          !nativeStrategies.includes(
            contractType
          )
        ) {
          throw new Error(
            'Unsupported Deriv execution contract.'
          );
        }

        if (
          !Number.isFinite(parsedStake) ||
          parsedStake <= 0
        ) {
          throw new Error(
            'Stake must be greater than zero.'
          );
        }

        if (
          parsedStake >
          maxStakeRef.current
        ) {
          throw new Error(
            `Stake ${parsedStake.toFixed(
              2
            )} exceeds Maximum Stake ${maxStakeRef.current.toFixed(
              2
            )}.`
          );
        }

        if (
          !Number.isInteger(
            parsedDuration
          ) ||
          parsedDuration < 1
        ) {
          throw new Error(
            'Duration must be at least 1 tick.'
          );
        }

        if (!currentSymbol) {
          throw new Error(
            'A trading symbol is required.'
          );
        }

        if (
          barrierContracts.includes(
            contractType
          )
        ) {
          if (
            !Number.isInteger(
              prediction
            ) ||
            prediction < 0 ||
            prediction > 9
          ) {
            throw new Error(
              'Prediction digit must be between 0 and 9.'
            );
          }

          if (
            contractType ===
              'DIGITOVER' &&
            prediction > 8
          ) {
            throw new Error(
              'Digit Over barrier must be between 0 and 8.'
            );
          }

          if (
            contractType ===
              'DIGITUNDER' &&
            prediction < 1
          ) {
            throw new Error(
              'Digit Under barrier must be between 1 and 9.'
            );
          }
        }

        const payload = {
          proposal: 1,

          amount: Number(
            parsedStake.toFixed(2)
          ),

          basis: 'stake',

          contract_type:
            contractType,

          currency:
            currencyRef.current ||
            'USD',

          duration:
            parsedDuration,

          duration_unit: 't',

          underlying_symbol:
            currentSymbol,

          req_id:
            nextReqId(),
        };

        if (
          barrierContracts.includes(
            contractType
          )
        ) {
          payload.barrier =
            String(prediction);
        }

        return payload;
      },
      []
    );

  const requestAutoProposal =
    useCallback(
      (entrySignal) => {
        const pendingPermission =
          canOpenAfterPendingBuy(
            pendingBuyRecoveryRef.current
          );

        if (!pendingPermission.allowed) {
          stopAutoBot(
            pendingPermission.reason
          );
          return;
        }

        const permission =
          canOpenNewContract({
            botRunning:
              autoBotRunningRef.current,

            emergencyStopped:
              emergencyStoppedRef.current,

            accountType:
              accountTypeRef.current,

            tradingConnected:
              tradingWsRef.current
                ?.readyState ===
              WebSocket.OPEN,

            proposalPending:
              proposalPendingRef.current,

            buyPending:
              buyPendingRef.current,

            contractOpen:
              contractOpenRef.current,

            cooldownUntil:
              cooldownUntilRef.current,

            tradeCount:
              tradeCountRef.current,

            maxTrades:
              maxTradesRef.current,
          });

        if (!permission.allowed) {
          if (permission.stopBot) {
            stopAutoBot(
              permission.reason
            );
          }

          return;
        }

        const confidence =
          Number(
            entrySignal?.confidence
          );

        if (
          confidence <
          minimumConfidenceRef.current
        ) {
          return;
        }

        const execution =
          getExecutionFromSignal(
            entrySignal
          );

        if (!execution.valid) {
          stopAutoBot(
            execution.reason
          );
          return;
        }

        const ws =
          tradingWsRef.current;

        if (
          !ws ||
          ws.readyState !==
            WebSocket.OPEN
        ) {
          stopAutoBot(
            'Trading socket disconnected.'
          );
          return;
        }

        try {
          clearManualProposal();

          const stake =
            currentStakeRef.current;

          const payload =
            buildProposalPayload(
              stake,
              entrySignal
            );

          const registration =
            beginProposalRequest(
              requestGuardRef.current,
              {
                reqId:
                  payload.req_id,

                owner:
                  REQUEST_OWNER.AUTO,
              }
            );

          if (!registration.valid) {
            throw new Error(
              registration.reason
            );
          }

          requestGuardRef.current =
            registration.guard;

          syncRequestStatus();

          lifecycleRef.current =
            beginTradeLifecycle({
              mode: 'auto',
            });

          syncLifecycleLabel();

          proposalPendingRef.current =
            true;

          setProposalLoading(true);
          setProposalError('');

          setAutoBotStatus(
            `ENTRY — ${entrySignal.strategyId} → ${execution.contractType} · ${confidence.toFixed(
              1
            )}%`
          );

          addBotLog(
            `ENTRY | Strategy ${
              entrySignal.strategyId ||
              strategyRef.current
            } | Contract ${
              execution.contractType
            }${
              execution.predictionDigit !==
                null &&
              execution.predictionDigit !==
                undefined
                ? ` | Barrier ${execution.predictionDigit}`
                : ''
            } | ${
              symbolRef.current
            } | Confidence ${confidence.toFixed(
              1
            )}% | Stake ${
              currencyRef.current
            } ${stake.toFixed(
              2
            )} | Req #${payload.req_id}`,
            'trade'
          );

          ws.send(
            JSON.stringify(payload)
          );
        } catch (error) {
          requestGuardRef.current =
            invalidateBotGeneration(
              requestGuardRef.current
            );

          syncRequestStatus();

          proposalPendingRef.current =
            false;

          setProposalLoading(false);

          lifecycleRef.current =
            createTradeLifecycle();

          syncLifecycleLabel();

          stopAutoBot(
            error.message ||
              'Proposal setup error'
          );
        }
      },
      [
        addBotLog,
        buildProposalPayload,
        clearManualProposal,
        stopAutoBot,
        syncLifecycleLabel,
        syncRequestStatus,
      ]
    );

  const evaluateAutoEntry =
    useCallback(
      (history) => {
        const result =
          evaluateEntrySignal({
            strategy:
              strategyRef.current,

            digitHistory:
              history,

            predictionDigit:
              predictionDigitRef.current,

            config: {
              minimumConfidence:
                minimumConfidenceRef.current,
            },
          });

        setSignal(result);

        if (
          !autoBotRunningRef.current
        ) {
          return;
        }

        const pendingPermission =
          canOpenAfterPendingBuy(
            pendingBuyRecoveryRef.current
          );

        if (!pendingPermission.allowed) {
          stopAutoBot(
            pendingPermission.reason
          );
          return;
        }

        const permission =
          canOpenNewContract({
            botRunning:
              autoBotRunningRef.current,

            emergencyStopped:
              emergencyStoppedRef.current,

            accountType:
              accountTypeRef.current,

            tradingConnected:
              tradingWsRef.current
                ?.readyState ===
              WebSocket.OPEN,

            proposalPending:
              proposalPendingRef.current,

            buyPending:
              buyPendingRef.current,

            contractOpen:
              contractOpenRef.current,

            cooldownUntil:
              cooldownUntilRef.current,

            tradeCount:
              tradeCountRef.current,

            maxTrades:
              maxTradesRef.current,
          });

        if (!permission.allowed) {
          if (permission.stopBot) {
            stopAutoBot(
              permission.reason
            );

            return;
          }

          if (
            permission.cooldownRemaining
          ) {
            setAutoBotStatus(
              `Cooldown — ${permission.cooldownRemaining}s`
            );
          }

          return;
        }

        if (!result.shouldTrade) {
          setAutoBotStatus(
            `WAIT — ${result.reason}`
          );

          return;
        }

        if (
          Number(result.confidence) <
          minimumConfidenceRef.current
        ) {
          setAutoBotStatus(
            `WAIT — Signal ${Number(
              result.confidence
            ).toFixed(
              1
            )}% below minimum ${minimumConfidenceRef.current}%`
          );

          return;
        }

        const execution =
          getExecutionFromSignal(
            result
          );

        if (!execution.valid) {
          setAutoBotStatus(
            `WAIT — ${execution.reason}`
          );
          return;
        }

        requestAutoProposal(result);
      },
      [
        requestAutoProposal,
        stopAutoBot,
      ]
    );

  const handleAutoSettlement =
    useCallback(
      (contract) => {
        const contractId =
          contract.contract_id;

        if (
          !shouldProcessSettlement(
            lifecycleRef.current,
            contractId
          )
        ) {
          return;
        }

        const result =
          classifyTradeResult(
            contract.profit
          );

        lifecycleRef.current =
          markLifecycleSettled(
            lifecycleRef.current,
            contractId
          );

        syncLifecycleLabel();

        contractOpenRef.current =
          false;

        const settlement =
          evaluateSettlementSafety({
            profit: result.profit,

            totalProfit:
              totalProfitRef.current,

            tradeCount:
              tradeCountRef.current,

            consecutiveLosses:
              consecutiveLossesRef.current,

            takeProfit:
              takeProfitRef.current,

            stopLoss:
              stopLossRef.current,

            maxTrades:
              maxTradesRef.current,

            maxConsecutiveLosses:
              maxLossesRef.current,
          });

        totalProfitRef.current =
          settlement.nextTotalProfit;

        setTotalProfit(
          settlement.nextTotalProfit
        );

        tradeCountRef.current =
          settlement.nextTradeCount;

        setTradeCount(
          settlement.nextTradeCount
        );

        consecutiveLossesRef.current =
          settlement.nextConsecutiveLosses;

        setConsecutiveLosses(
          settlement.nextConsecutiveLosses
        );

        if (result.won) {
          setWinCount(
            (value) => value + 1
          );
        } else if (result.lost) {
          setLossCount(
            (value) => value + 1
          );
        } else {
          setDrawCount(
            (value) => value + 1
          );
        }

        const tradeStake =
          Number(
            contract.buy_price ??
              currentStakeRef.current
          );

        setTradeHistory(
          (previous) => [
            {
              id:
                contract.contract_id,

              result:
                result.result,

              profit:
                result.profit,

              stake:
                tradeStake,

              strategy:
                strategyRef.current,

              contractType:
                contract.contract_type,

              symbol:
                symbolRef.current,

              time:
                new Date().toLocaleTimeString(),
            },
            ...previous.slice(0, 49),
          ]
        );

        if (result.won) {
          addBotLog(
            `WIN +${result.profit.toFixed(
              2
            )} ${
              contract.currency ||
              currencyRef.current
            } | Net ${
              settlement.nextTotalProfit >=
              0
                ? '+'
                : ''
            }${settlement.nextTotalProfit.toFixed(
              2
            )}`,
            'success'
          );
        } else if (result.lost) {
          addBotLog(
            `LOSS ${result.profit.toFixed(
              2
            )} ${
              contract.currency ||
              currencyRef.current
            } | Net ${settlement.nextTotalProfit.toFixed(
              2
            )}`,
            'error'
          );
        } else {
          addBotLog(
            `DRAW 0.00 ${
              contract.currency ||
              currencyRef.current
            } | Stake unchanged`,
            'system'
          );
        }

        if (settlement.stopBot) {
          stopAutoBot(
            settlement.stopReason
          );
          return;
        }

        if (result.won) {
          const stakeResult =
            calculateNextStake({
              won: true,

              baseStake:
                baseStakeRef.current,

              currentStake:
                currentStakeRef.current,

              martingale:
                martingaleRef.current,

              maxStake:
                maxStakeRef.current,
            });

          currentStakeRef.current =
            stakeResult.stake;

          setCurrentStake(
            stakeResult.stake.toFixed(
              2
            )
          );
        } else if (result.lost) {
          const stakeResult =
            calculateNextStake({
              won: false,

              baseStake:
                baseStakeRef.current,

              currentStake:
                currentStakeRef.current,

              martingale:
                martingaleRef.current,

              maxStake:
                maxStakeRef.current,
            });

          if (!stakeResult.allowed) {
            addBotLog(
              stakeResult.reason,
              'error'
            );

            stopAutoBot(
              stakeResult.reason
            );

            return;
          }

          currentStakeRef.current =
            stakeResult.stake;

          setCurrentStake(
            stakeResult.stake.toFixed(
              2
            )
          );
        }

        const postSettlement =
          getPostSettlementAction({
            lifecycle:
              lifecycleRef.current,

            botRunning:
              autoBotRunningRef.current,

            emergencyStopped:
              emergencyStoppedRef.current,

            safetyStopTriggered:
              false,
          });

        if (
          !postSettlement.continueBot
        ) {
          setAutoBotStatus(
            postSettlement.reason
          );

          return;
        }

        cooldownUntilRef.current =
          createCooldown(
            cooldownSecondsRef.current
          );

        const sessionStatus =
          buildSessionStatus({
            running: true,

            emergencyStopped:
              false,

            contractOpen:
              false,

            proposalPending:
              false,

            buyPending:
              false,

            cooldownUntil:
              cooldownUntilRef.current,
          });

        setAutoBotStatus(
          sessionStatus.label
        );

        addBotLog(
          'Contract settled. Waiting for the next qualified strategy signal.',
          'system'
        );
      },
      [
        addBotLog,
        stopAutoBot,
        syncLifecycleLabel,
      ]
    );

  /*
   * BUY reconciliation and socket safety logic below
   * preserve the architecture already built.
   */

  const finalizePendingBuyReconciliation =
    useCallback(
      (ws) => {
        const evaluated =
          evaluatePendingBuyReconciliation(
            pendingBuyReconciliationRef.current
          );

        pendingBuyReconciliationRef.current =
          evaluated;

        syncPendingBuyReconciliation();

        if (
          evaluated.state ===
          BUY_RECONCILIATION_STATE.SEARCHING
        ) {
          return;
        }

        pendingReconciliationFetchRef.current =
          false;

        const pendingStatus =
          getPendingBuyRecoveryStatus(
            pendingBuyRecoveryRef.current
          );

        if (
          evaluated.state ===
          BUY_RECONCILIATION_STATE.OPEN_CONTRACT_FOUND
        ) {
          const candidate =
            evaluated.selectedCandidate;

          const contractId =
            candidate?.contractId;

          if (!contractId) {
            setBuyError(
              'Reconciliation found an open position but no usable contract ID.'
            );
            return;
          }

          const resolved =
            resolvePendingBuyWithContract(
              pendingBuyRecoveryRef.current,
              contractId
            );

          if (!resolved.valid) {
            setBuyError(
              resolved.reason
            );
            return;
          }

          const owner =
            pendingStatus.owner ===
            'auto'
              ? 'auto'
              : 'manual';

          lifecycleRef.current =
            beginTradeLifecycle({
              mode: owner,
            });

          lifecycleRef.current =
            attachContractToLifecycle(
              lifecycleRef.current,
              contractId
            );

          const recoveryRegistration =
            registerLiveContract(
              createContractRecovery(),
              {
                contractId,

                accountId:
                  accountIdRef.current,

                owner,
              }
            );

          if (
            !recoveryRegistration.valid
          ) {
            setBuyError(
              recoveryRegistration.reason
            );
            return;
          }

          recoveryRef.current =
            recoveryRegistration.recovery;

          recoveryBackoffRef.current =
            resetRecoveryBackoff(
              recoveryBackoffRef.current
            );

          contractOpenRef.current = true;
          buyPendingRef.current = false;

          setBuyLoading(false);
          setBuyError('');

          setActiveContract({
            contractId,

            buyPrice:
              candidate.buyPrice ??
              pendingStatus.expectedStake ??
              null,

            transactionId:
              candidate.transactionId ||
              null,

            isSold: false,
          });

          setContractProfit(0);

          setContractStatus(
            'RECONCILED — LIVE'
          );

          setAutoBotStatus(
            `Recovered Contract #${contractId}`
          );

          persistLiveContractRecovery({
            contractId,

            accountId:
              accountIdRef.current,

            accountType:
              accountTypeRef.current,

            owner,

            symbol:
              candidate.symbol ||
              pendingStatus.symbol ||
              symbolRef.current,

            createdAt:
              pendingStatus.startedAt ||
              Date.now(),
          });

          pendingBuyRecoveryRef.current =
            clearPendingBuyRecovery();

          requestGuardRef.current =
            resetRequestGuard();

          clearStoredPendingBuy();

          syncRequestStatus();
          syncPendingBuyRecovery();
          syncLifecycleLabel();
          syncRecoveryLabel();
          syncRecoveryBackoff();
          syncPersistedRecovery();

          addBotLog(
            `BUY reconciliation recovered live contract #${contractId}. Automated trading remains stopped.`,
            'success'
          );

          if (
            ws &&
            ws.readyState ===
              WebSocket.OPEN
          ) {
            ws.send(
              JSON.stringify({
                proposal_open_contract:
                  1,

                contract_id:
                  contractId,

                subscribe: 1,

                req_id:
                  nextReqId(),
              })
            );
          }

          return;
        }

        if (
          evaluated.state ===
          BUY_RECONCILIATION_STATE.SETTLED_CONTRACT_FOUND
        ) {
          const candidate =
            evaluated.selectedCandidate;

          if (!candidate?.contractId) {
            setBuyError(
              'A possible settled BUY was found, but it has no usable contract ID.'
            );
            return;
          }

          const profit =
            Number(
              candidate.profit ?? 0
            );

          const safeProfit =
            Number.isFinite(profit)
              ? profit
              : 0;

          const result =
            classifyTradeResult(
              safeProfit
            );

          tradeCountRef.current += 1;

          totalProfitRef.current =
            Number(
              (
                totalProfitRef.current +
                safeProfit
              ).toFixed(2)
            );

          setTradeCount(
            tradeCountRef.current
          );

          setTotalProfit(
            totalProfitRef.current
          );

          if (result.won) {
            setWinCount(
              (value) => value + 1
            );

            consecutiveLossesRef.current =
              0;

            setConsecutiveLosses(0);
          } else if (result.lost) {
            setLossCount(
              (value) => value + 1
            );

            consecutiveLossesRef.current +=
              1;

            setConsecutiveLosses(
              consecutiveLossesRef.current
            );
          } else {
            setDrawCount(
              (value) => value + 1
            );
          }

          setTradeHistory(
            (previous) => [
              {
                id:
                  candidate.contractId,

                result:
                  result.result,

                profit:
                  safeProfit,

                stake:
                  candidate.buyPrice ??
                  pendingStatus.expectedStake ??
                  0,

                strategy:
                  pendingStatus.strategy ||
                  strategyRef.current,

                contractType:
                  candidate.contractType ||
                  null,

                symbol:
                  candidate.symbol ||
                  pendingStatus.symbol ||
                  symbolRef.current,

                time:
                  new Date().toLocaleTimeString(),

                recovered: true,
              },
              ...previous.slice(0, 49),
            ]
          );

          contractOpenRef.current = false;
          buyPendingRef.current = false;

          pendingBuyRecoveryRef.current =
            clearPendingBuyRecovery();

          requestGuardRef.current =
            resetRequestGuard();

          clearStoredPendingBuy();

          setBuyLoading(false);
          setBuyError('');

          setActiveContract({
            contractId:
              candidate.contractId,

            buyPrice:
              candidate.buyPrice,

            transactionId:
              candidate.transactionId ||
              null,

            isSold: true,

            status:
              result.result,
          });

          setContractProfit(
            safeProfit
          );

          setContractStatus(
            `RECONCILED — ${String(
              result.result
            ).toUpperCase()}`
          );

          setAutoBotStatus(
            'Reconciled settled BUY — bot remains stopped'
          );

          syncRequestStatus();
          syncPendingBuyRecovery();

          addBotLog(
            `BUY reconciliation found settled contract #${candidate.contractId}.`,
            'success'
          );

          return;
        }

        if (
          evaluated.state ===
          BUY_RECONCILIATION_STATE.NO_MATCH
        ) {
          setBuyError(
            'No sufficiently strong BUY match was found. Trading remains frozen.'
          );

          setAutoBotStatus(
            'BUY reconciliation unresolved'
          );

          return;
        }

        if (
          evaluated.state ===
          BUY_RECONCILIATION_STATE.AMBIGUOUS
        ) {
          setBuyError(
            'Multiple possible BUY matches were found. BinarySpot will not guess.'
          );

          setAutoBotStatus(
            'Multiple BUY matches'
          );
        }
      },
      [
        addBotLog,
        clearStoredPendingBuy,
        syncLifecycleLabel,
        syncPendingBuyRecovery,
        syncPendingBuyReconciliation,
        syncPersistedRecovery,
        syncRecoveryBackoff,
        syncRecoveryLabel,
        syncRequestStatus,
      ]
    );

  const connectTradingSocket =
    useCallback(
      (wsUrl) => {
        if (!wsUrl) {
          setIsTradingConnected(false);
          return;
        }

        if (tradingPingRef.current) {
          clearInterval(
            tradingPingRef.current
          );

          tradingPingRef.current = null;
        }

        if (tradingWsRef.current) {
          try {
            tradingWsRef.current.onclose =
              null;

            tradingWsRef.current.onerror =
              null;

            tradingWsRef.current.close();
          } catch {}
        }

        contractSubscriptionRef.current =
          null;

        const ws =
          new WebSocket(wsUrl);

        tradingWsRef.current = ws;

        ws.onopen = () => {
          recoveryFetchRunningRef.current =
            false;

          setIsTradingConnected(true);

          setSocketErrorLabel(
            'No socket errors'
          );

          addBotLog(
            `Authenticated Deriv trading socket connected to ${accountIdRef.current || 'active account'}.`,
            'system'
          );

          ws.send(
            JSON.stringify({
              balance: 1,

              subscribe: 1,

              req_id:
                nextReqId(),
            })
          );

          const pendingStatus =
            getPendingBuyRecoveryStatus(
              pendingBuyRecoveryRef.current
            );

          const reconciliationStatus =
            getPendingBuyReconciliationStatus(
              pendingBuyReconciliationRef.current
            );

          if (
            pendingStatus.blocking &&
            reconciliationStatus.searching
          ) {
            const contextValidation =
              validatePendingBuyContext(
                pendingBuyRecoveryRef.current,
                {
                  accountId:
                    accountIdRef.current,

                  accountType:
                    accountTypeRef.current,
                }
              );

            if (
              !contextValidation.valid
            ) {
              pendingBuyReconciliationRef.current =
                failPendingBuyReconciliation(
                  pendingBuyReconciliationRef.current,
                  contextValidation.reason
                );

              pendingReconciliationFetchRef.current =
                false;

              syncPendingBuyReconciliation();

              setBuyError(
                contextValidation.reason
              );
            } else {
              const portfolioReqId =
                nextReqId();

              const profitTableReqId =
                nextReqId();

              const portfolioRequest =
                buildPortfolioReconciliationRequest(
                  portfolioReqId
                );

              const profitRequest =
                buildProfitTableReconciliationRequest(
                  profitTableReqId,
                  {
                    limit: 100,
                  }
                );

              if (
                portfolioRequest.valid &&
                profitRequest.valid
              ) {
                reconciliationRequestRef.current =
                  {
                    portfolioReqId,
                    profitTableReqId,
                  };

                ws.send(
                  JSON.stringify(
                    portfolioRequest.payload
                  )
                );

                ws.send(
                  JSON.stringify(
                    profitRequest.payload
                  )
                );
              }
            }
          }

          const recoveryStatus =
            getContractRecoveryStatus(
              recoveryRef.current
            );

          if (
            recoveryStatus.hasContract &&
            recoveryStatus.needsRecovery
          ) {
            const permission =
              canRecoverContract(
                recoveryRef.current,
                {
                  accountId:
                    accountIdRef.current,

                  tradingConnected:
                    true,
                }
              );

            if (permission.allowed) {
              recoveryRef.current =
                beginContractRecovery(
                  recoveryRef.current
                );

              syncRecoveryLabel();

              const recoveryRequest =
                buildContractRecoveryRequest(
                  recoveryRef.current,
                  nextReqId()
                );

              if (
                recoveryRequest.valid
              ) {
                setContractStatus(
                  'RECOVERING'
                );

                ws.send(
                  JSON.stringify(
                    recoveryRequest.payload
                  )
                );
              }
            }
          }

          tradingPingRef.current =
            setInterval(() => {
              if (
                ws.readyState ===
                WebSocket.OPEN
              ) {
                ws.send(
                  JSON.stringify({
                    ping: 1,
                  })
                );
              }
            }, 30000);
        };

        ws.onmessage = (event) => {
          try {
            const data =
              JSON.parse(event.data);

            const reconciliationRequests =
              reconciliationRequestRef.current;

            const isReconciliationPortfolio =
              data.req_id ===
              reconciliationRequests.portfolioReqId;

            const isReconciliationProfitTable =
              data.req_id ===
              reconciliationRequests.profitTableReqId;

            if (data.error) {
              const message =
                data.error.message ||
                'Deriv rejected the request.';

              if (
                isReconciliationPortfolio ||
                isReconciliationProfitTable
              ) {
                pendingBuyReconciliationRef.current =
                  failPendingBuyReconciliation(
                    pendingBuyReconciliationRef.current,
                    message
                  );

                pendingReconciliationFetchRef.current =
                  false;

                clearReconciliationRequests();
                syncPendingBuyReconciliation();

                setBuyError(
                  `BUY reconciliation failed: ${message}`
                );

                return;
              }

              let matchedProposal =
                false;

              let proposalOwner = '';

              let matchedBuy = false;

              let buyOwner = '';

              if (
                data.echo_req?.proposal ===
                1
              ) {
                const resolved =
                  resolveProposalRequest(
                    requestGuardRef.current,
                    data
                  );

                if (
                  resolved.match.matched
                ) {
                  matchedProposal =
                    true;

                  proposalOwner =
                    resolved.match.owner ||
                    '';

                  requestGuardRef.current =
                    resolved.guard;

                  proposalPendingRef.current =
                    false;

                  setProposalLoading(false);
                  setProposalError(message);

                  if (
                    !isAutoOwner(
                      proposalOwner
                    )
                  ) {
                    clearManualProposal();
                  }

                  syncRequestStatus();
                }
              }

              if (
                Object.prototype.hasOwnProperty.call(
                  data.echo_req || {},
                  'buy'
                )
              ) {
                const resolved =
                  resolveBuyRequest(
                    requestGuardRef.current,
                    data
                  );

                if (
                  resolved.match.matched
                ) {
                  matchedBuy = true;

                  buyOwner =
                    resolved.match.owner ||
                    '';

                  requestGuardRef.current =
                    resolved.guard;

                  buyPendingRef.current =
                    false;

                  setBuyLoading(false);
                  setBuyError(message);

                  pendingBuyRecoveryRef.current =
                    clearPendingBuyRecovery();

                  pendingBuyReconciliationRef.current =
                    clearPendingBuyReconciliation();

                  clearStoredPendingBuy();

                  syncPendingBuyRecovery();
                  syncPendingBuyReconciliation();
                  syncRequestStatus();
                }
              }

              const recoveryStatus =
                getContractRecoveryStatus(
                  recoveryRef.current
                );

              const classification =
                classifySocketError(
                  data,
                  {
                    botRunning:
                      autoBotRunningRef.current,

                    contractOpen:
                      contractOpenRef.current,

                    recoveryInProgress:
                      recoveryStatus.recovering,

                    matchedProposal,

                    proposalOwner,

                    matchedBuy,

                    buyOwner,
                  }
                );

              setSocketErrorLabel(
                `${getSocketErrorActionLabel(
                  classification
                )}: ${
                  classification.code ||
                  'Deriv error'
                }`
              );

              addBotLog(
                `${message} [${getSocketErrorActionLabel(
                  classification
                )}]`,
                'error'
              );

              if (
                classification.action ===
                SOCKET_ERROR_ACTION.RECOVER_CONTRACT
              ) {
                recoveryRef.current =
                  markContractDisconnected(
                    recoveryRef.current
                  );

                syncRecoveryLabel();

                setContractStatus(
                  'RECOVERY REQUIRED'
                );

                queueContractRecovery();

                return;
              }

              if (
                classification.action ===
                  SOCKET_ERROR_ACTION.STOP_BOT &&
                classification.stopBot &&
                autoBotRunningRef.current
              ) {
                stopAutoBot(message);
              }

              return;
            }

            if (
              isReconciliationPortfolio
            ) {
              const contracts =
                data.portfolio?.contracts ??
                [];

              pendingBuyReconciliationRef.current =
                applyPortfolioReconciliationResult(
                  pendingBuyReconciliationRef.current,
                  pendingBuyRecoveryRef.current,
                  Array.isArray(
                    contracts
                  )
                    ? contracts
                    : []
                );

              syncPendingBuyReconciliation();

              finalizePendingBuyReconciliation(
                ws
              );

              return;
            }

            if (
              isReconciliationProfitTable
            ) {
              const transactions =
                data.profit_table
                  ?.transactions ??
                [];

              pendingBuyReconciliationRef.current =
                applyProfitTableReconciliationResult(
                  pendingBuyReconciliationRef.current,
                  pendingBuyRecoveryRef.current,
                  Array.isArray(
                    transactions
                  )
                    ? transactions
                    : []
                );

              syncPendingBuyReconciliation();

              finalizePendingBuyReconciliation(
                ws
              );

              return;
            }

            if (
              data.msg_type ===
                'balance' &&
              data.balance
            ) {
              if (
                data.balance.loginid &&
                accountIdRef.current &&
                data.balance.loginid !==
                  accountIdRef.current
              ) {
                return;
              }

              setBalance(
                data.balance.balance
              );

              const nextCurrency =
                data.balance.currency ||
                currencyRef.current ||
                'USD';

              setCurrency(nextCurrency);

              currencyRef.current =
                nextCurrency;
            }

            if (
              data.msg_type ===
                'proposal' &&
              data.proposal
            ) {
              const resolved =
                resolveProposalRequest(
                  requestGuardRef.current,
                  data
                );

              if (
                !resolved.match.matched
              ) {
                return;
              }

              requestGuardRef.current =
                resolved.guard;

              syncRequestStatus();

              proposalPendingRef.current =
                false;

              setProposalLoading(false);
              setProposalError('');

              const owner =
                resolved.match.owner;

              if (isAutoOwner(owner)) {
                if (
                  emergencyStoppedRef.current ||
                  !autoBotRunningRef.current
                ) {
                  lifecycleRef.current =
                    createTradeLifecycle();

                  syncLifecycleLabel();
                  return;
                }

                if (
                  accountTypeRef.current !==
                  'demo'
                ) {
                  stopAutoBot(
                    'Real account purchase blocked.'
                  );
                  return;
                }

                if (
                  contractOpenRef.current ||
                  buyPendingRef.current
                ) {
                  return;
                }

                const pendingPermission =
                  canOpenAfterPendingBuy(
                    pendingBuyRecoveryRef.current
                  );

                if (
                  !pendingPermission.allowed
                ) {
                  stopAutoBot(
                    pendingPermission.reason
                  );
                  return;
                }

                const askPrice =
                  Number(
                    data.proposal.ask_price
                  );

                if (
                  !data.proposal.id ||
                  !Number.isFinite(
                    askPrice
                  ) ||
                  askPrice <= 0
                ) {
                  stopAutoBot(
                    'Invalid proposal returned.'
                  );
                  return;
                }

                const buyReqId =
                  nextReqId();

                const registration =
                  beginBuyRequest(
                    requestGuardRef.current,
                    {
                      reqId:
                        buyReqId,

                      owner:
                        REQUEST_OWNER.AUTO,

                      proposalId:
                        data.proposal.id,
                    }
                  );

                if (
                  !registration.valid
                ) {
                  stopAutoBot(
                    registration.reason
                  );
                  return;
                }

                const pendingRegistration =
                  registerPendingBuy(
                    pendingBuyRecoveryRef.current,
                    {
                      reqId:
                        buyReqId,

                      proposalId:
                        data.proposal.id,

                      accountId:
                        accountIdRef.current,

                      accountType:
                        accountTypeRef.current,

                      owner:
                        'auto',

                      symbol:
                        symbolRef.current,

                      strategy:
                        strategyRef.current,

                      expectedStake:
                        askPrice,

                      startedAt:
                        Date.now(),
                    }
                  );

                if (
                  !pendingRegistration.valid
                ) {
                  stopAutoBot(
                    pendingRegistration.reason
                  );
                  return;
                }

                requestGuardRef.current =
                  registration.guard;

                pendingBuyRecoveryRef.current =
                  pendingRegistration.recovery;

                const persisted =
                  persistPendingBuyRecovery(
                    pendingRegistration.recovery
                  );

                if (!persisted.saved) {
                  stopAutoBot(
                    'Unable to persist pending BUY safety state.'
                  );
                  return;
                }

                pendingBuyReconciliationRef.current =
                  clearPendingBuyReconciliation();

                syncStoredPendingBuy();
                syncRequestStatus();
                syncPendingBuyRecovery();
                syncPendingBuyReconciliation();

                buyPendingRef.current =
                  true;

                setBuyLoading(true);

                setAutoBotStatus(
                  'Signal confirmed — buying demo contract...'
                );

                addBotLog(
                  `AUTO BUY sent | Strategy ${strategyRef.current} | Account ${accountIdRef.current} | Req #${buyReqId}`,
                  'trade'
                );

                ws.send(
                  JSON.stringify({
                    buy:
                      data.proposal.id,

                    price:
                      askPrice,

                    req_id:
                      buyReqId,
                  })
                );

                return;
              }

              const freshnessRegistration =
                registerProposalFreshness(
                  proposalFreshnessRef.current,
                  {
                    proposalId:
                      data.proposal.id,

                    createdAt:
                      Date.now(),
                  }
                );

              if (
                !freshnessRegistration.valid
              ) {
                clearManualProposal();

                setProposalError(
                  freshnessRegistration.reason
                );

                return;
              }

              proposalFreshnessRef.current =
                freshnessRegistration.freshness;

              setProposalData(
                data.proposal
              );

              setProposalClock(
                Date.now()
              );
            }

            if (
              data.msg_type ===
                'buy' &&
              data.buy
            ) {
              const resolved =
                resolveBuyRequest(
                  requestGuardRef.current,
                  data
                );

              if (
                !resolved.match.matched
              ) {
                addBotLog(
                  'Ignored unmatched BUY response.',
                  'error'
                );

                return;
              }

              const owner =
                resolved.match.owner;

              requestGuardRef.current =
                resolved.guard;

              syncRequestStatus();

              buyPendingRef.current =
                false;

              setBuyLoading(false);
              setBuyError('');

              const contractId =
                data.buy.contract_id;

              if (!contractId) {
                pendingBuyRecoveryRef.current =
                  markPendingBuyAmbiguous(
                    pendingBuyRecoveryRef.current
                  );

                persistPendingBuyRecovery(
                  pendingBuyRecoveryRef.current
                );

                syncStoredPendingBuy();
                syncPendingBuyRecovery();

                if (
                  isAutoOwner(owner)
                ) {
                  stopAutoBot(
                    'BUY returned without a contract ID. Purchase state is ambiguous.'
                  );
                }

                setTimeout(() => {
                  pendingReconciliationRunnerRef.current?.();
                }, 500);

                return;
              }

              clearStoredPendingBuy();

              pendingBuyRecoveryRef.current =
                clearPendingBuyRecovery();

              pendingBuyReconciliationRef.current =
                clearPendingBuyReconciliation();

              if (!isAutoOwner(owner)) {
                clearManualProposal();
              }

              if (
                isAutoOwner(owner) &&
                lifecycleRef.current
                  ?.mode !== 'auto'
              ) {
                lifecycleRef.current =
                  beginTradeLifecycle({
                    mode: 'auto',
                  });
              }

              if (
                !isAutoOwner(owner) &&
                lifecycleRef.current
                  ?.mode !== 'manual'
              ) {
                lifecycleRef.current =
                  beginTradeLifecycle({
                    mode: 'manual',
                  });
              }

              lifecycleRef.current =
                attachContractToLifecycle(
                  lifecycleRef.current,
                  contractId
                );

              syncLifecycleLabel();

              const recoveryRegistration =
                registerLiveContract(
                  recoveryRef.current,
                  {
                    contractId,

                    accountId:
                      accountIdRef.current,

                    owner:
                      isAutoOwner(owner)
                        ? 'auto'
                        : 'manual',
                  }
                );

              if (
                recoveryRegistration.valid
              ) {
                recoveryRef.current =
                  recoveryRegistration.recovery;

                recoveryBackoffRef.current =
                  resetRecoveryBackoff(
                    recoveryBackoffRef.current
                  );

                syncRecoveryLabel();
                syncRecoveryBackoff();

                if (
                  accountTypeRef.current ===
                  'demo'
                ) {
                  persistLiveContractRecovery(
                    {
                      contractId,

                      accountId:
                        accountIdRef.current,

                      accountType:
                        accountTypeRef.current,

                      owner:
                        isAutoOwner(owner)
                          ? 'auto'
                          : 'manual',

                      symbol:
                        symbolRef.current,

                      createdAt:
                        Date.now(),
                    }
                  );

                  syncPersistedRecovery();
                }
              }

              syncPendingBuyRecovery();
              syncPendingBuyReconciliation();

              contractOpenRef.current =
                true;

              setActiveContract({
                contractId,

                buyPrice:
                  data.buy.buy_price ??
                  data.buy.price ??
                  currentStakeRef.current,

                transactionId:
                  data.buy.transaction_id ??
                  null,

                isSold: false,
              });

              setContractProfit(0);

              setContractStatus('LIVE');

              setAutoBotStatus(
                `Contract #${contractId} active`
              );

              addBotLog(
                `${
                  isAutoOwner(owner)
                    ? 'AUTO'
                    : 'MANUAL'
                } demo contract purchased #${contractId} on ${accountIdRef.current}`,
                'success'
              );

              ws.send(
                JSON.stringify({
                  proposal_open_contract:
                    1,

                  contract_id:
                    contractId,

                  subscribe: 1,

                  req_id:
                    nextReqId(),
                })
              );
            }

            if (
              data.msg_type ===
                'proposal_open_contract' &&
              data.proposal_open_contract
            ) {
              const contract =
                data.proposal_open_contract;

              if (
                data.subscription?.id
              ) {
                contractSubscriptionRef.current =
                  data.subscription.id;

                recoveryRef.current =
                  attachRecoverySubscription(
                    recoveryRef.current,
                    data.subscription.id
                  );
              }

              const recoveryStatusBefore =
                getContractRecoveryStatus(
                  recoveryRef.current
                );

              if (
                recoveryStatusBefore.recovering
              ) {
                recoveryRef.current =
                  completeContractRecovery(
                    recoveryRef.current,
                    data.subscription?.id ||
                      null
                  );

                recoveryBackoffRef.current =
                  resetRecoveryBackoff(
                    recoveryBackoffRef.current
                  );

                clearRecoveryTimer();

                syncRecoveryLabel();
                syncRecoveryBackoff();
              }

              const profit =
                Number(
                  contract.profit ?? 0
                );

              const safeProfit =
                Number.isFinite(profit)
                  ? profit
                  : 0;

              setContractProfit(
                safeProfit
              );

              setActiveContract(
                (previous) => ({
                  ...(previous || {}),

                  contractId:
                    contract.contract_id,

                  contractType:
                    contract.contract_type,

                  currency:
                    contract.currency,

                  buyPrice:
                    contract.buy_price,

                  payout:
                    contract.payout,

                  entrySpot:
                    contract.entry_spot,

                  currentSpot:
                    contract.current_spot,

                  exitSpot:
                    contract.exit_spot,

                  isSold:
                    Boolean(
                      contract.is_sold
                    ),

                  status:
                    contract.status,
                })
              );

              if (!contract.is_sold) {
                contractOpenRef.current =
                  true;

                setContractStatus('LIVE');

                return;
              }

              contractOpenRef.current =
                false;

              clearRecoveryTimer();

              recoveryRef.current =
                markRecoveredContractSettled(
                  recoveryRef.current,
                  contract.contract_id
                );

              recoveryBackoffRef.current =
                resetRecoveryBackoff(
                  recoveryBackoffRef.current
                );

              clearContractRecoveryRecord();

              syncPersistedRecovery();
              syncRecoveryLabel();
              syncRecoveryBackoff();

              const finalStatus =
                contract.status ||
                (safeProfit > 0
                  ? 'won'
                  : safeProfit < 0
                  ? 'lost'
                  : 'settled');

              setContractStatus(
                String(
                  finalStatus
                ).toUpperCase()
              );

              if (
                contractSubscriptionRef.current
              ) {
                try {
                  ws.send(
                    JSON.stringify({
                      forget:
                        contractSubscriptionRef.current,
                    })
                  );
                } catch {}

                contractSubscriptionRef.current =
                  null;
              }

              const autoContract =
                isAutoTrade(
                  lifecycleRef.current,
                  contract.contract_id
                );

              if (autoContract) {
                handleAutoSettlement(
                  contract
                );

                return;
              }

              if (
                !shouldProcessSettlement(
                  lifecycleRef.current,
                  contract.contract_id
                )
              ) {
                return;
              }

              lifecycleRef.current =
                markLifecycleSettled(
                  lifecycleRef.current,
                  contract.contract_id
                );

              syncLifecycleLabel();

              const result =
                classifyTradeResult(
                  safeProfit
                );

              addBotLog(
                `Manual demo contract settled | ${
                  result.profit >= 0
                    ? '+'
                    : ''
                }${result.profit.toFixed(
                  2
                )}`,
                result.won
                  ? 'success'
                  : result.lost
                  ? 'error'
                  : 'system'
              );
            }
          } catch (error) {
            console.error(
              'Trading message error:',
              error
            );
          }
        };

        ws.onerror = () => {
          setIsTradingConnected(false);

          setSocketErrorLabel(
            'Trading socket connection error'
          );
        };

        ws.onclose = () => {
          if (tradingPingRef.current) {
            clearInterval(
              tradingPingRef.current
            );

            tradingPingRef.current = null;
          }

          setIsTradingConnected(false);

          const requestStatus =
            getRequestGuardStatus(
              requestGuardRef.current
            );

          const pendingStatus =
            getPendingBuyRecoveryStatus(
              pendingBuyRecoveryRef.current
            );

          if (
            requestStatus.buyPending ||
            pendingStatus.state ===
              'pending'
          ) {
            pendingBuyRecoveryRef.current =
              markPendingBuyAmbiguous(
                pendingBuyRecoveryRef.current
              );

            persistPendingBuyRecovery(
              pendingBuyRecoveryRef.current
            );

            syncStoredPendingBuy();
            syncPendingBuyRecovery();

            setBuyLoading(false);

            setAutoBotStatus(
              'BUY STATE AMBIGUOUS'
            );

            setBuyError(
              'Connection was lost after a BUY was sent. BinarySpot is checking the same demo account before allowing another purchase.'
            );

            addBotLog(
              `BUY #${
                requestStatus.buyReqId ||
                pendingStatus.reqId ||
                '?'
              } became ambiguous after WebSocket disconnect. Reconciliation queued.`,
              'error'
            );

            if (
              autoBotRunningRef.current
            ) {
              stopAutoBot(
                'BUY outcome unknown after socket disconnect.'
              );
            }

            setTimeout(() => {
              pendingReconciliationRunnerRef.current?.();
            }, 750);

            return;
          }

          const recoveryStatus =
            getContractRecoveryStatus(
              recoveryRef.current
            );

          if (
            contractOpenRef.current &&
            recoveryStatus.hasContract &&
            !recoveryStatus.settled
          ) {
            recoveryRef.current =
              markContractDisconnected(
                recoveryRef.current
              );

            syncRecoveryLabel();

            setContractStatus(
              'RECOVERY REQUIRED'
            );

            queueContractRecovery();
          }
        };
      },
      [
        addBotLog,
        clearManualProposal,
        clearRecoveryTimer,
        clearReconciliationRequests,
        clearStoredPendingBuy,
        finalizePendingBuyReconciliation,
        handleAutoSettlement,
        queueContractRecovery,
        stopAutoBot,
        syncLifecycleLabel,
        syncPendingBuyReconciliation,
        syncPendingBuyRecovery,
        syncPersistedRecovery,
        syncRecoveryBackoff,
        syncRecoveryLabel,
        syncRequestStatus,
        syncStoredPendingBuy,
      ]
    );

  connectTradingSocketRef.current =
    connectTradingSocket;

  pendingReconciliationRunnerRef.current =
    async () => {
      const pendingStatus =
        getPendingBuyRecoveryStatus(
          pendingBuyRecoveryRef.current
        );

      if (!pendingStatus.blocking) {
        return;
      }

      if (
        pendingReconciliationFetchRef.current
      ) {
        return;
      }

      if (
        pendingStatus.accountType !==
        'demo'
      ) {
        setBuyError(
          'Pending BUY reconciliation is restricted to demo accounts.'
        );

        return;
      }

      pendingReconciliationFetchRef.current =
        true;

      pendingBuyRecoveryRef.current =
        beginPendingBuyReconciliation(
          pendingBuyRecoveryRef.current
        );

      pendingBuyReconciliationRef.current =
        beginPendingBuyReconciliationSearch(
          clearPendingBuyReconciliation()
        );

      clearReconciliationRequests();

      syncPendingBuyRecovery();
      syncPendingBuyReconciliation();

      setBuyError('');

      setAutoBotStatus(
        'Reconciling uncertain BUY'
      );

      try {
        const response =
          await fetch(
            `/api/auth/deriv/session?account_id=${encodeURIComponent(
              pendingStatus.accountId
            )}`,
            {
              method: 'GET',

              credentials:
                'include',

              cache:
                'no-store',
            }
          );

        const data =
          await response.json();

        if (
          !response.ok ||
          !data.authenticated ||
          !data.account ||
          data.account.id !==
            pendingStatus.accountId ||
          data.account.type !==
            'demo' ||
          !data.wsUrl
        ) {
          throw new Error(
            'Unable to reconnect the correct demo account.'
          );
        }

        connectTradingSocketRef.current?.(
          data.wsUrl
        );
      } catch (error) {
        pendingReconciliationFetchRef.current =
          false;

        pendingBuyReconciliationRef.current =
          failPendingBuyReconciliation(
            pendingBuyReconciliationRef.current,
            error.message ||
              'Unable to reconcile the uncertain BUY.'
          );

        syncPendingBuyReconciliation();

        setBuyError(
          error.message ||
            'Unable to reconcile the uncertain BUY.'
        );
      }
    };

  recoveryRunnerRef.current =
    async () => {
      const status =
        getContractRecoveryStatus(
          recoveryRef.current
        );

      if (
        !status.hasContract ||
        status.settled ||
        !status.needsRecovery
      ) {
        return;
      }

      const permission =
        canAttemptRecovery(
          recoveryBackoffRef.current
        );

      if (!permission.allowed) {
        setContractStatus(
          'RECOVERY PAUSED'
        );

        syncRecoveryBackoff();

        return;
      }

      if (
        recoveryFetchRunningRef.current
      ) {
        return;
      }

      recoveryFetchRunningRef.current =
        true;

      try {
        const response =
          await fetch(
            `/api/auth/deriv/session?account_id=${encodeURIComponent(
              status.accountId
            )}`,
            {
              method: 'GET',

              credentials:
                'include',

              cache:
                'no-store',
            }
          );

        const data =
          await response.json();

        if (
          !response.ok ||
          !data.authenticated ||
          !data.wsUrl
        ) {
          throw new Error(
            'Recovery session unavailable.'
          );
        }

        connectTradingSocketRef.current?.(
          data.wsUrl
        );
      } catch (error) {
        recoveryFetchRunningRef.current =
          false;

        registerRecoveryFailure(
          error.message
        );
      }
    };

  const retryPendingBuyReconciliation =
    () => {
      pendingReconciliationFetchRef.current =
        false;

      pendingBuyReconciliationRef.current =
        clearPendingBuyReconciliation();

      clearReconciliationRequests();

      syncPendingBuyReconciliation();

      pendingReconciliationRunnerRef.current?.();
    };

  const loadDerivSession =
    useCallback(
      async (
        requestedAccountId = ''
      ) => {
        try {
          setSessionPersistenceReady(
            false
          );

          setIsLoading(true);
          setAuthError('');

          let endpoint =
            '/api/auth/deriv/session';

          if (requestedAccountId) {
            endpoint +=
              `?account_id=${encodeURIComponent(
                requestedAccountId
              )}`;
          }

          const response =
            await fetch(
              endpoint,
              {
                method: 'GET',

                credentials:
                  'include',

                cache:
                  'no-store',
              }
            );

          let data = null;

          try {
            data =
              await response.json();
          } catch {
            data = null;
          }

          if (
            !response.ok ||
            !data?.authenticated
          ) {
            closeTradingSocket();

            setIsAuthorized(false);

            setAccounts([]);

            setSelectedAccountId(
              ''
            );

            setAccountId('');

            accountIdRef.current =
              '';

            setAccountType('');

            accountTypeRef.current =
              '';

            setBalance(null);

            setCurrency('USD');

            currencyRef.current =
              'USD';

            if (
              response.status !==
                401 &&
              data?.error
            ) {
              setAuthError(
                data.error
              );
            }

            return;
          }

          setIsAuthorized(true);

          const availableAccounts =
            Array.isArray(
              data.accounts
            )
              ? data.accounts
              : [];

          setAccounts(
            availableAccounts
          );

          if (!data.account) {
            closeTradingSocket();

            setAuthError(
              'No Deriv Options account was found.'
            );

            return;
          }

          const nextAccountId =
            data.account.id || '';

          const nextAccountType =
            String(
              data.account.type || ''
            ).toLowerCase();

          const nextCurrency =
            data.account.currency ||
            'USD';

          setAccountId(
            nextAccountId
          );

          accountIdRef.current =
            nextAccountId;

          setSelectedAccountId(
            nextAccountId
          );

          setAccountType(
            nextAccountType
          );

          accountTypeRef.current =
            nextAccountType;

          setBalance(
            data.account.balance ??
              null
          );

          setCurrency(
            nextCurrency
          );

          currencyRef.current =
            nextCurrency;

          autoBotRunningRef.current =
            false;

          setIsAutoBotRunning(
            false
          );

          emergencyStoppedRef.current =
            false;

          setEmergencyStopped(
            false
          );

          proposalPendingRef.current =
            false;

          buyPendingRef.current =
            false;

          contractOpenRef.current =
            false;

          cooldownUntilRef.current =
            0;

          lifecycleRef.current =
            createTradeLifecycle();

          requestGuardRef.current =
            resetRequestGuard();

          pendingBuyRecoveryRef.current =
            clearPendingBuyRecovery();

          pendingBuyReconciliationRef.current =
            clearPendingBuyReconciliation();

          pendingReconciliationFetchRef.current =
            false;

          clearReconciliationRequests();

          recoveryRef.current =
            clearContractRecovery();

          recoveryBackoffRef.current =
            resetRecoveryBackoff(
              recoveryBackoffRef.current
            );

          proposalFreshnessRef.current =
            clearProposalFreshness();

          recoveryFetchRunningRef.current =
            false;

          clearRecoveryTimer();

          setProposalData(null);

          setProposalClock(
            Date.now()
          );

          setProposalError('');
          setBuyError('');

          setActiveContract(null);

          setContractProfit(null);

          setContractStatus(
            'No active contract'
          );

          setAutoBotStatus(
            nextAccountType ===
              'demo'
              ? 'Standby'
              : 'Real account selected — execution blocked'
          );

          const storedSession =
            loadSessionState();

          if (
            storedSession.found &&
            !storedSession.valid
          ) {
            clearSessionState();

            setStoredSessionLabel(
              'No stored session'
            );
          }

          if (
            storedSession.found &&
            storedSession.valid &&
            storedSession.state
          ) {
            const restorePermission =
              canRestoreSessionState(
                storedSession.state,
                {
                  accountId:
                    nextAccountId,

                  accountType:
                    nextAccountType,
                }
              );

            if (
              restorePermission.allowed
            ) {
              const restored =
                buildRestoredSessionState(
                  restorePermission.state
                );

              if (
                restored.valid &&
                restored.state
              ) {
                const state =
                  restored.state;

                setSymbol(
                  state.symbol
                );

                symbolRef.current =
                  state.symbol;

                setStrategy(
                  state.strategy
                );

                strategyRef.current =
                  state.strategy;

                setPredictionDigit(
                  state.predictionDigit
                );

                predictionDigitRef.current =
                  state.predictionDigit;

                setBaseStake(
                  String(
                    state.baseStake
                  )
                );

                baseStakeRef.current =
                  state.baseStake;

                setCurrentStake(
                  Number(
                    state.currentStake
                  ).toFixed(2)
                );

                currentStakeRef.current =
                  state.currentStake;

                setMartingale(
                  String(
                    state.martingale
                  )
                );

                martingaleRef.current =
                  state.martingale;

                setTakeProfit(
                  String(
                    state.takeProfit
                  )
                );

                takeProfitRef.current =
                  state.takeProfit;

                setStopLoss(
                  String(
                    state.stopLoss
                  )
                );

                stopLossRef.current =
                  state.stopLoss;

                setMaxConsecutiveLosses(
                  String(
                    state.maxConsecutiveLosses
                  )
                );

                maxLossesRef.current =
                  state.maxConsecutiveLosses;

                setMaxStake(
                  String(
                    state.maxStake
                  )
                );

                maxStakeRef.current =
                  state.maxStake;

                setMaxTrades(
                  String(
                    state.maxTrades
                  )
                );

                maxTradesRef.current =
                  state.maxTrades;

                setCooldownSeconds(
                  String(
                    state.cooldownSeconds
                  )
                );

                cooldownSecondsRef.current =
                  state.cooldownSeconds;

                setMinimumConfidence(
                  String(
                    state.minimumConfidence
                  )
                );

                minimumConfidenceRef.current =
                  state.minimumConfidence;

                setDuration(
                  String(
                    state.duration
                  )
                );

                durationRef.current =
                  state.duration;

                setTotalProfit(
                  state.totalProfit
                );

                totalProfitRef.current =
                  state.totalProfit;

                setTradeCount(
                  state.tradeCount
                );

                tradeCountRef.current =
                  state.tradeCount;

                setWinCount(
                  state.winCount
                );

                setLossCount(
                  state.lossCount
                );

                setDrawCount(
                  state.drawCount
                );

                setConsecutiveLosses(
                  state.consecutiveLosses
                );

                consecutiveLossesRef.current =
                  state.consecutiveLosses;

                setTradeHistory(
                  state.tradeHistory
                );

                setAutoBotStatus(
                  'Standby — Session Restored'
                );

                const sessionStatus =
                  getSessionStateStatus(
                    state
                  );

                setStoredSessionLabel(
                  sessionStatus.label
                );

                addBotLog(
                  'Stored demo session restored. Automated trading was not resumed.',
                  'system'
                );
              }
            }
          }

          let restoredPending =
            false;

          const storedPending =
            loadPendingBuyRecoveryRecord();

          if (
            storedPending.found &&
            !storedPending.valid
          ) {
            clearStoredPendingBuy();
          }

          if (
            storedPending.found &&
            storedPending.valid &&
            storedPending.record
          ) {
            const restorePermission =
              canRestoreStoredPendingBuy(
                storedPending.record,
                {
                  accountId:
                    nextAccountId,

                  accountType:
                    nextAccountType,
                }
              );

            if (
              restorePermission.allowed
            ) {
              const record =
                restorePermission.record;

              const registration =
                registerPendingBuy(
                  createPendingBuyRecovery(),
                  {
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
                  }
                );

              if (
                registration.valid
              ) {
                pendingBuyRecoveryRef.current =
                  markPendingBuyAmbiguous(
                    registration.recovery,
                    record.disconnectedAt ||
                      Date.now()
                  );

                pendingBuyReconciliationRef.current =
                  beginPendingBuyReconciliationSearch(
                    createPendingBuyReconciliation()
                  );

                restoredPending =
                  true;

                if (record.symbol) {
                  symbolRef.current =
                    record.symbol;

                  setSymbol(
                    record.symbol
                  );
                }

                setBuyError(
                  'Stored uncertain BUY restored. BinarySpot is reconciling before allowing another entry.'
                );

                setAutoBotStatus(
                  'Refresh BUY reconciliation'
                );

                addBotLog(
                  `Restored pending BUY #${record.reqId} after refresh.`,
                  'system'
                );
              }
            }
          }

          if (!restoredPending) {
            const stored =
              loadContractRecoveryRecord();

            if (
              stored.found &&
              stored.valid &&
              stored.record
            ) {
              const restorePermission =
                canRestoreStoredContract(
                  stored.record,
                  {
                    accountId:
                      nextAccountId,

                    accountType:
                      nextAccountType,
                  }
                );

              if (
                restorePermission.allowed
              ) {
                const record =
                  restorePermission.record;

                const registration =
                  registerLiveContract(
                    createContractRecovery(),
                    {
                      contractId:
                        record.contractId,

                      accountId:
                        record.accountId,

                      owner:
                        record.owner,
                    }
                  );

                if (
                  registration.valid
                ) {
                  recoveryRef.current =
                    markContractDisconnected(
                      registration.recovery
                    );

                  contractOpenRef.current =
                    true;

                  setActiveContract({
                    contractId:
                      record.contractId,

                    isSold:
                      false,
                  });

                  setContractStatus(
                    'RECOVERY REQUIRED'
                  );

                  if (record.symbol) {
                    symbolRef.current =
                      record.symbol;

                    setSymbol(
                      record.symbol
                    );
                  }

                  lifecycleRef.current =
                    beginTradeLifecycle({
                      mode:
                        record.owner ===
                        'auto'
                          ? 'auto'
                          : 'manual',
                    });

                  lifecycleRef.current =
                    attachContractToLifecycle(
                      lifecycleRef.current,
                      record.contractId
                    );

                  setAutoBotStatus(
                    'Persisted contract recovery'
                  );
                }
              }
            }
          }

          syncLifecycleLabel();
          syncRequestStatus();
          syncPendingBuyRecovery();
          syncPendingBuyReconciliation();
          syncStoredPendingBuy();
          syncRecoveryBackoff();
          syncRecoveryLabel();
          syncPersistedRecovery();
          syncStoredSession();

          setSocketErrorLabel(
            'No socket errors'
          );

          setSessionPersistenceReady(
            true
          );

          if (data.wsUrl) {
            connectTradingSocket(
              data.wsUrl
            );
          } else {
            setIsTradingConnected(
              false
            );

            setAuthError(
              data.error ||
                'Deriv account loaded, but the authenticated trading connection is unavailable.'
            );
          }
        } catch (error) {
          console.error(error);

          closeTradingSocket();

          setAuthError(
            error?.message ||
              'Unable to load your Deriv account.'
          );
        } finally {
          setIsLoading(false);

          setIsConnecting(
            false
          );
        }
      },
      [
        addBotLog,
        clearRecoveryTimer,
        clearReconciliationRequests,
        clearStoredPendingBuy,
        closeTradingSocket,
        connectTradingSocket,
        syncLifecycleLabel,
        syncPendingBuyReconciliation,
        syncPendingBuyRecovery,
        syncPersistedRecovery,
        syncRecoveryBackoff,
        syncRecoveryLabel,
        syncRequestStatus,
        syncStoredPendingBuy,
        syncStoredSession,
      ]
    );

  useEffect(() => {
    const params =
      new URLSearchParams(
        window.location.search
      );

    const derivError =
      params.get(
        'deriv_error'
      );

    const derivConnected =
      params.get(
        'deriv_connected'
      );

    if (derivError) {
      setAuthError(
        derivError
      );
    }

    if (
      derivError ||
      derivConnected === '1'
    ) {
      window.history.replaceState(
        {},
        '',
        window.location.pathname
      );
    }

    syncPersistedRecovery();
    syncStoredPendingBuy();
    syncPendingBuyRecovery();
    syncPendingBuyReconciliation();
    syncStoredSession();

    loadDerivSession();

    return () => {
      clearRecoveryTimer();
      closeTradingSocket();
    };
  }, [
    clearRecoveryTimer,
    closeTradingSocket,
    loadDerivSession,
    syncPendingBuyReconciliation,
    syncPendingBuyRecovery,
    syncPersistedRecovery,
    syncStoredPendingBuy,
    syncStoredSession,
  ]);

  const switchAccount =
    async (
      newAccountId
    ) => {
      if (
        !newAccountId ||
        newAccountId ===
          selectedAccountId ||
        isLoading ||
        isLoggingOut
      ) {
        return;
      }

      const requestStatus =
        getRequestGuardStatus(
          requestGuardRef.current
        );

      const recoveryStatus =
        getContractRecoveryStatus(
          recoveryRef.current
        );

      const pendingPermission =
        canOpenAfterPendingBuy(
          pendingBuyRecoveryRef.current
        );

      if (
        contractOpenRef.current ||
        requestStatus.buyPending ||
        !pendingPermission.allowed ||
        (
          recoveryStatus.hasContract &&
          !recoveryStatus.settled
        )
      ) {
        setAuthError(
          'Resolve the active, recovering, or uncertain BUY before switching accounts.'
        );

        return;
      }

      try {
        setAuthError('');

        if (
          autoBotRunningRef.current
        ) {
          stopAutoBot(
            'Switching Deriv account'
          );
        }

        clearManualProposal();

        setSessionPersistenceReady(
          false
        );

        setSelectedAccountId(
          newAccountId
        );

        setBalance(null);

        setAutoBotStatus(
          'Switching Deriv account'
        );

        addBotLog(
          `Switching Deriv account to ${newAccountId}.`,
          'system'
        );

        closeTradingSocket();

        await loadDerivSession(
          newAccountId
        );
      } catch (error) {
        console.error(
          'Account switch error:',
          error
        );

        setAuthError(
          error?.message ||
            'Unable to switch Deriv accounts.'
        );
      }
    };

  const logoutDeriv =
    async () => {
      if (
        isLoggingOut ||
        isLoading
      ) {
        return;
      }

      const requestStatus =
        getRequestGuardStatus(
          requestGuardRef.current
        );

      const recoveryStatus =
        getContractRecoveryStatus(
          recoveryRef.current
        );

      const pendingStatus =
        getPendingBuyRecoveryStatus(
          pendingBuyRecoveryRef.current
        );

      if (
        contractOpenRef.current ||
        requestStatus.buyPending ||
        pendingStatus.blocking ||
        (
          recoveryStatus.hasContract &&
          !recoveryStatus.settled
        )
      ) {
        setAuthError(
          'Resolve the active, recovering, or uncertain BUY before logging out of Deriv.'
        );

        return;
      }

      try {
        setIsLoggingOut(true);
        setAuthError('');

        if (
          autoBotRunningRef.current
        ) {
          stopAutoBot(
            'Deriv logout'
          );
        }

        clearManualProposal();
        closeTradingSocket();

        const response =
          await fetch(
            '/api/auth/deriv/logout',
            {
              method: 'POST',

              credentials:
                'include',

              cache:
                'no-store',
            }
          );

        let data = null;

        try {
          data =
            await response.json();
        } catch {
          data = null;
        }

        if (!response.ok) {
          throw new Error(
            data?.error ||
              'Unable to log out of Deriv.'
          );
        }

        clearSessionState();
        clearContractRecoveryRecord();
        clearPendingBuyRecoveryRecord();

        sessionStorage.removeItem(
          'deriv_pkce_verifier'
        );

        sessionStorage.removeItem(
          'deriv_oauth_state'
        );

        autoBotRunningRef.current =
          false;

        emergencyStoppedRef.current =
          false;

        proposalPendingRef.current =
          false;

        buyPendingRef.current =
          false;

        contractOpenRef.current =
          false;

        cooldownUntilRef.current =
          0;

        accountIdRef.current =
          '';

        accountTypeRef.current =
          '';

        currencyRef.current =
          'USD';

        lifecycleRef.current =
          createTradeLifecycle();

        requestGuardRef.current =
          resetRequestGuard();

        pendingBuyRecoveryRef.current =
          clearPendingBuyRecovery();

        pendingBuyReconciliationRef.current =
          clearPendingBuyReconciliation();

        recoveryRef.current =
          clearContractRecovery();

        recoveryBackoffRef.current =
          resetRecoveryBackoff(
            recoveryBackoffRef.current
          );

        proposalFreshnessRef.current =
          clearProposalFreshness();

        clearReconciliationRequests();
        clearRecoveryTimer();

        setIsAuthorized(false);
        setIsTradingConnected(false);

        setAccounts([]);
        setSelectedAccountId('');
        setAccountId('');
        setAccountType('');

        setBalance(null);
        setCurrency('USD');

        setIsAutoBotRunning(false);
        setEmergencyStopped(false);

        setProposalLoading(false);
        setBuyLoading(false);

        setProposalData(null);

        setProposalClock(
          Date.now()
        );

        setProposalError('');
        setBuyError('');

        setActiveContract(null);
        setContractProfit(null);

        setContractStatus(
          'No active contract'
        );

        setAutoBotStatus(
          'Deriv disconnected'
        );

        setStoredSessionLabel(
          'No stored session'
        );

        setPersistedRecoveryLabel(
          'No persisted contract'
        );

        setPendingBuyLabel(
          'No pending BUY ambiguity'
        );

        setPersistedPendingBuyLabel(
          'No stored BUY ambiguity'
        );

        setReconciliationLabel(
          'Reconciliation idle'
        );

        setReconciliationReason('');

        setReconciliationRunning(
          false
        );

        setSocketErrorLabel(
          'No socket errors'
        );

        setSessionPersistenceReady(
          false
        );

        syncLifecycleLabel();
        syncRequestStatus();
        syncPendingBuyRecovery();
        syncPendingBuyReconciliation();
        syncRecoveryLabel();
        syncRecoveryBackoff();

        addBotLog(
          'Deriv OAuth session disconnected.',
          'system'
        );
      } catch (error) {
        console.error(
          'Deriv logout error:',
          error
        );

        setAuthError(
          error?.message ||
            'Unable to log out of Deriv.'
        );
      } finally {
        setIsLoggingOut(
          false
        );
      }
    };

  useEffect(() => {
    let ws;

    try {
      ws =
        new WebSocket(
          PUBLIC_WS_URL
        );

      publicWsRef.current =
        ws;

      ws.onopen = () => {
        setIsMarketConnected(
          true
        );

        ws.send(
          JSON.stringify({
            ticks:
              symbol,

            subscribe:
              1,
          })
        );

        publicPingRef.current =
          setInterval(() => {
            if (
              ws.readyState ===
              WebSocket.OPEN
            ) {
              ws.send(
                JSON.stringify({
                  ping: 1,
                })
              );
            }
          }, 30000);
      };

      ws.onmessage = (
        event
      ) => {
        try {
          const data =
            JSON.parse(
              event.data
            );

          if (data.error) {
            return;
          }

          if (
            data.msg_type ===
              'tick' &&
            data.tick
          ) {
            const precisionResult =
              applyCachedPipSize(
                pipSizeCacheRef.current,
                data.tick
              );

            pipSizeCacheRef.current =
              precisionResult.cache;

            const normalizedTick =
              normalizeDerivTick(
                precisionResult.tick
              );

            if (
              !normalizedTick.valid
            ) {
              return;
            }

            setLastTick(
              (
                previous
              ) => {
                setPrevTick(
                  previous
                );

                return normalizedTick.quote;
              }
            );

            setFormattedTick(
              normalizedTick.formattedQuote ||
                String(
                  normalizedTick.quote
                )
            );

            setPipSize(
              normalizedTick.pipSize
            );

            setPipSource(
              precisionResult.source
            );

            setUsedPipSize(
              normalizedTick.pipSize !==
                null
            );

            setLastDigit(
              normalizedTick.lastDigit
            );

            const updatedHistory =
              prependDigitToHistory(
                digitHistoryRef.current,
                normalizedTick.lastDigit,
                150
              );

            digitHistoryRef.current =
              updatedHistory;

            setDigitHistory(
              updatedHistory
            );

            evaluateAutoEntry(
              updatedHistory
            );
          }
        } catch {}
      };

      ws.onerror = () => {
        setIsMarketConnected(
          false
        );
      };

      ws.onclose = () => {
        setIsMarketConnected(
          false
        );
      };
    } catch {
      setIsMarketConnected(
        false
      );
    }

    return () => {
      if (
        publicPingRef.current
      ) {
        clearInterval(
          publicPingRef.current
        );

        publicPingRef.current =
          null;
      }

      if (ws) {
        try {
          ws.onclose =
            null;

          ws.close();
        } catch {}
      }
    };
  }, [
    evaluateAutoEntry,
    symbol,
  ]);

  useEffect(() => {
    setSignal(
      evaluateEntrySignal({
        strategy,

        digitHistory:
          digitHistoryRef.current,

        predictionDigit,

        config: {
          minimumConfidence:
            Number(
              minimumConfidence
            ) || 62,
        },
      })
    );
  }, [
    strategy,
    predictionDigit,
    minimumConfidence,
  ]);

  const connectDeriv =
    async () => {
      try {
        setAuthError('');

        setIsConnecting(
          true
        );

        const chars =
          'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';

        const bytes =
          new Uint8Array(
            64
          );

        crypto.getRandomValues(
          bytes
        );

        const verifier =
          Array.from(bytes)
            .map(
              (byte) =>
                chars[
                  byte %
                    chars.length
                ]
            )
            .join('');

        const digest =
          await crypto.subtle.digest(
            'SHA-256',
            new TextEncoder().encode(
              verifier
            )
          );

        const challenge =
          btoa(
            String.fromCharCode(
              ...new Uint8Array(
                digest
              )
            )
          )
            .replace(
              /\+/g,
              '-'
            )
            .replace(
              /\//g,
              '_'
            )
            .replace(
              /=+$/,
              ''
            );

        const stateBytes =
          new Uint8Array(
            16
          );

        crypto.getRandomValues(
          stateBytes
        );

        const state =
          Array.from(
            stateBytes
          )
            .map(
              (byte) =>
                byte
                  .toString(16)
                  .padStart(
                    2,
                    '0'
                  )
            )
            .join('');

        sessionStorage.setItem(
          'deriv_pkce_verifier',
          verifier
        );

        sessionStorage.setItem(
          'deriv_oauth_state',
          state
        );

        const authUrl =
          new URL(
            'https://auth.deriv.com/oauth2/auth'
          );

        authUrl.searchParams.set(
          'response_type',
          'code'
        );

        authUrl.searchParams.set(
          'client_id',
          CLIENT_ID
        );

        authUrl.searchParams.set(
          'redirect_uri',
          REDIRECT_URI
        );

        authUrl.searchParams.set(
          'scope',
          'trade account_manage'
        );

        authUrl.searchParams.set(
          'state',
          state
        );

        authUrl.searchParams.set(
          'code_challenge',
          challenge
        );

        authUrl.searchParams.set(
          'code_challenge_method',
          'S256'
        );

        window.location.assign(
          authUrl.toString()
        );
      } catch {
        setIsConnecting(
          false
        );

        setAuthError(
          'Unable to open Deriv authorization.'
        );
      }
    };

  const startAutoBot = () => {
    const pendingPermission =
      canOpenAfterPendingBuy(
        pendingBuyRecoveryRef.current
      );

    if (!pendingPermission.allowed) {
      setBuyError(
        pendingPermission.reason
      );

      return;
    }

    const recoveryStatus =
      getContractRecoveryStatus(
        recoveryRef.current
      );

    if (
      recoveryStatus.hasContract &&
      !recoveryStatus.settled
    ) {
      setBuyError(
        'Wait for the active or recovering contract to settle.'
      );

      return;
    }

    const requestPermission =
      canStartNewBotSession(
        requestGuardRef.current
      );

    if (!requestPermission.allowed) {
      setBuyError(
        requestPermission.reason
      );

      return;
    }

    const validation =
      validateBotSettings({
        accountType:
          accountTypeRef.current,

        baseStake,

        maxStake,

        martingale,

        takeProfit,

        stopLoss,

        maxTrades,

        maxConsecutiveLosses,

        cooldownSeconds,

        minimumConfidence,
      });

    if (!validation.valid) {
      setBuyError(
        validation.reason
      );

      return;
    }

    if (
      accountTypeRef.current !==
      'demo'
    ) {
      setBuyError(
        'Real-money bot execution is currently blocked. Switch to a Demo account to run Bot Studio.'
      );

      return;
    }

    if (
      emergencyStoppedRef.current
    ) {
      setBuyError(
        'Clear Emergency Stop before starting.'
      );

      return;
    }

    if (!isTradingConnected) {
      setBuyError(
        'Trading socket is not connected.'
      );

      return;
    }

    clearManualProposal();

    const startingStake =
      Number(
        baseStake
      );

    setBuyError('');
    setProposalError('');

    tradeCountRef.current =
      0;

    totalProfitRef.current =
      0;

    consecutiveLossesRef.current =
      0;

    setTradeCount(0);
    setWinCount(0);
    setLossCount(0);
    setDrawCount(0);
    setConsecutiveLosses(0);
    setTotalProfit(0);
    setTradeHistory([]);

    currentStakeRef.current =
      startingStake;

    setCurrentStake(
      startingStake.toFixed(
        2
      )
    );

    cooldownUntilRef.current =
      0;

    lifecycleRef.current =
      createTradeLifecycle();

    recoveryRef.current =
      clearContractRecovery();

    recoveryBackoffRef.current =
      resetRecoveryBackoff(
        recoveryBackoffRef.current
      );

    syncLifecycleLabel();
    syncRecoveryLabel();
    syncPendingBuyRecovery();
    syncPendingBuyReconciliation();
    syncRecoveryBackoff();
    syncRequestStatus();

    setSocketErrorLabel(
      'No socket errors'
    );

    autoBotRunningRef.current =
      true;

    setIsAutoBotRunning(
      true
    );

    const selected =
      getStrategyById(
        strategy
      );

    setAutoBotStatus(
      `Scanning — ${
        selected?.name ||
        strategy
      }`
    );

    addBotLog(
      `BOT STARTED | ${
        selected?.name ||
        strategy
      } | ${symbol} | Account ${accountIdRef.current} | Minimum confidence ${minimumConfidence}%`,
      'system'
    );

    const initialSignal =
      evaluateEntrySignal({
        strategy,

        digitHistory:
          digitHistoryRef.current,

        predictionDigit,

        config: {
          minimumConfidence:
            Number(
              minimumConfidence
            ) || 62,
        },
      });

    setSignal(
      initialSignal
    );

    if (
      initialSignal.shouldTrade &&
      Number(
        initialSignal.confidence
      ) >=
        Number(
          minimumConfidence
        )
    ) {
      requestAutoProposal(
        initialSignal
      );
    }
  };

  const requestManualProposal =
    () => {
      const pendingPermission =
        canOpenAfterPendingBuy(
          pendingBuyRecoveryRef.current
        );

      if (!pendingPermission.allowed) {
        setProposalError(
          pendingPermission.reason
        );

        return;
      }

      const recoveryStatus =
        getContractRecoveryStatus(
          recoveryRef.current
        );

      if (
        recoveryStatus.hasContract &&
        !recoveryStatus.settled
      ) {
        setProposalError(
          'Wait for the active or recovering contract to settle.'
        );

        return;
      }

      const requestPermission =
        canStartNewBotSession(
          requestGuardRef.current
        );

      if (!requestPermission.allowed) {
        setProposalError(
          requestPermission.reason
        );

        return;
      }

      if (
        emergencyStoppedRef.current
      ) {
        setProposalError(
          'Emergency Stop is active.'
        );

        return;
      }

      if (
        accountTypeRef.current !==
        'demo'
      ) {
        setProposalError(
          'Real-money execution is currently blocked. Switch to a Demo account to request a tradable proposal.'
        );

        return;
      }

      const ws =
        tradingWsRef.current;

      if (
        !ws ||
        ws.readyState !==
          WebSocket.OPEN
      ) {
        setProposalError(
          'Trading socket is not ready.'
        );

        return;
      }

      try {
        clearManualProposal();

        lifecycleRef.current =
          beginTradeLifecycle({
            mode: 'manual',
          });

        syncLifecycleLabel();

        let executionSignal =
          null;

        if (
          isAdvancedStrategy(
            strategyRef.current
          )
        ) {
          executionSignal =
            evaluateEntrySignal({
              strategy:
                strategyRef.current,

              digitHistory:
                digitHistoryRef.current,

              predictionDigit:
                predictionDigitRef.current,

              config: {
                minimumConfidence:
                  minimumConfidenceRef.current,
              },
            });

          setSignal(
            executionSignal
          );

          if (
            !executionSignal.shouldTrade
          ) {
            throw new Error(
              `Advanced strategy has no qualified execution signal yet: ${executionSignal.reason}`
            );
          }

          if (
            Number(
              executionSignal.confidence
            ) <
            minimumConfidenceRef.current
          ) {
            throw new Error(
              `Signal confidence ${Number(
                executionSignal.confidence
              ).toFixed(
                1
              )}% is below your minimum ${minimumConfidenceRef.current}%.`
            );
          }
        }

        const payload =
          buildProposalPayload(
            Number(baseStake),
            executionSignal
          );

        const registration =
          beginProposalRequest(
            requestGuardRef.current,
            {
              reqId:
                payload.req_id,

              owner:
                REQUEST_OWNER.MANUAL,
            }
          );

        if (!registration.valid) {
          throw new Error(
            registration.reason
          );
        }

        requestGuardRef.current =
          registration.guard;

        syncRequestStatus();

        proposalPendingRef.current =
          true;

        setProposalLoading(true);
        setProposalError('');
        setBuyError('');

        ws.send(
          JSON.stringify(
            payload
          )
        );
      } catch (error) {
        requestGuardRef.current =
          invalidateBotGeneration(
            requestGuardRef.current
          );

        syncRequestStatus();

        lifecycleRef.current =
          createTradeLifecycle();

        syncLifecycleLabel();

        proposalPendingRef.current =
          false;

        setProposalLoading(false);

        clearManualProposal();

        setProposalError(
          error.message
        );
      }
    };

  const buyManualDemoProposal =
    () => {
      const pendingPermission =
        canOpenAfterPendingBuy(
          pendingBuyRecoveryRef.current
        );

      if (!pendingPermission.allowed) {
        setBuyError(
          pendingPermission.reason
        );

        return;
      }

      if (
        emergencyStoppedRef.current
      ) {
        setBuyError(
          'Emergency Stop is active.'
        );

        return;
      }

      if (
        accountTypeRef.current !==
        'demo'
      ) {
        setBuyError(
          'Real-money purchases are blocked.'
        );

        return;
      }

      if (!proposalData?.id) {
        setBuyError(
          'Get a proposal first.'
        );

        return;
      }

      const freshnessPermission =
        canBuyFreshProposal(
          proposalFreshnessRef.current,
          {
            proposalId:
              proposalData.id,

            now:
              Date.now(),
          }
        );

      if (
        !freshnessPermission.allowed
      ) {
        setBuyError(
          freshnessPermission.reason
        );

        return;
      }

      if (
        contractOpenRef.current
      ) {
        setBuyError(
          'An active contract already exists.'
        );

        return;
      }

      const price =
        Number(
          proposalData.ask_price
        );

      if (
        !Number.isFinite(
          price
        ) ||
        price <= 0
      ) {
        setBuyError(
          'Invalid proposal price.'
        );

        return;
      }

      const ws =
        tradingWsRef.current;

      if (
        !ws ||
        ws.readyState !==
          WebSocket.OPEN
      ) {
        setBuyError(
          'Trading socket is offline.'
        );

        return;
      }

      if (
        lifecycleRef.current
          ?.mode !==
        'manual'
      ) {
        lifecycleRef.current =
          beginTradeLifecycle({
            mode:
              'manual',
          });

        syncLifecycleLabel();
      }

      const buyReqId =
        nextReqId();

      const registration =
        beginBuyRequest(
          requestGuardRef.current,
          {
            reqId:
              buyReqId,

            owner:
              REQUEST_OWNER.MANUAL,

            proposalId:
              proposalData.id,
          }
        );

      if (!registration.valid) {
        setBuyError(
          registration.reason
        );

        return;
      }

      const pendingRegistration =
        registerPendingBuy(
          pendingBuyRecoveryRef.current,
          {
            reqId:
              buyReqId,

            proposalId:
              proposalData.id,

            accountId:
              accountIdRef.current,

            accountType:
              accountTypeRef.current,

            owner:
              'manual',

            symbol:
              symbolRef.current,

            strategy:
              strategyRef.current,

            expectedStake:
              price,

            startedAt:
              Date.now(),
          }
        );

      if (
        !pendingRegistration.valid
      ) {
        setBuyError(
          pendingRegistration.reason
        );

        return;
      }

      requestGuardRef.current =
        registration.guard;

      pendingBuyRecoveryRef.current =
        pendingRegistration.recovery;

      const persisted =
        persistPendingBuyRecovery(
          pendingRegistration.recovery
        );

      if (!persisted.saved) {
        setBuyError(
          'Unable to persist pending BUY safety state.'
        );

        return;
      }

      pendingBuyReconciliationRef.current =
        clearPendingBuyReconciliation();

      syncStoredPendingBuy();
      syncRequestStatus();
      syncPendingBuyRecovery();
      syncPendingBuyReconciliation();

      buyPendingRef.current =
        true;

      setBuyLoading(true);
      setBuyError('');

      ws.send(
        JSON.stringify({
          buy:
            proposalData.id,

          price,

          req_id:
            buyReqId,
        })
      );
    };

  const applySuggestedDigit =
    () => {
      const suggestion =
        getSuggestedDigit(
          strategy,
          digitHistoryRef.current
        );

      setPredictionDigit(
        String(
          suggestion
        )
      );
    };

  const changeSymbol = (
    nextSymbol
  ) => {
    const pendingPermission =
      canOpenAfterPendingBuy(
        pendingBuyRecoveryRef.current
      );

    if (!pendingPermission.allowed) {
      setBuyError(
        pendingPermission.reason
      );

      return;
    }

    if (!nextSymbol) {
      return;
    }

    clearManualProposal();

    symbolRef.current =
      nextSymbol;

    setSymbol(
      nextSymbol
    );

    digitHistoryRef.current =
      [];

    setDigitHistory([]);

    setLastDigit(null);
    setLastTick(null);
    setPrevTick(null);

    setFormattedTick(
      'Waiting...'
    );

    setPipSize(null);
    setPipSource('none');
    setUsedPipSize(false);
  };

  const selectStrategy = (
    strategyId
  ) => {
    if (
      isAutoBotRunning ||
      contractOpenRef.current
    ) {
      return;
    }

    clearManualProposal();

    setStrategy(
      strategyId
    );

    strategyRef.current =
      strategyId;

    const suggestion =
      getSuggestedDigit(
        strategyId,
        digitHistoryRef.current
      );

    if (
      Number.isInteger(
        Number(
          suggestion
        )
      )
    ) {
      setPredictionDigit(
        String(
          suggestion
        )
      );

      predictionDigitRef.current =
        String(
          suggestion
        );
    }

    const nextSignal =
      evaluateEntrySignal({
        strategy:
          strategyId,

        digitHistory:
          digitHistoryRef.current,

        predictionDigit:
          suggestion,

        config: {
          minimumConfidence:
            minimumConfidenceRef.current,
        },
      });

    setSignal(
      nextSignal
    );
  };

  const resetSessionStats =
    () => {
      const requestStatus =
        getRequestGuardStatus(
          requestGuardRef.current
        );

      const recoveryStatus =
        getContractRecoveryStatus(
          recoveryRef.current
        );

      const pendingStatus =
        getPendingBuyRecoveryStatus(
          pendingBuyRecoveryRef.current
        );

      if (
        isAutoBotRunning ||
        contractOpenRef.current ||
        requestStatus.proposalPending ||
        requestStatus.buyPending ||
        pendingStatus.blocking ||
        (
          recoveryStatus.hasContract &&
          !recoveryStatus.settled
        )
      ) {
        return;
      }

      tradeCountRef.current =
        0;

      totalProfitRef.current =
        0;

      consecutiveLossesRef.current =
        0;

      setTradeCount(0);
      setWinCount(0);
      setLossCount(0);
      setDrawCount(0);
      setConsecutiveLosses(0);
      setTotalProfit(0);
      setTradeHistory([]);

      const base =
        Number(
          baseStake
        ) || 1;

      currentStakeRef.current =
        base;

      setCurrentStake(
        base.toFixed(2)
      );

      lifecycleRef.current =
        createTradeLifecycle();

      requestGuardRef.current =
        resetRequestGuard();

      pendingBuyRecoveryRef.current =
        clearPendingBuyRecovery();

      pendingBuyReconciliationRef.current =
        clearPendingBuyReconciliation();

      recoveryRef.current =
        clearContractRecovery();

      recoveryBackoffRef.current =
        resetRecoveryBackoff(
          recoveryBackoffRef.current
        );

      proposalFreshnessRef.current =
        clearProposalFreshness();

      clearContractRecoveryRecord();
      clearStoredPendingBuy();
      clearSessionState();

      setStoredSessionLabel(
        'No stored session'
      );

      syncPersistedRecovery();
      syncLifecycleLabel();
      syncRequestStatus();
      syncPendingBuyRecovery();
      syncPendingBuyReconciliation();
      syncRecoveryLabel();
      syncRecoveryBackoff();

      setBotLogs([]);

      setProposalData(null);
      setProposalError('');
      setBuyError('');
      setActiveContract(null);
      setContractProfit(null);

      setSocketErrorLabel(
        'No socket errors'
      );

      setContractStatus(
        'No active contract'
      );

      setAutoBotStatus(
        'Standby'
      );
    };

  const analysis =
    buildDigitAnalysis(
      digitHistory
    );

  const selectedStrategy =
    getStrategyById(
      strategy
    );

  const isDemoAccount =
    accountType === 'demo';

  const isContractOpen =
    Boolean(
      activeContract &&
        !activeContract.isSold
    );

  const pendingBuyStatus =
    getPendingBuyRecoveryStatus(
      pendingBuyRecoveryRef.current
    );

  const reconciliationStatus =
    getPendingBuyReconciliationStatus(
      pendingBuyReconciliationRef.current
    );

  const needsPredictionDigit =
    nativeStrategies.includes(
      strategy
    ) &&
    barrierContracts.includes(
      strategy
    );

  const displayQuote =
    formattedTick ||
    (
      lastTick !== null
        ? String(
            lastTick
          )
        : 'Waiting...'
    );

  const completedTrades =
    winCount +
    lossCount +
    drawCount;

  const winRate =
    completedTrades > 0
      ? (
          (
            winCount /
            completedTrades
          ) *
          100
        ).toFixed(1)
      : '0.0';

  const sessionStatus =
    buildSessionStatus({
      running:
        isAutoBotRunning,

      emergencyStopped,

      contractOpen:
        isContractOpen,

      proposalPending:
        proposalLoading,

      buyPending:
        pendingBuyStatus.blocking ||
        buyLoading,

      cooldownUntil:
        cooldownUntilRef.current,
    });

  const recoveryStatus =
    getContractRecoveryStatus(
      recoveryRef.current
    );

  const pipCacheStatus =
    getPipSizeCacheStatus(
      pipSizeCacheRef.current,
      symbol
    );

  const precisionLabel =
    pipSource === 'live'
      ? `Live pip ${pipSize}`
      : pipSource === 'cache'
      ? `Cached pip ${pipSize}`
      : pipCacheStatus.hasCachedPrecision
      ? `Cached pip ${pipCacheStatus.pipSize}`
      : 'Fallback';

  const proposalFreshnessStatus =
    getProposalFreshnessStatus(
      proposalFreshnessRef.current,
      proposalClock ||
        Date.now()
    );

  const signalExecution =
    getExecutionFromSignal(
      signal
    );

  const signalConfidenceLabel =
    getConfidenceLabel(
      signal.confidence
    );

  return (
    <main className="min-h-screen bg-[#070a10] text-slate-100">
      <div className="border-b border-slate-800 bg-[#0b1018] px-4 py-2.5">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-4">
            <StatusDot
              active={
                isMarketConnected
              }
              activeLabel="Market Feed Active"
              inactiveLabel="Market Feed Offline"
            />

            {isAuthorized && (
              <StatusDot
                active={
                  isTradingConnected
                }
                activeLabel={
                  isLoading
                    ? 'Trading Account Loading'
                    : 'Trading Socket Active'
                }
                inactiveLabel={
                  isLoading
                    ? 'Trading Account Loading'
                    : pendingBuyStatus.blocking
                    ? 'BUY Reconciliation Required'
                    : recoveryStatus.needsRecovery
                    ? 'Trading Socket Recovering'
                    : 'Trading Socket Offline'
                }
                activeClass="bg-cyan-400"
              />
            )}
          </div>

          <div className="flex items-center gap-4 font-mono">
            <span className="text-slate-500">
              {symbol}
            </span>

            <span className="font-black text-emerald-400">
              {displayQuote}
            </span>

            <span className="bg-slate-800 border border-slate-700 px-2 py-1 rounded text-cyan-400 font-black">
              {lastDigit ?? '-'}
            </span>
          </div>
        </div>
      </div>

      <header className="border-b border-slate-800 bg-[#0d121c]">
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-xl font-black tracking-tight">
              BINARY
              <span className="text-emerald-400">
                SPOT
              </span>{' '}
              PRO
            </div>

            <p className="text-[9px] uppercase tracking-[0.3em] font-bold text-emerald-500">
              Intelligent Trading Hub
            </p>
          </div>

          {!isAuthorized ? (
            <div className="flex flex-col items-end gap-2">
              <button
                type="button"
                onClick={
                  connectDeriv
                }
                disabled={
                  isLoading ||
                  isConnecting
                }
                className="px-5 py-3 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-black font-black text-xs rounded-xl transition"
              >
                {isLoading
                  ? 'CHECKING SESSION...'
                  : isConnecting
                  ? 'CONNECTING...'
                  : 'CONNECT DERIV'}
              </button>

              {!isLoading && (
                <p className="text-[9px] text-slate-500">
                  Secure Deriv OAuth
                </p>
              )}
            </div>
          ) : (
            <AccountCard
              accounts={
                accounts
              }
              selectedAccountId={
                selectedAccountId
              }
              accountType={
                accountType
              }
              accountId={
                accountId
              }
              balance={
                balance
              }
              currency={
                currency
              }
              isTradingConnected={
                isTradingConnected
              }
              isLoading={
                isLoading
              }
              isLoggingOut={
                isLoggingOut
              }
              onSwitchAccount={
                switchAccount
              }
              onLogout={
                logoutDeriv
              }
            />
          )}
        </div>
      </header>

      <div className="border-b border-slate-800 bg-[#0a0f17] sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 py-2 flex gap-2 overflow-x-auto">
          {[
            [
              'overview',
              '🏠 Overview',
            ],
            [
              'bots',
              '🤖 Bot Studio',
            ],
            [
              'history',
              '📜 History',
            ],
            [
              'analyzer',
              '📊 Digit Analyzer',
            ],
          ].map(
            ([
              id,
              label,
            ]) => (
              <button
                key={id}
                onClick={() =>
                  setActiveTab(
                    id
                  )
                }
                className={`px-4 py-2.5 rounded-xl text-xs font-black whitespace-nowrap transition ${
                  activeTab ===
                  id
                    ? 'bg-emerald-500 text-black'
                    : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                {label}
              </button>
            )
          )}
        </div>
      </div>

      <section className="max-w-7xl mx-auto px-4 py-7">
        {authError && (
          <Alert>
            ⚠️ {authError}
          </Alert>
        )}

        {isAuthorized &&
          accountType ===
            'real' && (
            <div className="mb-6 border border-amber-700/60 bg-amber-950/20 rounded-2xl p-4">
              <p className="font-black text-amber-300 text-sm">
                REAL ACCOUNT ACTIVE
              </p>

              <p className="mt-1 text-xs text-slate-400">
                Account{' '}
                {accountId} is
                connected for
                account information
                and balance updates.
                BinarySpot contract
                execution remains
                blocked.
              </p>
            </div>
          )}

        {pendingBuyStatus.blocking && (
          <div className="mb-6 border border-rose-700 bg-rose-950/30 rounded-2xl p-5">
            <p className="font-black text-rose-300">
              ⚠️ BUY OUTCOME UNKNOWN
            </p>

            <p className="mt-2 text-sm text-slate-300">
              BinarySpot is
              protecting the
              account from duplicate
              entries while the
              previous BUY remains
              unresolved.
            </p>

            <p className="mt-2 text-xs text-cyan-300">
              {
                pendingBuyLabel
              }
            </p>

            <p className="mt-1 text-xs text-slate-400">
              {
                persistedPendingBuyLabel
              }
            </p>

            <div className="mt-4 rounded-xl border border-slate-800 bg-black/20 p-3">
              <p className="text-xs font-black text-cyan-300">
                {
                  reconciliationLabel
                }
              </p>

              {reconciliationReason && (
                <p className="mt-1 text-xs text-slate-400">
                  {
                    reconciliationReason
                  }
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={
                retryPendingBuyReconciliation
              }
              disabled={
                reconciliationRunning
              }
              className="mt-4 px-4 py-3 bg-cyan-500 disabled:opacity-40 text-black text-xs font-black rounded-xl"
            >
              {reconciliationRunning
                ? 'RECONCILING...'
                : 'RETRY BUY RECONCILIATION'}
            </button>
          </div>
        )}

        {activeTab ===
          'overview' && (
          <div className="space-y-6">
            <div className="rounded-3xl border border-slate-800 bg-gradient-to-br from-[#101827] to-[#0a0f17] p-7 md:p-11 overflow-hidden relative">
              <div className="absolute right-0 top-0 w-72 h-72 bg-emerald-500/5 rounded-full blur-3xl" />

              <div className="relative">
                <span className="inline-flex rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-400 font-black">
                  BinarySpot Intelligence
                </span>

                <h1 className="mt-5 max-w-4xl text-3xl md:text-5xl font-black leading-tight">
                  Strategy,
                  execution and
                  account safety in
                  one trading hub.
                </h1>

                <p className="mt-5 max-w-3xl text-sm md:text-base text-slate-400 leading-7">
                  BinarySpot analyses
                  Deriv digit markets,
                  converts advanced
                  strategies into valid
                  Deriv contracts and
                  keeps OAuth,
                  account switching,
                  pending BUY safety
                  and contract recovery
                  synchronized.
                </p>

                <div className="mt-7 flex flex-wrap gap-3">
                  <button
                    onClick={() =>
                      setActiveTab(
                        'bots'
                      )
                    }
                    className="px-5 py-3 rounded-xl bg-emerald-500 text-black text-xs font-black"
                  >
                    OPEN BOT STUDIO
                  </button>

                  <button
                    onClick={() =>
                      setActiveTab(
                        'analyzer'
                      )
                    }
                    className="px-5 py-3 rounded-xl bg-slate-800 border border-slate-700 text-xs font-black"
                  >
                    VIEW DIGIT ANALYSIS
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <DashboardMetric
                label="Net Session P/L"
                value={`${totalProfit >= 0 ? '+' : ''}${Number(
                  totalProfit
                ).toFixed(2)} ${currency}`}
                accent={
                  totalProfit >= 0
                    ? 'text-emerald-400'
                    : 'text-rose-400'
                }
              />

              <DashboardMetric
                label="Settled Trades"
                value={
                  completedTrades
                }
              />

              <DashboardMetric
                label="Win Rate"
                value={`${winRate}%`}
                accent="text-cyan-400"
              />

              <DashboardMetric
                label="Active Strategy"
                value={
                  selectedStrategy?.shortName ||
                  strategy
                }
                accent="text-amber-300"
              />
            </div>

            <div className="grid lg:grid-cols-3 gap-5">
              <Panel className="lg:col-span-2">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-wider text-slate-500 font-bold">
                      Strategy Signal
                    </p>

                    <h2 className="text-xl font-black mt-1">
                      {selectedStrategy?.name ||
                        strategy}
                    </h2>
                  </div>

                  <SignalBadge
                    signal={
                      signal
                    }
                  />
                </div>

                <div className="grid sm:grid-cols-3 gap-3 mt-5">
                  <MiniMetric
                    label="Confidence"
                    value={`${Number(
                      signal.confidence ||
                        0
                    ).toFixed(
                      1
                    )}%`}
                  />

                  <MiniMetric
                    label="Signal Quality"
                    value={
                      signalConfidenceLabel
                    }
                  />

                  <MiniMetric
                    label="Execution"
                    value={
                      signalExecution.valid
                        ? `${
                            signalExecution.contractType
                          }${
                            signalExecution.predictionDigit !==
                              null
                              ? ` / ${signalExecution.predictionDigit}`
                              : ''
                          }`
                        : 'WAIT'
                    }
                  />
                </div>

                <div className="mt-4 border border-slate-800 rounded-xl bg-black/20 p-4">
                  <p className="text-xs text-slate-400">
                    {
                      signal.reason
                    }
                  </p>
                </div>
              </Panel>

              <Panel>
                <p className="text-xs uppercase tracking-wider text-slate-500 font-bold">
                  Account
                </p>

                <h3 className="text-xl font-black mt-2">
                  {accountId ||
                    'Not connected'}
                </h3>

                <p
                  className={`mt-1 text-xs font-black ${
                    accountType ===
                    'demo'
                      ? 'text-cyan-400'
                      : accountType ===
                        'real'
                      ? 'text-rose-400'
                      : 'text-slate-500'
                  }`}
                >
                  {accountType
                    ? accountType.toUpperCase()
                    : 'OFFLINE'}
                </p>

                <p className="text-2xl font-mono font-black text-emerald-400 mt-5">
                  {balance !==
                    null
                    ? `${currency} ${Number(
                        balance
                      ).toLocaleString(
                        'en-US',
                        {
                          minimumFractionDigits:
                            2,

                          maximumFractionDigits:
                            2,
                        }
                      )}`
                    : '—'}
                </p>
              </Panel>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <StatBox
                label="Session"
                value={
                  sessionStatus.label
                }
                accent="text-cyan-400"
              />

              <StatBox
                label="Stored Session"
                value={
                  storedSessionLabel
                }
                accent="text-cyan-400"
              />

              <StatBox
                label="Pending BUY Safety"
                value={
                  pendingBuyLabel
                }
                accent={
                  pendingBuyStatus.blocking
                    ? 'text-rose-400'
                    : 'text-emerald-400'
                }
              />

              <StatBox
                label="BUY Reconciliation"
                value={
                  reconciliationLabel
                }
                accent={
                  reconciliationStatus.ambiguous ||
                  reconciliationStatus.failed ||
                  reconciliationStatus.noMatch
                    ? 'text-rose-400'
                    : reconciliationStatus.searching
                    ? 'text-amber-400'
                    : 'text-emerald-400'
                }
              />

              <StatBox
                label="Request Guard"
                value={
                  requestStatusLabel
                }
                accent="text-amber-400"
              />

              <StatBox
                label="Contract Recovery"
                value={
                  recoveryLabel
                }
                accent="text-emerald-400"
              />

              <StatBox
                label="Persisted Recovery"
                value={
                  persistedRecoveryLabel
                }
                accent="text-cyan-400"
              />

              <StatBox
                label="Socket Guard"
                value={
                  socketErrorLabel
                }
                accent="text-emerald-400"
              />

              <StatBox
                label="Recovery Backoff"
                value={
                  recoveryBackoffUi.label
                }
                accent="text-emerald-400"
              />

              <StatBox
                label="Tick Precision"
                value={
                  precisionLabel
                }
                accent="text-emerald-400"
              />

              <StatBox
                label="Manual Proposal"
                value={
                  proposalFreshnessStatus.label
                }
                accent="text-slate-400"
              />

              <StatBox
                label="Lifecycle"
                value={
                  lifecycleLabel
                }
                accent="text-slate-400"
              />
            </div>
          </div>
        )}

        {activeTab ===
          'bots' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-emerald-500 font-black">
                  Strategy Library
                </p>

                <h1 className="text-2xl md:text-3xl font-black mt-2">
                  Bot Studio
                </h1>

                <p className="text-sm text-slate-400 mt-2 max-w-2xl">
                  Choose how
                  BinarySpot analyses
                  the market. Advanced
                  strategies produce a
                  separate valid Deriv
                  execution contract.
                </p>
              </div>

              <div
                className={`rounded-xl border px-4 py-3 text-xs font-black ${
                  isDemoAccount
                    ? 'border-cyan-800 bg-cyan-950/20 text-cyan-300'
                    : 'border-rose-800 bg-rose-950/20 text-rose-300'
                }`}
              >
                {isDemoAccount
                  ? `DEMO EXECUTION — ${accountId}`
                  : 'REAL SELECTED — EXECUTION BLOCKED'}
              </div>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {strategyLibrary.map(
                (item) => (
                  <StrategyCard
                    key={
                      item.id
                    }
                    item={
                      item
                    }
                    selected={
                      strategy ===
                      item.id
                    }
                    disabled={
                      isAutoBotRunning ||
                      isContractOpen ||
                      pendingBuyStatus.blocking
                    }
                    onSelect={() =>
                      selectStrategy(
                        item.id
                      )
                    }
                  />
                )
              )}
            </div>

            <Panel>
              <div className="grid lg:grid-cols-3 gap-5">
                <div className="lg:col-span-2">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <p className="text-xs text-slate-500 uppercase font-bold">
                        Selected Strategy
                      </p>

                      <h2 className="text-xl font-black mt-1">
                        {selectedStrategy?.name ||
                          strategy}
                      </h2>

                      <p className="text-sm text-slate-400 mt-2 max-w-xl">
                        {selectedStrategy?.description ||
                          'BinarySpot trading strategy'}
                      </p>
                    </div>

                    <SignalBadge
                      signal={
                        signal
                      }
                    />
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
                    <MiniMetric
                      label="Confidence"
                      value={`${Number(
                        signal.confidence ||
                          0
                      ).toFixed(
                        1
                      )}%`}
                    />

                    <MiniMetric
                      label="Quality"
                      value={
                        signalConfidenceLabel
                      }
                    />

                    <MiniMetric
                      label="Samples"
                      value={
                        signal.sampleSize ||
                        0
                      }
                    />

                    <MiniMetric
                      label="Execution"
                      value={
                        signalExecution.valid
                          ? signalExecution.contractType
                          : 'WAIT'
                      }
                    />
                  </div>

                  <div className="mt-4 rounded-xl border border-slate-800 bg-black/20 p-4">
                    <p className="text-xs text-slate-300">
                      {
                        signal.reason
                      }
                    </p>

                    {signalExecution.valid &&
                      signalExecution.predictionDigit !==
                        null && (
                        <p className="mt-2 text-xs font-mono text-cyan-300">
                          Execution
                          barrier:{' '}
                          {
                            signalExecution.predictionDigit
                          }
                        </p>
                      )}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-800 bg-[#0a0f17] p-5">
                  <p className="text-xs uppercase tracking-wider text-slate-500 font-bold">
                    Bot Status
                  </p>

                  <p className="text-lg font-black mt-2 break-words">
                    {
                      autoBotStatus
                    }
                  </p>

                  <div className="mt-5 space-y-2 text-xs">
                    <StatusRow
                      label="Market Feed"
                      active={
                        isMarketConnected
                      }
                    />

                    <StatusRow
                      label="Trading Socket"
                      active={
                        isTradingConnected
                      }
                    />

                    <StatusRow
                      label="Demo Execution"
                      active={
                        isDemoAccount
                      }
                    />

                    <StatusRow
                      label="Emergency Stop"
                      active={
                        !emergencyStopped
                      }
                      activeText="Clear"
                      inactiveText="ACTIVE"
                    />
                  </div>
                </div>
              </div>
            </Panel>

            <Panel>
              <h2 className="text-lg font-black">
                Market & Contract
              </h2>

              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-5">
                <Field label="Synthetic Asset">
                  <select
                    value={
                      symbol
                    }
                    onChange={(
                      event
                    ) =>
                      changeSymbol(
                        event
                          .target
                          .value
                      )
                    }
                    disabled={
                      isAutoBotRunning ||
                      isContractOpen ||
                      pendingBuyStatus.blocking
                    }
                    className={
                      INPUT_CLASS
                    }
                  >
                    <option value="R_100">
                      Volatility 100
                    </option>

                    <option value="R_50">
                      Volatility 50
                    </option>

                    <option value="R_25">
                      Volatility 25
                    </option>

                    <option value="1HZ100V">
                      Volatility 100
                      (1s)
                    </option>
                  </select>
                </Field>

                <Field label="Duration (ticks)">
                  <input
                    value={
                      duration
                    }
                    onChange={(
                      event
                    ) =>
                      setDuration(
                        event
                          .target
                          .value
                      )
                    }
                    disabled={
                      isAutoBotRunning
                    }
                    className={
                      INPUT_CLASS
                    }
                  />
                </Field>

                {needsPredictionDigit && (
                  <Field label="Prediction / Barrier">
                    <input
                      value={
                        predictionDigit
                      }
                      onChange={(
                        event
                      ) =>
                        setPredictionDigit(
                          event
                            .target
                            .value
                        )
                      }
                      disabled={
                        isAutoBotRunning
                      }
                      className={
                        INPUT_CLASS
                      }
                    />
                  </Field>
                )}

                <Field label="Minimum Confidence">
                  <input
                    value={
                      minimumConfidence
                    }
                    onChange={(
                      event
                    ) =>
                      setMinimumConfidence(
                        event
                          .target
                          .value
                      )
                    }
                    disabled={
                      isAutoBotRunning
                    }
                    className={
                      INPUT_CLASS
                    }
                  />
                </Field>
              </div>
            </Panel>

            <Panel>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-black">
                    Risk Management
                  </h2>

                  <p className="text-xs text-slate-500 mt-1">
                    Session-level
                    limits remain active
                    regardless of
                    strategy.
                  </p>
                </div>

                <span className="text-[10px] font-black rounded-full border border-emerald-500/20 bg-emerald-500/10 text-emerald-400 px-3 py-1">
                  SAFETY ENGINE
                </span>
              </div>

              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-5">
                <Field label="Base Stake">
                  <input
                    value={
                      baseStake
                    }
                    onChange={(
                      event
                    ) =>
                      setBaseStake(
                        event
                          .target
                          .value
                      )
                    }
                    disabled={
                      isAutoBotRunning
                    }
                    className={
                      INPUT_CLASS
                    }
                  />
                </Field>

                <Field label="Current Stake">
                  <input
                    value={
                      currentStake
                    }
                    readOnly
                    className={
                      INPUT_CLASS
                    }
                  />
                </Field>

                <Field label="Maximum Stake">
                  <input
                    value={
                      maxStake
                    }
                    onChange={(
                      event
                    ) =>
                      setMaxStake(
                        event
                          .target
                          .value
                      )
                    }
                    disabled={
                      isAutoBotRunning
                    }
                    className={
                      INPUT_CLASS
                    }
                  />
                </Field>

                <Field label="Loss Multiplier">
                  <input
                    value={
                      martingale
                    }
                    onChange={(
                      event
                    ) =>
                      setMartingale(
                        event
                          .target
                          .value
                      )
                    }
                    disabled={
                      isAutoBotRunning
                    }
                    className={
                      INPUT_CLASS
                    }
                  />
                </Field>

                <Field label="Take Profit">
                  <input
                    value={
                      takeProfit
                    }
                    onChange={(
                      event
                    ) =>
                      setTakeProfit(
                        event
                          .target
                          .value
                      )
                    }
                    disabled={
                      isAutoBotRunning
                    }
                    className={
                      INPUT_CLASS
                    }
                  />
                </Field>

                <Field label="Stop Loss">
                  <input
                    value={
                      stopLoss
                    }
                    onChange={(
                      event
                    ) =>
                      setStopLoss(
                        event
                          .target
                          .value
                      )
                    }
                    disabled={
                      isAutoBotRunning
                    }
                    className={
                      INPUT_CLASS
                    }
                  />
                </Field>

                <Field label="Max Consecutive Losses">
                  <input
                    value={
                      maxConsecutiveLosses
                    }
                    onChange={(
                      event
                    ) =>
                      setMaxConsecutiveLosses(
                        event
                          .target
                          .value
                      )
                    }
                    disabled={
                      isAutoBotRunning
                    }
                    className={
                      INPUT_CLASS
                    }
                  />
                </Field>

                <Field label="Maximum Trades">
                  <input
                    value={
                      maxTrades
                    }
                    onChange={(
                      event
                    ) =>
                      setMaxTrades(
                        event
                          .target
                          .value
                      )
                    }
                    disabled={
                      isAutoBotRunning
                    }
                    className={
                      INPUT_CLASS
                    }
                  />
                </Field>

                <Field label="Cooldown Seconds">
                  <input
                    value={
                      cooldownSeconds
                    }
                    onChange={(
                      event
                    ) =>
                      setCooldownSeconds(
                        event
                          .target
                          .value
                      )
                    }
                    disabled={
                      isAutoBotRunning
                    }
                    className={
                      INPUT_CLASS
                    }
                  />
                </Field>
              </div>
            </Panel>

            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              <DashboardMetric
                label="Net P/L"
                value={`${totalProfit >= 0 ? '+' : ''}${Number(
                  totalProfit
                ).toFixed(2)}`}
                accent={
                  totalProfit >=
                  0
                    ? 'text-emerald-400'
                    : 'text-rose-400'
                }
              />

              <DashboardMetric
                label="Trades"
                value={
                  tradeCount
                }
              />

              <DashboardMetric
                label="Wins"
                value={
                  winCount
                }
                accent="text-emerald-400"
              />

              <DashboardMetric
                label="Losses"
                value={
                  lossCount
                }
                accent="text-rose-400"
              />

              <DashboardMetric
                label="Win Rate"
                value={`${winRate}%`}
                accent="text-cyan-400"
              />
            </div>

            <Panel>
              {buyError && (
                <Alert>
                  ⚠️ {buyError}
                </Alert>
              )}

              {proposalError && (
                <Alert>
                  ⚠️{' '}
                  {
                    proposalError
                  }
                </Alert>
              )}

              {emergencyStopped && (
                <button
                  type="button"
                  onClick={
                    clearEmergencyStop
                  }
                  className="mb-4 w-full py-3 bg-slate-700 text-white font-black rounded-xl"
                >
                  CLEAR EMERGENCY
                  STOP
                </button>
              )}

              <div className="grid sm:grid-cols-2 gap-3">
                {!isAutoBotRunning ? (
                  <button
                    onClick={
                      startAutoBot
                    }
                    disabled={
                      !isDemoAccount ||
                      !isTradingConnected ||
                      isLoading ||
                      isContractOpen ||
                      pendingBuyStatus.blocking ||
                      emergencyStopped
                    }
                    className="py-4 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-black font-black rounded-xl transition"
                  >
                    ▶ START STRATEGY
                    BOT
                  </button>
                ) : (
                  <button
                    onClick={() =>
                      stopAutoBot(
                        'Stopped manually'
                      )
                    }
                    className="py-4 bg-amber-500 text-black font-black rounded-xl"
                  >
                    ⏹ STOP BOT
                  </button>
                )}

                <button
                  onClick={
                    emergencyStop
                  }
                  disabled={
                    emergencyStopped
                  }
                  className="py-4 bg-rose-600 disabled:opacity-40 text-white font-black rounded-xl"
                >
                  🛑 EMERGENCY STOP
                </button>
              </div>

              {!isDemoAccount && (
                <div className="mt-4 rounded-xl border border-rose-800 bg-rose-950/20 p-4 text-xs text-rose-300">
                  Bot execution is
                  disabled because the
                  active account is a
                  Real account. Switch
                  to Demo to execute
                  contracts.
                </div>
              )}

              {!isAutoBotRunning &&
                !isContractOpen &&
                !pendingBuyStatus.blocking && (
                  <div className="border-t border-slate-800 mt-6 pt-6">
                    <p className="text-xs uppercase tracking-wider font-black text-slate-500 mb-3">
                      Manual Demo Test
                    </p>

                    <div className="grid sm:grid-cols-2 gap-3">
                      <button
                        onClick={
                          requestManualProposal
                        }
                        disabled={
                          proposalLoading ||
                          !isDemoAccount ||
                          !isTradingConnected ||
                          isLoading
                        }
                        className="py-3 bg-cyan-500 disabled:opacity-40 text-black font-black rounded-xl"
                      >
                        {proposalLoading
                          ? 'GETTING PROPOSAL...'
                          : isAdvancedStrategy(
                              strategy
                            )
                          ? 'GET STRATEGY PROPOSAL'
                          : 'GET PROPOSAL'}
                      </button>

                      <button
                        onClick={
                          buyManualDemoProposal
                        }
                        disabled={
                          !isDemoAccount ||
                          !proposalData ||
                          !proposalFreshnessStatus.fresh ||
                          buyLoading
                        }
                        className="py-3 bg-amber-400 disabled:opacity-40 text-black font-black rounded-xl"
                      >
                        {buyLoading
                          ? 'BUYING...'
                          : 'BUY DEMO CONTRACT'}
                      </button>
                    </div>
                  </div>
                )}

              {proposalData && (
                <div className="mt-5 border border-cyan-900/60 bg-cyan-950/10 rounded-2xl p-4">
                  <p className="text-xs font-black text-cyan-300">
                    DERIV PROPOSAL
                  </p>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
                    <MiniMetric
                      label="Ask Price"
                      value={`${currency} ${proposalData.ask_price ?? '—'}`}
                    />

                    <MiniMetric
                      label="Payout"
                      value={`${proposalData.payout ?? '—'}`}
                    />

                    <MiniMetric
                      label="Spot"
                      value={`${proposalData.spot ?? '—'}`}
                    />

                    <MiniMetric
                      label="Freshness"
                      value={
                        proposalFreshnessStatus.label
                      }
                    />
                  </div>
                </div>
              )}

              {activeContract && (
                <div className="mt-6 border border-amber-500/30 bg-amber-500/5 rounded-2xl p-5">
                  <p className="text-xs text-amber-400 font-black">
                    CONTRACT #
                    {
                      activeContract.contractId
                    }
                  </p>

                  <p className="mt-2 text-xl font-black">
                    {
                      contractStatus
                    }
                  </p>

                  {activeContract.contractType && (
                    <p className="mt-1 text-xs text-slate-400 font-mono">
                      {
                        activeContract.contractType
                      }
                    </p>
                  )}

                  <p
                    className={`mt-3 font-mono text-xl font-black ${
                      Number(
                        contractProfit
                      ) >= 0
                        ? 'text-emerald-400'
                        : 'text-rose-400'
                    }`}
                  >
                    P/L:{' '}
                    {contractProfit !==
                    null
                      ? Number(
                          contractProfit
                        ).toFixed(
                          2
                        )
                      : '-'}
                  </p>
                </div>
              )}
            </Panel>

            <Panel>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-black">
                    Bot Activity
                  </h2>

                  <p className="text-xs text-slate-500 mt-1">
                    Latest strategy,
                    proposal, BUY and
                    safety events.
                  </p>
                </div>
              </div>

              {botLogs.length ===
              0 ? (
                <p className="text-center text-sm text-slate-600 py-10">
                  No bot activity yet.
                </p>
              ) : (
                <div className="mt-4 space-y-2 max-h-[380px] overflow-y-auto">
                  {botLogs.map(
                    (
                      log,
                      index
                    ) => (
                      <div
                        key={`${log.time}-${index}`}
                        className="flex gap-3 border border-slate-800 bg-[#090d14] rounded-xl p-3"
                      >
                        <span className="text-[10px] font-mono text-slate-600 shrink-0">
                          {
                            log.time
                          }
                        </span>

                        <span
                          className={`text-xs ${
                            log.type ===
                            'success'
                              ? 'text-emerald-400'
                              : log.type ===
                                'error'
                              ? 'text-rose-400'
                              : log.type ===
                                'trade'
                              ? 'text-cyan-300'
                              : 'text-slate-400'
                          }`}
                        >
                          {
                            log.message
                          }
                        </span>
                      </div>
                    )
                  )}
                </div>
              )}
            </Panel>
          </div>
        )}

        {activeTab ===
          'history' && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <DashboardMetric
                label="Trades"
                value={
                  completedTrades
                }
              />

              <DashboardMetric
                label="Wins"
                value={
                  winCount
                }
                accent="text-emerald-400"
              />

              <DashboardMetric
                label="Losses"
                value={
                  lossCount
                }
                accent="text-rose-400"
              />

              <DashboardMetric
                label="Win Rate"
                value={`${winRate}%`}
                accent="text-cyan-400"
              />
            </div>

            <Panel>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-black">
                    Session Trade
                    History
                  </h2>

                  <p className="mt-1 text-xs text-slate-400">
                    {completedTrades}{' '}
                    settled · Net{' '}
                    {totalProfit >=
                    0
                      ? '+'
                      : ''}
                    {Number(
                      totalProfit
                    ).toFixed(
                      2
                    )}{' '}
                    {currency}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={
                    resetSessionStats
                  }
                  className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs font-black"
                >
                  RESET SESSION
                </button>
              </div>

              {tradeHistory.length ===
              0 ? (
                <p className="py-14 text-center text-slate-500">
                  No settled
                  contracts yet.
                </p>
              ) : (
                <div className="mt-6 space-y-3">
                  {tradeHistory.map(
                    (
                      trade
                    ) => (
                      <div
                        key={
                          trade.id
                        }
                        className="border border-slate-800 bg-[#090d14] rounded-xl p-4 flex flex-wrap items-center justify-between gap-4"
                      >
                        <div>
                          <p className="font-mono text-sm font-black">
                            #
                            {
                              trade.id
                            }
                          </p>

                          <p className="text-xs text-slate-500 mt-1">
                            {
                              trade.strategy
                            }
                            {trade.contractType
                              ? ` → ${trade.contractType}`
                              : ''}
                            {' · '}
                            {
                              trade.symbol
                            }
                            {' · '}
                            {
                              trade.time
                            }
                          </p>
                        </div>

                        <div className="text-right">
                          <p
                            className={`font-black ${
                              trade.result ===
                              'won'
                                ? 'text-emerald-400'
                                : trade.result ===
                                  'lost'
                                ? 'text-rose-400'
                                : 'text-slate-300'
                            }`}
                          >
                            {String(
                              trade.result
                            ).toUpperCase()}
                          </p>

                          <p className="font-mono text-sm mt-1">
                            {Number(
                              trade.profit
                            ) >= 0
                              ? '+'
                              : ''}
                            {Number(
                              trade.profit
                            ).toFixed(
                              2
                            )}
                          </p>

                          {trade.recovered && (
                            <p className="text-[9px] text-cyan-400 font-black mt-1">
                              RECOVERED
                            </p>
                          )}
                        </div>
                      </div>
                    )
                  )}
                </div>
              )}
            </Panel>
          </div>
        )}

        {activeTab ===
          'analyzer' && (
          <div className="space-y-5">
            <Panel>
              <div className="flex flex-wrap justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-wider text-emerald-500 font-black">
                    Market
                    Intelligence
                  </p>

                  <h2 className="text-2xl font-black mt-1">
                    Digit Analyzer
                  </h2>

                  <p className="text-xs text-slate-400 mt-2">
                    {
                      analysis.sampleSize
                    }{' '}
                    recent ticks
                  </p>
                </div>

                <button
                  type="button"
                  onClick={
                    applySuggestedDigit
                  }
                  className="px-4 py-2 rounded-xl bg-cyan-500 text-black text-xs font-black"
                >
                  USE SUGGESTED
                  DIGIT
                </button>
              </div>

              <div className="grid grid-cols-5 sm:grid-cols-10 gap-2 mt-6">
                {analysis.percentages.map(
                  (
                    item
                  ) => (
                    <div
                      key={
                        item.digit
                      }
                      className={`border rounded-xl p-3 text-center ${
                        analysis.mostFrequent?.digit ===
                        item.digit
                          ? 'border-emerald-500/50 bg-emerald-500/10'
                          : analysis.leastFrequent?.digit ===
                            item.digit
                          ? 'border-cyan-500/40 bg-cyan-500/5'
                          : 'bg-[#080b11] border-slate-800'
                      }`}
                    >
                      <p className="font-black text-lg">
                        {
                          item.digit
                        }
                      </p>

                      <p className="text-xs text-cyan-400 mt-2">
                        {
                          item.percentage
                        }
                        %
                      </p>

                      <p
                        className={`text-[9px] mt-1 ${
                          item.deviation >
                          0
                            ? 'text-emerald-400'
                            : item.deviation <
                              0
                            ? 'text-rose-400'
                            : 'text-slate-500'
                        }`}
                      >
                        {item.deviation >
                        0
                          ? '+'
                          : ''}
                        {
                          item.deviation
                        }
                      </p>
                    </div>
                  )
                )}
              </div>
            </Panel>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
              <DashboardMetric
                label="Distribution Quality"
                value={`${analysis.distributionQuality ?? 0}%`}
                accent="text-emerald-400"
              />

              <DashboardMetric
                label="Most Frequent"
                value={`${
                  analysis.mostFrequent?.digit ??
                  '-'
                } · ${
                  analysis.mostFrequent?.percentage ??
                  0
                }%`}
                accent="text-emerald-400"
              />

              <DashboardMetric
                label="Least Frequent"
                value={`${
                  analysis.leastFrequent?.digit ??
                  '-'
                } · ${
                  analysis.leastFrequent?.percentage ??
                  0
                }%`}
                accent="text-cyan-400"
              />

              <DashboardMetric
                label="Parity Streak"
                value={
                  analysis.streak
                    ?.type
                    ? `${analysis.streak.type.toUpperCase()} × ${analysis.streak.length}`
                    : 'NONE'
                }
                accent="text-amber-300"
              />
            </div>

            <div className="grid md:grid-cols-2 gap-5">
              <Panel>
                <h3 className="font-black">
                  Even / Odd
                  Distribution
                </h3>

                <div className="grid grid-cols-2 gap-3 mt-4">
                  <MiniMetric
                    label="Even"
                    value={`${analysis.evenOdd?.evenPercentage ?? 0}%`}
                  />

                  <MiniMetric
                    label="Odd"
                    value={`${analysis.evenOdd?.oddPercentage ?? 0}%`}
                  />
                </div>
              </Panel>

              <Panel>
                <h3 className="font-black">
                  Hot / Cold
                  Analysis
                </h3>

                <div className="grid grid-cols-2 gap-3 mt-4">
                  <MiniMetric
                    label="Hot Digit"
                    value={
                      analysis.hotCold?.hotDigit ??
                      '—'
                    }
                  />

                  <MiniMetric
                    label="Cold Digit"
                    value={
                      analysis.hotCold?.coldDigit ??
                      '—'
                    }
                  />
                </div>

                <p className="text-xs text-slate-500 mt-4">
                  {
                    analysis.hotCold?.reason
                  }
                </p>
              </Panel>

              <Panel>
                <h3 className="font-black">
                  Momentum
                </h3>

                <div className="grid grid-cols-2 gap-3 mt-4">
                  <MiniMetric
                    label="Direction"
                    value={
                      analysis.momentum?.direction ||
                      'WAIT'
                    }
                  />

                  <MiniMetric
                    label="Confidence"
                    value={`${analysis.momentum?.confidence ?? 0}%`}
                  />
                </div>

                <p className="text-xs text-slate-500 mt-4">
                  {
                    analysis.momentum?.reason
                  }
                </p>
              </Panel>

              <Panel>
                <h3 className="font-black">
                  Mean Reversion
                </h3>

                <div className="grid grid-cols-2 gap-3 mt-4">
                  <MiniMetric
                    label="Overextended"
                    value={
                      analysis.meanReversion?.overextendedDigit ??
                      '—'
                    }
                  />

                  <MiniMetric
                    label="Underrepresented"
                    value={
                      analysis.meanReversion?.underrepresentedDigit ??
                      '—'
                    }
                  />
                </div>

                <p className="text-xs text-slate-500 mt-4">
                  {
                    analysis.meanReversion?.reason
                  }
                </p>
              </Panel>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

function Field({
  label,
  children,
}) {
  return (
    <div>
      <label className="text-xs text-slate-400 font-bold">
        {label}
      </label>

      {children}
    </div>
  );
}

function Panel({
  children,
  className = '',
}) {
  return (
    <div
      className={`bg-[#0e1420] border border-slate-800 rounded-2xl p-5 md:p-6 ${className}`}
    >
      {children}
    </div>
  );
}

function MiniMetric({
  label,
  value,
}) {
  return (
    <div className="border border-slate-800 bg-[#090d14] rounded-xl p-3">
      <p className="text-[9px] uppercase tracking-wider text-slate-500 font-bold">
        {label}
      </p>

      <p className="mt-1 text-sm font-black font-mono break-words">
        {value}
      </p>
    </div>
  );
}

function DashboardMetric({
  label,
  value,
  accent = 'text-white',
}) {
  return (
    <div className="bg-[#0e1420] border border-slate-800 rounded-2xl p-4">
      <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">
        {label}
      </p>

      <p
        className={`mt-2 text-lg md:text-xl font-black font-mono break-words ${accent}`}
      >
        {value}
      </p>
    </div>
  );
}

function StrategyCard({
  item,
  selected,
  disabled,
  onSelect,
}) {
  const riskClass =
    item.risk === 'High'
      ? 'text-rose-300 border-rose-800/50 bg-rose-950/20'
      : item.risk ===
        'Moderate'
      ? 'text-amber-300 border-amber-800/50 bg-amber-950/20'
      : 'text-cyan-300 border-cyan-800/50 bg-cyan-950/20';

  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={
        disabled
      }
      className={`text-left rounded-2xl border p-5 transition disabled:opacity-50 ${
        selected
          ? 'border-emerald-500 bg-emerald-500/10 shadow-[0_0_0_1px_rgba(16,185,129,0.1)]'
          : 'border-slate-800 bg-[#0e1420] hover:border-slate-700'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-black">
            {item.name}
          </p>

          <p className="text-[10px] uppercase tracking-wider text-slate-500 mt-1">
            {
              item.category
            }
          </p>
        </div>

        {item.recommended && (
          <span className="text-[8px] font-black bg-emerald-500 text-black rounded-full px-2 py-1">
            RECOMMENDED
          </span>
        )}
      </div>

      <p className="text-xs text-slate-400 mt-4 leading-5">
        {
          item.description
        }
      </p>

      <div className="flex items-center justify-between gap-3 mt-5">
        <span
          className={`text-[9px] font-black rounded-full border px-2 py-1 ${riskClass}`}
        >
          {item.risk}
        </span>

        <span className="text-[9px] text-slate-500">
          {item.minimumSamples}{' '}
          ticks+
        </span>
      </div>
    </button>
  );
}

function SignalBadge({
  signal,
}) {
  const qualified =
    Boolean(
      signal?.shouldTrade
    );

  return (
    <span
      className={`rounded-full border px-3 py-1.5 text-[10px] font-black ${
        qualified
          ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
          : 'border-amber-500/30 bg-amber-500/10 text-amber-300'
      }`}
    >
      {qualified
        ? 'QUALIFIED SIGNAL'
        : 'WAITING'}
    </span>
  );
}

function StatusRow({
  label,
  active,
  activeText = 'Active',
  inactiveText = 'Offline',
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-800/70 pb-2">
      <span className="text-slate-500">
        {label}
      </span>

      <span
        className={`font-black ${
          active
            ? 'text-emerald-400'
            : 'text-rose-400'
        }`}
      >
        {active
          ? activeText
          : inactiveText}
      </span>
    </div>
  );
}

function StatBox({
  label,
  value,
  accent = 'text-white',
}) {
  return (
    <div className="bg-[#080b11] border border-slate-800 rounded-xl p-3">
      <p className="text-[10px] uppercase text-slate-500">
        {label}
      </p>

      <p
        className={`mt-1 text-sm font-black font-mono break-words ${accent}`}
      >
        {value}
      </p>
    </div>
  );
}

function StatusDot({
  active,
  activeLabel,
  inactiveLabel,
  activeClass = 'bg-emerald-400',
}) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={`h-2.5 w-2.5 rounded-full ${
          active
            ? activeClass
            : 'bg-rose-500'
        }`}
      />

      <span className="font-semibold text-slate-300">
        {active
          ? activeLabel
          : inactiveLabel}
      </span>
    </div>
  );
}

function AccountCard({
  accounts,
  selectedAccountId,
  accountType,
  accountId,
  balance,
  currency,
  isTradingConnected,
  isLoading,
  isLoggingOut,
  onSwitchAccount,
  onLogout,
}) {
  const demo =
    accountType === 'demo';

  const safeAccounts =
    Array.isArray(accounts)
      ? accounts.filter(
          (account) =>
            account &&
            (
              account.id ||
              account.loginid
            )
        )
      : [];

  const accountOptionLabel =
    (account) => {
      const id =
        account.id ||
        account.loginid ||
        'Unknown';

      const rawType =
        String(
          account.type ||
          ''
        ).toLowerCase();

      const isDemo =
        rawType ===
          'demo' ||
        rawType ===
          'virtual';

      const typeLabel =
        isDemo
          ? 'Demo'
          : 'Real';

      const accountCurrency =
        account.currency
          ? ` · ${account.currency}`
          : '';

      return `${typeLabel} — ${id}${accountCurrency}`;
    };

  return (
    <div className="flex flex-wrap items-stretch justify-end gap-3">
      <div className="min-w-[210px] border border-slate-700 bg-[#080b11] rounded-xl px-3 py-2">
        <p className="text-[9px] uppercase tracking-wider font-black text-slate-500">
          Deriv Account
        </p>

        <select
          value={
            selectedAccountId ||
            accountId ||
            ''
          }
          onChange={(
            event
          ) =>
            onSwitchAccount?.(
              event.target
                .value
            )
          }
          disabled={
            isLoading ||
            isLoggingOut ||
            safeAccounts.length <=
              1
          }
          className="mt-1 w-full bg-[#080b11] text-xs font-black text-slate-100 outline-none disabled:opacity-50"
        >
          {safeAccounts.length ===
          0 ? (
            <option
              value={
                accountId ||
                ''
              }
            >
              {accountId
                ? `${
                    demo
                      ? 'Demo'
                      : 'Real'
                  } — ${accountId}`
                : 'No account'}
            </option>
          ) : (
            safeAccounts.map(
              (
                account
              ) => {
                const id =
                  account.id ||
                  account.loginid ||
                  '';

                return (
                  <option
                    key={
                      id
                    }
                    value={
                      id
                    }
                  >
                    {
                      accountOptionLabel(
                        account
                      )
                    }
                  </option>
                );
              }
            )
          )}
        </select>

        <p className="mt-1 text-[9px] text-slate-500">
          {safeAccounts.length >
          1
            ? `${safeAccounts.length} accounts available`
            : 'Current OAuth account'}
        </p>
      </div>

      <div className="min-w-[185px] border border-slate-700 rounded-xl px-3 py-2 text-right bg-[#080b11]">
        <div className="flex items-center justify-end gap-2">
          <span
            className={`h-2 w-2 rounded-full ${
              isLoading
                ? 'bg-amber-400'
                : isTradingConnected
                ? 'bg-emerald-400'
                : 'bg-rose-500'
            }`}
          />

          <p
            className={`text-[9px] uppercase font-black ${
              demo
                ? 'text-cyan-400'
                : 'text-rose-400'
            }`}
          >
            {demo
              ? 'Demo Account'
              : 'Real Account'}
          </p>
        </div>

        <p className="text-[10px] font-mono text-slate-400 mt-1">
          {accountId ||
            'No account'}
        </p>

        <p className="text-sm font-black font-mono text-emerald-400">
          {currency ||
            'USD'}{' '}
          {balance !==
            null &&
          balance !==
            undefined
            ? Number(
                balance
              ).toLocaleString(
                'en-US',
                {
                  minimumFractionDigits:
                    2,

                  maximumFractionDigits:
                    2,
                }
              )
            : '—'}
        </p>

        <p
          className={`mt-1 text-[9px] font-bold ${
            isLoading
              ? 'text-amber-400'
              : isTradingConnected
              ? 'text-emerald-500'
              : 'text-rose-400'
          }`}
        >
          {isLoading
            ? 'ACCOUNT LOADING...'
            : isTradingConnected
            ? 'TRADING SOCKET CONNECTED'
            : 'TRADING SOCKET DISCONNECTED'}
        </p>
      </div>

      <button
        type="button"
        onClick={
          onLogout
        }
        disabled={
          isLoading ||
          isLoggingOut
        }
        className="px-4 py-3 rounded-xl border border-rose-800 bg-rose-950/30 text-rose-300 text-xs font-black disabled:opacity-40"
      >
        {isLoggingOut
          ? 'LOGGING OUT...'
          : 'LOGOUT'}
      </button>
    </div>
  );
}

function Alert({
  children,
}) {
  return (
    <div className="mt-4 border border-rose-800 bg-rose-950/30 p-4 rounded-xl text-rose-300 text-sm">
      {children}
    </div>
  );
}
