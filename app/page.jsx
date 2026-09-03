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
  allowManualRecoveryRetry,
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

const CLIENT_ID =
  '34hh45FQkPfMgbgj20uoR';

const REDIRECT_URI =
  'https://binaryspot-pro-v2.vercel.app/auth/deriv/callback';

const PUBLIC_WS_URL =
  'wss://api.derivws.com/trading/v1/options/ws/public';

const INPUT_CLASS =
  'w-full mt-2 bg-[#151d2d] border border-slate-700 p-3 rounded-xl text-sm text-slate-100 font-mono disabled:opacity-50';

export default function BinarySpotPro() {
  const [isLoading, setIsLoading] =
    useState(true);

  const [isConnecting, setIsConnecting] =
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
  ] = useState('60');

  const [signal, setSignal] = useState({
    shouldTrade: false,
    confidence: 0,
    reason: 'Waiting for market data.',
    sampleSize: 0,
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

  const publicSubscriptionRef =
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
    useRef(60);

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

  const clearRecoveryTimer =
    useCallback(() => {
      if (recoveryTimerRef.current) {
        clearTimeout(
          recoveryTimerRef.current
        );

        recoveryTimerRef.current = null;
      }
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

  const clearReconciliationRequests =
    useCallback(() => {
      reconciliationRequestRef.current = {
        portfolioReqId: null,
        profitTableReqId: null,
      };
    }, []);

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

      pendingBuyRecoveryRef.current =
        clearPendingBuyRecovery();

      pendingBuyReconciliationRef.current =
        clearPendingBuyReconciliation();

      pendingReconciliationFetchRef.current =
        false;

      clearReconciliationRequests();

      setProposalLoading(false);
      setBuyLoading(false);

      setRequestStatusLabel(
        'Socket closed — requests reset'
      );

      syncPendingBuyRecovery();
      syncPendingBuyReconciliation();

      setIsTradingConnected(false);
    },
    [
      clearRecoveryTimer,
      clearReconciliationRequests,
      syncPendingBuyRecovery,
      syncPendingBuyReconciliation,
    ]
  );

  const buildProposalPayload =
    useCallback(
      (
        stakeAmount,
        signalPrediction = null
      ) => {
        const parsedStake =
          Number(stakeAmount);

        const parsedDuration =
          Number(durationRef.current);

        const currentStrategy =
          strategyRef.current;

        const currentSymbol =
          symbolRef.current;

        const prediction =
          signalPrediction !== null &&
          signalPrediction !== undefined
            ? Number(signalPrediction)
            : Number(
                predictionDigitRef.current
              );

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
          [
            'DIGITDIFF',
            'DIGITMATCH',
            'DIGITOVER',
            'DIGITUNDER',
          ].includes(currentStrategy)
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
        }

        const payload = {
          proposal: 1,
          amount: Number(
            parsedStake.toFixed(2)
          ),
          basis: 'stake',
          contract_type:
            currentStrategy,
          currency:
            currencyRef.current ||
            'USD',
          duration: parsedDuration,
          duration_unit: 't',
          underlying_symbol:
            currentSymbol,
          req_id: nextReqId(),
        };

        if (
          [
            'DIGITDIFF',
            'DIGITMATCH',
            'DIGITOVER',
            'DIGITUNDER',
          ].includes(currentStrategy)
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
              entrySignal?.predictionDigit
            );

          const registration =
            beginProposalRequest(
              requestGuardRef.current,
              {
                reqId: payload.req_id,
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
            `ENTRY SIGNAL — ${confidence.toFixed(
              1
            )}% confidence`
          );

          addBotLog(
            `ENTRY | ${strategyRef.current} | ${symbolRef.current} | Confidence ${confidence.toFixed(
              1
            )}% | Stake ${currencyRef.current} ${stake.toFixed(
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
            digitHistory: history,
            predictionDigit:
              predictionDigitRef.current,
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
              result: result.result,
              profit: result.profit,
              stake: tradeStake,
              strategy:
                contract.contract_type ||
                strategyRef.current,
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
            contractOpen: false,
            proposalPending: false,
            buyPending: false,
            cooldownUntil:
              cooldownUntilRef.current,
          });

        setAutoBotStatus(
          sessionStatus.label
        );

        addBotLog(
          'Contract settled. Waiting for the next valid strategy signal.',
          'system'
        );
      },
      [
        addBotLog,
        stopAutoBot,
        syncLifecycleLabel,
      ]
    );

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
              'Reconciliation found an open position but no usable contract ID. Trading remains frozen.'
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
              resolved.reason ||
                'Unable to resolve the uncertain BUY.'
            );
            return;
          }

          pendingBuyRecoveryRef.current =
            resolved.recovery;

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
              recoveryRegistration.reason ||
                'Unable to register the recovered contract.'
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

          if (
            accountTypeRef.current ===
            'demo'
          ) {
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
          }

          pendingBuyRecoveryRef.current =
            clearPendingBuyRecovery();

          requestGuardRef.current =
            resetRequestGuard();

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
              'A possible settled BUY was found, but it has no usable contract ID. BinarySpot will not automatically clear the ambiguity.'
            );

            addBotLog(
              'Reconciliation found a historical transaction without a usable contract ID. Manual review required.',
              'error'
            );

            return;
          }

          const resolved =
            resolvePendingBuyWithContract(
              pendingBuyRecoveryRef.current,
              candidate.contractId
            );

          if (!resolved.valid) {
            setBuyError(
              resolved.reason ||
                'Unable to resolve the settled BUY.'
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

          const owner =
            pendingStatus.owner ===
            'auto'
              ? 'auto'
              : 'manual';

          const tradeStake =
            Number(
              candidate.buyPrice ??
                pendingStatus.expectedStake ??
                0
            );

          tradeCountRef.current += 1;

          setTradeCount(
            tradeCountRef.current
          );

          totalProfitRef.current =
            Number(
              (
                totalProfitRef.current +
                safeProfit
              ).toFixed(2)
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
                  result.profit,
                stake:
                  Number.isFinite(
                    tradeStake
                  )
                    ? tradeStake
                    : 0,
                strategy:
                  candidate.contractType ||
                  pendingStatus.strategy ||
                  strategyRef.current,
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

          lifecycleRef.current =
            beginTradeLifecycle({
              mode: owner,
            });

          lifecycleRef.current =
            attachContractToLifecycle(
              lifecycleRef.current,
              candidate.contractId
            );

          lifecycleRef.current =
            markLifecycleSettled(
              lifecycleRef.current,
              candidate.contractId
            );

          pendingBuyRecoveryRef.current =
            clearPendingBuyRecovery();

          pendingBuyReconciliationRef.current =
            evaluated;

          requestGuardRef.current =
            resetRequestGuard();

          buyPendingRef.current = false;
          contractOpenRef.current = false;

          clearContractRecoveryRecord();

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
          syncLifecycleLabel();
          syncPersistedRecovery();

          addBotLog(
            `BUY reconciliation found settled contract #${candidate.contractId} | ${
              safeProfit >= 0
                ? '+'
                : ''
            }${safeProfit.toFixed(
              2
            )}`,
            result.won
              ? 'success'
              : result.lost
              ? 'error'
              : 'system'
          );

          return;
        }

        if (
          evaluated.state ===
          BUY_RECONCILIATION_STATE.NO_MATCH
        ) {
          setBuyError(
            'No sufficiently strong BUY match was found. Trading remains frozen so BinarySpot does not accidentally duplicate a position.'
          );

          setAutoBotStatus(
            'BUY reconciliation unresolved'
          );

          addBotLog(
            'BUY reconciliation completed with no safe match. New entries remain blocked.',
            'error'
          );

          return;
        }

        if (
          evaluated.state ===
          BUY_RECONCILIATION_STATE.AMBIGUOUS
        ) {
          setBuyError(
            'Multiple possible BUY matches were found. BinarySpot will not guess which contract belongs to this purchase.'
          );

          setAutoBotStatus(
            'Multiple BUY matches — review required'
          );

          addBotLog(
            'BUY reconciliation found multiple plausible contracts. New entries remain blocked.',
            'error'
          );
        }
      },
      [
        addBotLog,
        syncLifecycleLabel,
        syncPendingBuyReconciliation,
        syncPendingBuyRecovery,
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
            'Authenticated Deriv trading socket connected.',
            'system'
          );

          ws.send(
            JSON.stringify({
              balance: 1,
              subscribe: 1,
              req_id: nextReqId(),
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
            pendingStatus.ambiguous &&
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
                !portfolioRequest.valid ||
                !profitRequest.valid
              ) {
                const message =
                  portfolioRequest.reason ||
                  profitRequest.reason ||
                  'Unable to build reconciliation requests.';

                pendingBuyReconciliationRef.current =
                  failPendingBuyReconciliation(
                    pendingBuyReconciliationRef.current,
                    message
                  );

                pendingReconciliationFetchRef.current =
                  false;

                syncPendingBuyReconciliation();

                setBuyError(message);
              } else {
                reconciliationRequestRef.current =
                  {
                    portfolioReqId,
                    profitTableReqId,
                  };

                addBotLog(
                  `Checking Deriv portfolio and recent trade history for BUY #${pendingStatus.reqId}.`,
                  'system'
                );

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
                  tradingConnected: true,
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

                addBotLog(
                  `Recovering contract #${recoveryStatus.contractId} on fresh authenticated socket.`,
                  'system'
                );

                ws.send(
                  JSON.stringify(
                    recoveryRequest.payload
                  )
                );
              } else {
                registerRecoveryFailure(
                  `Recovery request could not be built: ${recoveryRequest.reason}.`
                );
              }
            } else {
              registerRecoveryFailure(
                `Contract recovery blocked: ${permission.reason}.`
              );
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

                setAutoBotStatus(
                  'BUY reconciliation error'
                );

                addBotLog(
                  `BUY reconciliation error: ${message}`,
                  'error'
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
                if (
                  classification.stopBot &&
                  autoBotRunningRef.current
                ) {
                  stopAutoBot(
                    'Active contract monitor failed. Contract recovery started.'
                  );
                }

                if (
                  recoveryStatus.recovering
                ) {
                  registerRecoveryFailure(
                    `Contract recovery request failed: ${message}.`
                  );

                  return;
                }

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
                data.portfolio ??
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
                data.profit_table ??
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
              setBalance(
                data.balance.balance
              );

              const nextCurrency =
                data.balance.currency ||
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
                      reqId: buyReqId,
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
                      reqId: buyReqId,
                      proposalId:
                        data.proposal.id,
                      accountId:
                        accountIdRef.current,
                      accountType:
                        accountTypeRef.current,
                      owner: 'auto',
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

                pendingBuyReconciliationRef.current =
                  clearPendingBuyReconciliation();

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
                  `AUTO BUY sent | Req #${buyReqId}`,
                  'trade'
                );

                ws.send(
                  JSON.stringify({
                    buy:
                      data.proposal.id,
                    price: askPrice,
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

              const pendingResolution =
                resolvePendingBuyWithContract(
                  pendingBuyRecoveryRef.current,
                  contractId
                );

              if (
                pendingResolution.valid
              ) {
                pendingBuyRecoveryRef.current =
                  pendingResolution.recovery;

                syncPendingBuyRecovery();
              }

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
                  const persisted =
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

                  if (persisted.saved) {
                    syncPersistedRecovery();
                  }
                }
              }

              pendingBuyRecoveryRef.current =
                clearPendingBuyRecovery();

              pendingBuyReconciliationRef.current =
                clearPendingBuyReconciliation();

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
                } demo contract purchased #${contractId}`,
                'success'
              );

              ws.send(
                JSON.stringify({
                  proposal_open_contract:
                    1,
                  contract_id:
                    contractId,
                  subscribe: 1,
                  req_id: nextReqId(),
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
                  isSold: Boolean(
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

              try {
                ws.send(
                  JSON.stringify({
                    balance: 1,
                    req_id:
                      nextReqId(),
                  })
                );
              } catch {}

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

          if (
            pendingStatus.ambiguous
          ) {
            pendingReconciliationFetchRef.current =
              false;

            const reconciliationStatus =
              getPendingBuyReconciliationStatus(
                pendingBuyReconciliationRef.current
              );

            if (
              reconciliationStatus.searching
            ) {
              pendingBuyReconciliationRef.current =
                failPendingBuyReconciliation(
                  pendingBuyReconciliationRef.current,
                  'Reconciliation socket closed before both account-history checks completed.'
                );

              syncPendingBuyReconciliation();
            }

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

            if (
              recoveryFetchRunningRef.current
            ) {
              recoveryFetchRunningRef.current =
                false;

              registerRecoveryFailure(
                'Recovery WebSocket connection closed before the contract monitor was restored.'
              );

              return;
            }

            setContractStatus(
              'RECOVERY REQUIRED'
            );

            addBotLog(
              `Trading socket disconnected while contract #${recoveryStatus.contractId} is active. Recovery queued.`,
              'error'
            );

            if (
              autoBotRunningRef.current
            ) {
              stopAutoBot(
                'Trading socket disconnected. Recovering active contract.'
              );
            }

            queueContractRecovery();
            return;
          }

          recoveryFetchRunningRef.current =
            false;

          if (
            autoBotRunningRef.current
          ) {
            stopAutoBot(
              'Trading socket closed.'
            );
          }
        };
      },
      [
        addBotLog,
        clearManualProposal,
        clearRecoveryTimer,
        clearReconciliationRequests,
        finalizePendingBuyReconciliation,
        handleAutoSettlement,
        queueContractRecovery,
        registerRecoveryFailure,
        stopAutoBot,
        syncLifecycleLabel,
        syncPendingBuyReconciliation,
        syncPendingBuyRecovery,
        syncPersistedRecovery,
        syncRecoveryBackoff,
        syncRecoveryLabel,
        syncRequestStatus,
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

      if (!pendingStatus.ambiguous) {
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

      if (
        !pendingStatus.accountId
      ) {
        setBuyError(
          'The uncertain BUY has no account identity.'
        );
        return;
      }

      const validation =
        validatePendingBuyContext(
          pendingBuyRecoveryRef.current,
          {
            accountId:
              accountIdRef.current,
            accountType:
              accountTypeRef.current,
          }
        );

      if (!validation.valid) {
        setBuyError(
          validation.reason
        );
        return;
      }

      pendingReconciliationFetchRef.current =
        true;

      const reconciliationStart =
        beginPendingBuyReconciliation(
          pendingBuyRecoveryRef.current
        );

      pendingBuyRecoveryRef.current =
        reconciliationStart;

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

      addBotLog(
        `Starting BUY reconciliation for request #${pendingStatus.reqId}.`,
        'system'
      );

      try {
        const response = await fetch(
          `/api/auth/deriv/session?account_id=${encodeURIComponent(
            pendingStatus.accountId
          )}`,
          {
            method: 'GET',
            credentials: 'include',
            cache: 'no-store',
          }
        );

        const data =
          await response.json();

        if (
          !response.ok ||
          !data.authenticated
        ) {
          throw new Error(
            data.error ||
              'Unable to create a fresh reconciliation session.'
          );
        }

        if (
          !data.account ||
          data.account.id !==
            pendingStatus.accountId
        ) {
          throw new Error(
            'Reconciliation returned the wrong Deriv account.'
          );
        }

        if (
          data.account.type !==
          'demo'
        ) {
          throw new Error(
            'BUY reconciliation is restricted to demo accounts.'
          );
        }

        if (!data.wsUrl) {
          throw new Error(
            'Deriv did not return a fresh authenticated WebSocket URL.'
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
          `BUY reconciliation failed: ${
            error.message ||
            'Unknown error'
          }`
        );

        setAutoBotStatus(
          'BUY reconciliation error'
        );

        addBotLog(
          `BUY reconciliation failed: ${
            error.message ||
            'Unknown error'
          }`,
          'error'
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
        setContractStatus(
          'RECONNECTING'
        );

        const response = await fetch(
          `/api/auth/deriv/session?account_id=${encodeURIComponent(
            status.accountId
          )}`,
          {
            method: 'GET',
            credentials: 'include',
            cache: 'no-store',
          }
        );

        const data =
          await response.json();

        if (
          !response.ok ||
          !data.authenticated
        ) {
          throw new Error(
            data.error ||
              'Unable to refresh authenticated Deriv session.'
          );
        }

        if (
          !data.account ||
          data.account.id !==
            status.accountId
        ) {
          throw new Error(
            'Recovery session returned the wrong Deriv account.'
          );
        }

        if (
          data.account.type !==
          'demo'
        ) {
          throw new Error(
            'Persistent recovery is restricted to demo accounts.'
          );
        }

        if (!data.wsUrl) {
          throw new Error(
            'Recovery session did not return a fresh WebSocket URL.'
          );
        }

        connectTradingSocketRef.current?.(
          data.wsUrl
        );
      } catch (error) {
        recoveryFetchRunningRef.current =
          false;

        registerRecoveryFailure(
          `Recovery attempt failed: ${
            error.message ||
            'Unknown recovery error'
          }.`
        );
      }
    };

  const retryContractRecovery = () => {
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

    if (
      recoveryFetchRunningRef.current
    ) {
      return;
    }

    clearRecoveryTimer();

    recoveryBackoffRef.current =
      allowManualRecoveryRetry(
        recoveryBackoffRef.current
      );

    recoveryRef.current =
      markContractDisconnected(
        recoveryRef.current
      );

    syncRecoveryLabel();
    syncRecoveryBackoff();

    setContractStatus(
      'MANUAL RECOVERY'
    );

    queueContractRecovery(0);
  };

  const retryPendingBuyReconciliation =
    () => {
      const pendingStatus =
        getPendingBuyRecoveryStatus(
          pendingBuyRecoveryRef.current
        );

      if (!pendingStatus.ambiguous) {
        return;
      }

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
            await fetch(endpoint, {
              method: 'GET',
              credentials: 'include',
              cache: 'no-store',
            });

          const data =
            await response.json();

          if (
            !response.ok ||
            !data.authenticated
          ) {
            setIsAuthorized(false);
            closeTradingSocket();

            if (
              response.status !== 401 &&
              data.error
            ) {
              setAuthError(data.error);
            }

            return;
          }

          setIsAuthorized(true);

          setAccounts(
            Array.isArray(data.accounts)
              ? data.accounts
              : []
          );

          if (!data.account) {
            setAuthError(
              'No Deriv Options account was found.'
            );
            return;
          }

          const nextAccountId =
            data.account.id || '';

          const nextAccountType =
            data.account.type || '';

          setAccountId(nextAccountId);

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
            data.account.currency ||
              'USD'
          );

          currencyRef.current =
            data.account.currency ||
            'USD';

          autoBotRunningRef.current =
            false;

          setIsAutoBotRunning(false);

          proposalPendingRef.current =
            false;

          buyPendingRef.current = false;

          contractOpenRef.current =
            false;

          cooldownUntilRef.current = 0;

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

          syncLifecycleLabel();
          syncRequestStatus();
          syncPendingBuyRecovery();
          syncPendingBuyReconciliation();
          syncRecoveryBackoff();

          setSocketErrorLabel(
            'No socket errors'
          );

          setProposalData(null);
          setProposalClock(Date.now());
          setProposalError('');
          setBuyError('');
          setActiveContract(null);
          setContractProfit(null);

          setContractStatus(
            'No active contract'
          );

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
                  isSold: false,
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

                syncLifecycleLabel();
                syncRecoveryLabel();

                addBotLog(
                  `Refresh recovery restored contract #${record.contractId}. Automated trading remains stopped.`,
                  'system'
                );

                setAutoBotStatus(
                  'Persisted contract recovery'
                );
              }
            } else {
              syncRecoveryLabel();
            }
          } else {
            syncRecoveryLabel();
          }

          syncPersistedRecovery();

          if (data.wsUrl) {
            connectTradingSocket(
              data.wsUrl
            );
          } else {
            closeTradingSocket();
          }
        } catch (error) {
          console.error(error);

          setAuthError(
            'Unable to load your Deriv account.'
          );

          closeTradingSocket();
        } finally {
          setIsLoading(false);
        }
      },
      [
        addBotLog,
        clearRecoveryTimer,
        clearReconciliationRequests,
        closeTradingSocket,
        connectTradingSocket,
        syncLifecycleLabel,
        syncPendingBuyReconciliation,
        syncPendingBuyRecovery,
        syncPersistedRecovery,
        syncRecoveryBackoff,
        syncRecoveryLabel,
        syncRequestStatus,
      ]
    );

  useEffect(() => {
    const params =
      new URLSearchParams(
        window.location.search
      );

    const derivError =
      params.get('deriv_error');

    const derivConnected =
      params.get(
        'deriv_connected'
      );

    if (derivError) {
      setAuthError(derivError);
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
    syncPendingBuyRecovery();
    syncPendingBuyReconciliation();

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
  ]);

  const switchAccount =
    async (newAccountId) => {
      if (
        !newAccountId ||
        newAccountId ===
          selectedAccountId
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
        (recoveryStatus.hasContract &&
          !recoveryStatus.settled)
      ) {
        setAuthError(
          'Resolve the active, recovering, or uncertain BUY before switching accounts.'
        );
        return;
      }

      stopAutoBot(
        'Switching accounts'
      );

      clearManualProposal();

      await loadDerivSession(
        newAccountId
      );
    };

  useEffect(() => {
    let ws;

    try {
      ws = new WebSocket(
        PUBLIC_WS_URL
      );

      publicWsRef.current = ws;

      ws.onopen = () => {
        setIsMarketConnected(true);

        ws.send(
          JSON.stringify({
            ticks: symbol,
            subscribe: 1,
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

      ws.onmessage = (event) => {
        try {
          const data =
            JSON.parse(event.data);

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
              (previous) => {
                setPrevTick(previous);

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
                100
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
        setIsMarketConnected(false);
      };

      ws.onclose = () => {
        setIsMarketConnected(false);
      };
    } catch {
      setIsMarketConnected(false);
    }

    return () => {
      if (publicPingRef.current) {
        clearInterval(
          publicPingRef.current
        );

        publicPingRef.current = null;
      }

      if (ws) {
        try {
          ws.onclose = null;
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
      })
    );
  }, [
    strategy,
    predictionDigit,
  ]);

  const connectDeriv = async () => {
    try {
      setAuthError('');
      setIsConnecting(true);

      const chars =
        'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';

      const bytes =
        new Uint8Array(64);

      crypto.getRandomValues(bytes);

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
          .replace(/\+/g, '-')
          .replace(/\//g, '_')
          .replace(/=+$/, '');

      const stateBytes =
        new Uint8Array(16);

      crypto.getRandomValues(
        stateBytes
      );

      const state =
        Array.from(stateBytes)
          .map((byte) =>
            byte
              .toString(16)
              .padStart(2, '0')
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

      const authUrl = new URL(
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
      setIsConnecting(false);

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
      Number(baseStake);

    setBuyError('');
    setProposalError('');

    tradeCountRef.current = 0;
    totalProfitRef.current = 0;

    consecutiveLossesRef.current = 0;

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
      startingStake.toFixed(2)
    );

    cooldownUntilRef.current = 0;

    lifecycleRef.current =
      createTradeLifecycle();

    recoveryRef.current =
      clearContractRecovery();

    pendingBuyRecoveryRef.current =
      clearPendingBuyRecovery();

    pendingBuyReconciliationRef.current =
      clearPendingBuyReconciliation();

    clearReconciliationRequests();

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

    autoBotRunningRef.current = true;

    setIsAutoBotRunning(true);

    setAutoBotStatus(
      'Scanning Market'
    );

    addBotLog(
      `PENDING BUY GUARD ACTIVE — ${strategy}`,
      'system'
    );

    const initialSignal =
      evaluateEntrySignal({
        strategy,
        digitHistory:
          digitHistoryRef.current,
        predictionDigit,
      });

    setSignal(initialSignal);

    if (
      initialSignal.shouldTrade &&
      Number(
        initialSignal.confidence
      ) >=
        Number(minimumConfidence)
    ) {
      requestAutoProposal(
        initialSignal
      );
    }
  };

  const requestManualProposal = () => {
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

      const payload =
        buildProposalPayload(
          Number(baseStake)
        );

      const registration =
        beginProposalRequest(
          requestGuardRef.current,
          {
            reqId: payload.req_id,
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
        JSON.stringify(payload)
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

  const buyManualDemoProposal = () => {
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
          now: Date.now(),
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
      !Number.isFinite(price) ||
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
      lifecycleRef.current?.mode !==
      'manual'
    ) {
      lifecycleRef.current =
        beginTradeLifecycle({
          mode: 'manual',
        });

      syncLifecycleLabel();
    }

    const buyReqId =
      nextReqId();

    const registration =
      beginBuyRequest(
        requestGuardRef.current,
        {
          reqId: buyReqId,
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
          reqId: buyReqId,
          proposalId:
            proposalData.id,
          accountId:
            accountIdRef.current,
          accountType:
            accountTypeRef.current,
          owner: 'manual',
          symbol:
            symbolRef.current,
          strategy:
            strategyRef.current,
          expectedStake: price,
          startedAt: Date.now(),
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

    pendingBuyReconciliationRef.current =
      clearPendingBuyReconciliation();

    syncRequestStatus();
    syncPendingBuyRecovery();
    syncPendingBuyReconciliation();

    buyPendingRef.current = true;

    setBuyLoading(true);
    setBuyError('');

    ws.send(
      JSON.stringify({
        buy: proposalData.id,
        price,
        req_id: buyReqId,
      })
    );
  };

  const applySuggestedDigit = () => {
    const suggestion =
      getSuggestedDigit(
        strategy,
        digitHistoryRef.current
      );

    setPredictionDigit(
      String(suggestion)
    );
  };

  const changeSymbol = (nextSymbol) => {
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

    symbolRef.current = nextSymbol;

    setSymbol(nextSymbol);

    digitHistoryRef.current = [];

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

  const resetSessionStats = () => {
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
      (recoveryStatus.hasContract &&
        !recoveryStatus.settled)
    ) {
      return;
    }

    tradeCountRef.current = 0;
    totalProfitRef.current = 0;

    consecutiveLossesRef.current = 0;

    setTradeCount(0);
    setWinCount(0);
    setLossCount(0);
    setDrawCount(0);
    setConsecutiveLosses(0);
    setTotalProfit(0);
    setTradeHistory([]);

    const base =
      Number(baseStake) || 1;

    currentStakeRef.current = base;

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

    clearReconciliationRequests();

    recoveryRef.current =
      clearContractRecovery();

    recoveryBackoffRef.current =
      resetRecoveryBackoff(
        recoveryBackoffRef.current
      );

    proposalFreshnessRef.current =
      clearProposalFreshness();

    clearContractRecoveryRecord();

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

    setAutoBotStatus('Standby');
  };

  const analysis =
    buildDigitAnalysis(
      digitHistory
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
    [
      'DIGITDIFF',
      'DIGITMATCH',
      'DIGITOVER',
      'DIGITUNDER',
    ].includes(strategy);

  const displayQuote =
    formattedTick ||
    (lastTick !== null
      ? String(lastTick)
      : 'Waiting...');

  const completedTrades =
    winCount +
    lossCount +
    drawCount;

  const winRate =
    completedTrades > 0
      ? (
          (winCount /
            completedTrades) *
          100
        ).toFixed(1)
      : '0.0';

  const sessionStatus =
    buildSessionStatus({
      running: isAutoBotRunning,
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
      proposalClock || Date.now()
    );

  return (
    <main className="min-h-screen bg-[#080b11] text-slate-100">
      <div className="border-b border-slate-800 bg-[#0e131d] px-4 py-2.5">
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
                activeLabel="Trading Socket Active"
                inactiveLabel={
                  pendingBuyStatus.ambiguous
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
            <div className="text-lg font-black">
              BINARY
              <span className="text-emerald-400">
                SPOT
              </span>{' '}
              PRO
            </div>

            <p className="text-[9px] uppercase tracking-widest font-bold text-emerald-500">
              Algorithmic Hub
            </p>
          </div>

          {!isAuthorized ? (
            <button
              type="button"
              onClick={connectDeriv}
              disabled={
                isLoading ||
                isConnecting
              }
              className="px-4 py-3 bg-emerald-500 disabled:opacity-40 text-black font-black text-xs rounded-xl"
            >
              CONNECT DERIV
            </button>
          ) : (
            <AccountCard
              accountType={accountType}
              accountId={accountId}
              balance={balance}
              currency={currency}
            />
          )}
        </div>
      </header>

      <div className="border-b border-slate-800 bg-[#0b1019]">
        <div className="max-w-7xl mx-auto px-4 py-2 flex gap-2 overflow-x-auto">
          {[
            ['overview', '🏠 Overview'],
            ['bots', '🤖 Bot Studio'],
            ['history', '📜 History'],
            [
              'analyzer',
              '📊 Digit Analyzer',
            ],
          ].map(([id, label]) => (
            <button
              key={id}
              onClick={() =>
                setActiveTab(id)
              }
              className={`px-4 py-2 rounded-xl text-xs font-black whitespace-nowrap ${
                activeTab === id
                  ? 'bg-emerald-500 text-black'
                  : 'bg-slate-900 border border-slate-800 text-slate-400'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <section className="max-w-7xl mx-auto px-4 py-8">
        {authError && (
          <Alert>⚠️ {authError}</Alert>
        )}

        {pendingBuyStatus.ambiguous && (
          <div className="mb-6 border border-rose-700 bg-rose-950/30 rounded-2xl p-5">
            <p className="font-black text-rose-300">
              ⚠️ BUY OUTCOME UNKNOWN
            </p>

            <p className="mt-2 text-sm text-slate-300">
              BinarySpot sent BUY request #
              {pendingBuyStatus.reqId}, but
              the connection disappeared
              before the contract ID was
              received.
            </p>

            <p className="mt-2 text-xs text-slate-400">
              New contracts remain blocked
              while BinarySpot checks the
              same demo account for the
              missing purchase.
            </p>

            <div className="mt-4 rounded-xl border border-slate-800 bg-black/20 p-3">
              <p className="text-xs font-black text-cyan-300">
                {reconciliationLabel}
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
            <div className="rounded-3xl border border-slate-800 bg-[#0f1522] p-8 md:p-12">
              <span className="inline-flex rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-400 font-black">
                BUY Reconciliation Active
              </span>

              <h1 className="mt-5 max-w-3xl text-4xl md:text-5xl font-black">
                Unknown Purchases Are Checked Before Another Entry Is Allowed.
              </h1>

              <p className="mt-5 max-w-2xl text-slate-400">
                BinarySpot checks both open
                positions and recent settled
                demo trades when a BUY
                response is lost. It only
                restores a position when the
                match is sufficiently strong.
              </p>
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
                label="Pending BUY Safety"
                value={
                  pendingBuyLabel
                }
                accent={
                  pendingBuyStatus.ambiguous
                    ? 'text-rose-400'
                    : pendingBuyStatus.blocking
                    ? 'text-amber-400'
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
                label="Socket Error Guard"
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
                value={precisionLabel}
                accent="text-emerald-400"
              />

              <StatBox
                label="Manual Proposal"
                value={
                  proposalFreshnessStatus.label
                }
                accent="text-slate-400"
              />
            </div>
          </div>
        )}

        {activeTab === 'bots' && (
          <div className="space-y-6">
            <div className="bg-[#0f1522] border border-slate-800 rounded-2xl p-6">
              <h2 className="text-xl font-black">
                Bot Studio
              </h2>

              <p className="mt-2 text-sm text-slate-400">
                Demo-only execution remains
                enforced.
              </p>

              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
                <Field label="Synthetic Asset">
                  <select
                    value={symbol}
                    onChange={(event) =>
                      changeSymbol(
                        event.target.value
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
                      Volatility 100 (1s)
                    </option>
                  </select>
                </Field>

                <Field label="Strategy">
                  <select
                    value={strategy}
                    onChange={(event) =>
                      setStrategy(
                        event.target.value
                      )
                    }
                    disabled={
                      isAutoBotRunning ||
                      pendingBuyStatus.blocking
                    }
                    className={
                      INPUT_CLASS
                    }
                  >
                    <option value="DIGITDIFF">
                      Digit Differs
                    </option>

                    <option value="DIGITMATCH">
                      Digit Matches
                    </option>

                    <option value="DIGITEVEN">
                      Digit Even
                    </option>

                    <option value="DIGITODD">
                      Digit Odd
                    </option>

                    <option value="DIGITOVER">
                      Digit Over
                    </option>

                    <option value="DIGITUNDER">
                      Digit Under
                    </option>
                  </select>
                </Field>

                {needsPredictionDigit && (
                  <Field label="Prediction / Barrier">
                    <input
                      value={
                        predictionDigit
                      }
                      onChange={(event) =>
                        setPredictionDigit(
                          event.target.value
                        )
                      }
                      className={
                        INPUT_CLASS
                      }
                    />
                  </Field>
                )}

                <Field label="Base Stake">
                  <input
                    value={baseStake}
                    onChange={(event) =>
                      setBaseStake(
                        event.target.value
                      )
                    }
                    className={
                      INPUT_CLASS
                    }
                  />
                </Field>

                <Field label="Maximum Stake">
                  <input
                    value={maxStake}
                    onChange={(event) =>
                      setMaxStake(
                        event.target.value
                      )
                    }
                    className={
                      INPUT_CLASS
                    }
                  />
                </Field>

                <Field label="Minimum Confidence">
                  <input
                    value={
                      minimumConfidence
                    }
                    onChange={(event) =>
                      setMinimumConfidence(
                        event.target.value
                      )
                    }
                    className={
                      INPUT_CLASS
                    }
                  />
                </Field>
              </div>

              {buyError && (
                <Alert>
                  ⚠️ {buyError}
                </Alert>
              )}

              <div className="grid sm:grid-cols-2 gap-3 mt-6">
                {!isAutoBotRunning ? (
                  <button
                    onClick={startAutoBot}
                    disabled={
                      !isDemoAccount ||
                      !isTradingConnected ||
                      isContractOpen ||
                      pendingBuyStatus.blocking ||
                      emergencyStopped
                    }
                    className="py-4 bg-emerald-500 disabled:opacity-40 text-black font-black rounded-xl"
                  >
                    ▶ START SAFE SIGNAL BOT
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
                  onClick={emergencyStop}
                  disabled={
                    emergencyStopped
                  }
                  className="py-4 bg-rose-600 disabled:opacity-40 text-white font-black rounded-xl"
                >
                  🛑 EMERGENCY STOP
                </button>
              </div>

              {!isAutoBotRunning &&
                !isContractOpen &&
                !pendingBuyStatus.blocking && (
                  <div className="border-t border-slate-800 mt-6 pt-6 grid sm:grid-cols-2 gap-3">
                    <button
                      onClick={
                        requestManualProposal
                      }
                      disabled={
                        proposalLoading ||
                        !isTradingConnected
                      }
                      className="py-3 bg-cyan-500 disabled:opacity-40 text-black font-black rounded-xl"
                    >
                      GET PROPOSAL
                    </button>

                    <button
                      onClick={
                        buyManualDemoProposal
                      }
                      disabled={
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
                )}

              {activeContract && (
                <div className="mt-6 border border-amber-500/30 bg-amber-500/5 rounded-2xl p-5">
                  <p className="text-xs text-amber-400 font-black">
                    CONTRACT #
                    {activeContract.contractId}
                  </p>

                  <p className="mt-2 font-black">
                    {contractStatus}
                  </p>

                  <p className="mt-2 font-mono text-emerald-400">
                    P/L:{' '}
                    {contractProfit !==
                    null
                      ? Number(
                          contractProfit
                        ).toFixed(2)
                      : '-'}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="bg-[#0f1522] border border-slate-800 rounded-2xl p-6">
            <h2 className="text-xl font-black">
              Session Trade History
            </h2>

            {tradeHistory.length ===
            0 ? (
              <p className="py-14 text-center text-slate-500">
                No settled contracts yet.
              </p>
            ) : (
              <div className="mt-6 space-y-3">
                {tradeHistory.map(
                  (trade) => (
                    <div
                      key={trade.id}
                      className="border border-slate-800 rounded-xl p-4"
                    >
                      <p className="font-mono">
                        #{trade.id} —{' '}
                        {trade.result} —{' '}
                        {trade.profit}
                        {trade.recovered
                          ? ' — RECOVERED'
                          : ''}
                      </p>
                    </div>
                  )
                )}
              </div>
            )}
          </div>
        )}

        {activeTab ===
          'analyzer' && (
          <div className="bg-[#0f1522] border border-slate-800 p-6 rounded-2xl">
            <h2 className="text-xl font-black">
              Digit Analyzer
            </h2>

            <p className="text-xs text-slate-400 mt-2">
              {analysis.sampleSize} recent
              ticks
            </p>

            <div className="grid grid-cols-5 sm:grid-cols-10 gap-2 mt-6">
              {analysis.percentages.map(
                (item) => (
                  <div
                    key={item.digit}
                    className="bg-[#080b11] border border-slate-800 rounded-xl p-3 text-center"
                  >
                    <p className="font-black">
                      {item.digit}
                    </p>

                    <p className="text-xs text-cyan-400 mt-2">
                      {
                        item.percentage
                      }
                      %
                    </p>
                  </div>
                )
              )}
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
  accountType,
  accountId,
  balance,
  currency,
}) {
  const demo =
    accountType === 'demo';

  return (
    <div className="border border-slate-700 rounded-xl px-3 py-2 text-right">
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

      <p className="text-[10px] font-mono text-slate-400">
        {accountId}
      </p>

      <p className="text-sm font-black font-mono text-emerald-400">
        {currency}{' '}
        {balance !== null
          ? Number(balance).toLocaleString(
              'en-US',
              {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              }
            )
          : '0.00'}
      </p>
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
