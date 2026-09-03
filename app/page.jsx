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

import {
  persistPendingBuyRecovery,
  loadPendingBuyRecoveryRecord,
  clearPendingBuyRecoveryRecord,
  canRestoreStoredPendingBuy,
  getStoredPendingBuyStatus,
} from '../lib/pendingBuyRecoveryStorage';

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

        tradeCountRef.current =
          settlement.nextTradeCount;

        consecutiveLossesRef.current =
          settlement.nextConsecutiveLosses;

        setTotalProfit(
          settlement.nextTotalProfit
        );

        setTradeCount(
          settlement.nextTradeCount
        );

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
                Number(
                  contract.buy_price ??
                    currentStakeRef.current
                ),
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

        setAutoBotStatus(
          'Waiting for next valid signal'
        );
      },
      [
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
              'Recovered position has no usable contract ID.'
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

          contractOpenRef.current = true;
          buyPendingRef.current = false;

          setActiveContract({
            contractId,
            buyPrice:
              candidate.buyPrice ??
              pendingStatus.expectedStake,
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
          syncPersistedRecovery();

          addBotLog(
            `Recovered live contract #${contractId} after BUY reconciliation.`,
            'success'
          );

          if (
            ws?.readyState ===
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
              'A historical match was found without a usable contract ID. Trading remains blocked.'
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
                  candidate.contractType ||
                  pendingStatus.strategy,
                symbol:
                  candidate.symbol ||
                  pendingStatus.symbol,
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
            isSold: true,
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
            'Recovered settled BUY'
          );

          syncPendingBuyRecovery();
          syncRequestStatus();

          addBotLog(
            `Recovered settled contract #${candidate.contractId}.`,
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
        syncPendingBuyReconciliation,
        syncPendingBuyRecovery,
        syncPersistedRecovery,
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

          const pendingNeedsReconciliation =
            pendingStatus.blocking &&
            [
              'ambiguous',
              'reconciling',
            ].includes(
              pendingStatus.state
            );

          if (
            pendingNeedsReconciliation &&
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

              const request =
                buildContractRecoveryRequest(
                  recoveryRef.current,
                  nextReqId()
                );

              if (request.valid) {
                ws.send(
                  JSON.stringify(
                    request.payload
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

            const isPortfolioResponse =
              data.req_id ===
              reconciliationRequests.portfolioReqId;

            const isProfitResponse =
              data.req_id ===
              reconciliationRequests.profitTableReqId;

            if (data.error) {
              const message =
                data.error.message ||
                'Deriv rejected the request.';

              if (
                isPortfolioResponse ||
                isProfitResponse
              ) {
                pendingBuyReconciliationRef.current =
                  failPendingBuyReconciliation(
                    pendingBuyReconciliationRef.current,
                    message
                  );

                syncPendingBuyReconciliation();

                setBuyError(
                  `BUY reconciliation failed: ${message}`
                );

                return;
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
                  requestGuardRef.current =
                    resolved.guard;

                  proposalPendingRef.current =
                    false;

                  setProposalLoading(false);
                  setProposalError(message);

                  syncRequestStatus();
                }
              }

              return;
            }

            if (isPortfolioResponse) {
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

            if (isProfitResponse) {
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

              proposalPendingRef.current =
                false;

              setProposalLoading(false);
              setProposalError('');

              syncRequestStatus();

              const owner =
                resolved.match.owner;

              if (isAutoOwner(owner)) {
                if (
                  !autoBotRunningRef.current ||
                  emergencyStoppedRef.current ||
                  accountTypeRef.current !==
                    'demo'
                ) {
                  return;
                }

                const askPrice =
                  Number(
                    data.proposal.ask_price
                  );

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
                      reqId:
                        buyReqId,
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

                const persisted =
                  persistPendingBuyRecovery(
                    pendingBuyRecoveryRef.current
                  );

                if (!persisted.saved) {
                  stopAutoBot(
                    'Unable to persist pending BUY safety state.'
                  );
                  return;
                }

                syncStoredPendingBuy();
                syncPendingBuyRecovery();
                syncRequestStatus();

                buyPendingRef.current =
                  true;

                setBuyLoading(true);

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

              const freshness =
                registerProposalFreshness(
                  proposalFreshnessRef.current,
                  {
                    proposalId:
                      data.proposal.id,
                    createdAt:
                      Date.now(),
                  }
                );

              if (freshness.valid) {
                proposalFreshnessRef.current =
                  freshness.freshness;

                setProposalData(
                  data.proposal
                );

                setProposalClock(
                  Date.now()
                );
              }
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
                return;
              }

              const owner =
                resolved.match.owner;

              requestGuardRef.current =
                resolved.guard;

              buyPendingRef.current =
                false;

              setBuyLoading(false);

              syncRequestStatus();

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

                stopAutoBot(
                  'BUY returned without a contract ID.'
                );

                setTimeout(() => {
                  pendingReconciliationRunnerRef.current?.();
                }, 500);

                return;
              }

              clearStoredPendingBuy();

              pendingBuyRecoveryRef.current =
                clearPendingBuyRecovery();

              if (
                lifecycleRef.current
                  ?.mode !==
                (isAutoOwner(owner)
                  ? 'auto'
                  : 'manual')
              ) {
                lifecycleRef.current =
                  beginTradeLifecycle({
                    mode:
                      isAutoOwner(owner)
                        ? 'auto'
                        : 'manual',
                  });
              }

              lifecycleRef.current =
                attachContractToLifecycle(
                  lifecycleRef.current,
                  contractId
                );

              const registration =
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

              if (registration.valid) {
                recoveryRef.current =
                  registration.recovery;
              }

              persistLiveContractRecovery({
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
              });

              syncPersistedRecovery();
              syncPendingBuyRecovery();
              syncLifecycleLabel();
              syncRecoveryLabel();

              contractOpenRef.current =
                true;

              setActiveContract({
                contractId,
                buyPrice:
                  data.buy.buy_price ??
                  currentStakeRef.current,
                transactionId:
                  data.buy.transaction_id ??
                  null,
                isSold: false,
              });

              setContractProfit(0);
              setContractStatus('LIVE');

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

              if (
                getContractRecoveryStatus(
                  recoveryRef.current
                ).recovering
              ) {
                recoveryRef.current =
                  completeContractRecovery(
                    recoveryRef.current,
                    data.subscription?.id ||
                      null
                  );

                syncRecoveryLabel();
              }

              const safeProfit =
                Number(
                  contract.profit ?? 0
                ) || 0;

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

              recoveryRef.current =
                markRecoveredContractSettled(
                  recoveryRef.current,
                  contract.contract_id
                );

              clearContractRecoveryRecord();

              syncPersistedRecovery();
              syncRecoveryLabel();

              setContractStatus(
                String(
                  contract.status ||
                    'SETTLED'
                ).toUpperCase()
              );

              const autoContract =
                isAutoTrade(
                  lifecycleRef.current,
                  contract.contract_id
                );

              if (autoContract) {
                handleAutoSettlement(
                  contract
                );
              }
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

            persistPendingBuyRecovery(
              pendingBuyRecoveryRef.current
            );

            syncStoredPendingBuy();
            syncPendingBuyRecovery();

            setBuyLoading(false);

            setBuyError(
              'Connection disappeared after BUY. Reconciliation is required.'
            );

            stopAutoBot(
              'BUY outcome unknown.'
            );

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

            queueContractRecovery();

            return;
          }
        };
      },
      [
        clearStoredPendingBuy,
        finalizePendingBuyReconciliation,
        handleAutoSettlement,
        queueContractRecovery,
        stopAutoBot,
        syncLifecycleLabel,
        syncPendingBuyReconciliation,
        syncPendingBuyRecovery,
        syncPersistedRecovery,
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

      if (
        !pendingStatus.blocking ||
        ![
          'ambiguous',
          'reconciling',
        ].includes(
          pendingStatus.state
        )
      ) {
        return;
      }

      if (
        pendingReconciliationFetchRef.current
      ) {
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

      syncPendingBuyRecovery();
      syncPendingBuyReconciliation();

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
            error.message
          );

        syncPendingBuyReconciliation();

        setBuyError(
          error.message
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
        status.settled
      ) {
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
        const response = await fetch(
          `/api/auth/deriv/session?account_id=${encodeURIComponent(
            status.accountId
          )}`,
          {
            credentials: 'include',
            cache: 'no-store',
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
            return;
          }

          if (!data.account) {
            throw new Error(
              'No Deriv account found.'
            );
          }

          const nextAccountId =
            data.account.id;

          const nextAccountType =
            data.account.type;

          setIsAuthorized(true);

          setAccounts(
            Array.isArray(data.accounts)
              ? data.accounts
              : []
          );

          setAccountId(nextAccountId);
          setSelectedAccountId(
            nextAccountId
          );

          setAccountType(
            nextAccountType
          );

          setBalance(
            data.account.balance ??
              null
          );

          setCurrency(
            data.account.currency ||
              'USD'
          );

          accountIdRef.current =
            nextAccountId;

          accountTypeRef.current =
            nextAccountType;

          currencyRef.current =
            data.account.currency ||
            'USD';

          autoBotRunningRef.current =
            false;

          setIsAutoBotRunning(false);

          requestGuardRef.current =
            resetRequestGuard();

          recoveryRef.current =
            clearContractRecovery();

          pendingBuyRecoveryRef.current =
            clearPendingBuyRecovery();

          pendingBuyReconciliationRef.current =
            clearPendingBuyReconciliation();

          contractOpenRef.current =
            false;

          setActiveContract(null);
          setContractProfit(null);

          const storedPending =
            loadPendingBuyRecoveryRecord();

          let restoredPending = false;

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
            const permission =
              canRestoreStoredPendingBuy(
                storedPending.record,
                {
                  accountId:
                    nextAccountId,
                  accountType:
                    nextAccountType,
                }
              );

            if (permission.allowed) {
              const record =
                permission.record;

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

              if (registration.valid) {
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

                restoredPending = true;

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

          syncStoredPendingBuy();
          syncPendingBuyRecovery();
          syncPendingBuyReconciliation();

          if (!restoredPending) {
            const storedContract =
              loadContractRecoveryRecord();

            if (
              storedContract.found &&
              storedContract.valid &&
              storedContract.record
            ) {
              const permission =
                canRestoreStoredContract(
                  storedContract.record,
                  {
                    accountId:
                      nextAccountId,
                    accountType:
                      nextAccountType,
                  }
                );

              if (permission.allowed) {
                const record =
                  permission.record;

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

                if (registration.valid) {
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
                }
              }
            }
          }

          syncRecoveryLabel();
          syncPersistedRecovery();
          syncLifecycleLabel();
          syncRequestStatus();

          if (data.wsUrl) {
            connectTradingSocket(
              data.wsUrl
            );
          }
        } catch (error) {
          console.error(error);

          setAuthError(
            error.message ||
              'Unable to load Deriv.'
          );
        } finally {
          setIsLoading(false);
        }
      },
      [
        addBotLog,
        clearStoredPendingBuy,
        connectTradingSocket,
        syncLifecycleLabel,
        syncPendingBuyReconciliation,
        syncPendingBuyRecovery,
        syncPersistedRecovery,
        syncRecoveryLabel,
        syncRequestStatus,
        syncStoredPendingBuy,
      ]
    );

  useEffect(() => {
    syncPersistedRecovery();
    syncStoredPendingBuy();

    loadDerivSession();

    return () => {
      closeTradingSocket();
    };
  }, [
    closeTradingSocket,
    loadDerivSession,
    syncPersistedRecovery,
    syncStoredPendingBuy,
  ]);

  const requestAutoProposal =
    useCallback(
      (entrySignal) => {
        if (
          !canOpenAfterPendingBuy(
            pendingBuyRecoveryRef.current
          ).allowed
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
          return;
        }

        try {
          const payload =
            buildProposalPayload(
              currentStakeRef.current,
              entrySignal?.predictionDigit
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
            return;
          }

          requestGuardRef.current =
            registration.guard;

          proposalPendingRef.current =
            true;

          setProposalLoading(true);

          lifecycleRef.current =
            beginTradeLifecycle({
              mode: 'auto',
            });

          syncLifecycleLabel();
          syncRequestStatus();

          ws.send(
            JSON.stringify(payload)
          );
        } catch {}
      },
      [
        buildProposalPayload,
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
          });

        setSignal(result);

        if (
          !autoBotRunningRef.current ||
          !result.shouldTrade ||
          Number(result.confidence) <
            minimumConfidenceRef.current
        ) {
          return;
        }

        if (
          contractOpenRef.current ||
          proposalPendingRef.current ||
          buyPendingRef.current
        ) {
          return;
        }

        requestAutoProposal(
          result
        );
      },
      [requestAutoProposal]
    );

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
      };

      ws.onmessage = (event) => {
        try {
          const data =
            JSON.parse(event.data);

          if (
            data.msg_type !==
              'tick' ||
            !data.tick
          ) {
            return;
          }

          const precision =
            applyCachedPipSize(
              pipSizeCacheRef.current,
              data.tick
            );

          pipSizeCacheRef.current =
            precision.cache;

          const tick =
            normalizeDerivTick(
              precision.tick
            );

          if (!tick.valid) {
            return;
          }

          setLastTick(
            tick.quote
          );

          setFormattedTick(
            tick.formattedQuote
          );

          setLastDigit(
            tick.lastDigit
          );

          setPipSize(
            tick.pipSize
          );

          setPipSource(
            precision.source
          );

          const history =
            prependDigitToHistory(
              digitHistoryRef.current,
              tick.lastDigit,
              100
            );

          digitHistoryRef.current =
            history;

          setDigitHistory(history);

          evaluateAutoEntry(
            history
          );
        } catch {}
      };

      ws.onclose = () => {
        setIsMarketConnected(false);
      };
    } catch {}

    return () => {
      if (ws) {
        try {
          ws.close();
        } catch {}
      }
    };
  }, [
    evaluateAutoEntry,
    symbol,
  ]);

  const startAutoBot = () => {
    const permission =
      canOpenAfterPendingBuy(
        pendingBuyRecoveryRef.current
      );

    if (!permission.allowed) {
      setBuyError(
        permission.reason
      );
      return;
    }

    if (
      accountTypeRef.current !==
        'demo'
    ) {
      setBuyError(
        'Real-money trading is blocked.'
      );
      return;
    }

    if (
      contractOpenRef.current
    ) {
      return;
    }

    autoBotRunningRef.current = true;

    setIsAutoBotRunning(true);

    setAutoBotStatus(
      'Scanning Market'
    );
  };

  const requestManualProposal = () => {
    if (
      !canOpenAfterPendingBuy(
        pendingBuyRecoveryRef.current
      ).allowed
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
      return;
    }

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
      return;
    }

    requestGuardRef.current =
      registration.guard;

    proposalPendingRef.current = true;

    setProposalLoading(true);

    lifecycleRef.current =
      beginTradeLifecycle({
        mode: 'manual',
      });

    syncLifecycleLabel();
    syncRequestStatus();

    ws.send(
      JSON.stringify(payload)
    );
  };

  const buyManualDemoProposal = () => {
    if (
      accountTypeRef.current !==
        'demo' ||
      !proposalData?.id
    ) {
      return;
    }

    const price =
      Number(
        proposalData.ask_price
      );

    const reqId =
      nextReqId();

    const registration =
      beginBuyRequest(
        requestGuardRef.current,
        {
          reqId,
          owner:
            REQUEST_OWNER.MANUAL,
          proposalId:
            proposalData.id,
        }
      );

    if (!registration.valid) {
      return;
    }

    const pending =
      registerPendingBuy(
        pendingBuyRecoveryRef.current,
        {
          reqId,
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
          expectedStake:
            price,
          startedAt:
            Date.now(),
        }
      );

    if (!pending.valid) {
      return;
    }

    requestGuardRef.current =
      registration.guard;

    pendingBuyRecoveryRef.current =
      pending.recovery;

    const persisted =
      persistPendingBuyRecovery(
        pending.recovery
      );

    if (!persisted.saved) {
      setBuyError(
        'Could not persist pending BUY state.'
      );
      return;
    }

    syncStoredPendingBuy();
    syncPendingBuyRecovery();
    syncRequestStatus();

    buyPendingRef.current = true;

    setBuyLoading(true);

    tradingWsRef.current.send(
      JSON.stringify({
        buy:
          proposalData.id,
        price,
        req_id:
          reqId,
      })
    );
  };

  const analysis =
    buildDigitAnalysis(
      digitHistory
    );

  const pendingBuyStatus =
    getPendingBuyRecoveryStatus(
      pendingBuyRecoveryRef.current
    );

  const reconciliationStatus =
    getPendingBuyReconciliationStatus(
      pendingBuyReconciliationRef.current
    );

  const recoveryStatus =
    getContractRecoveryStatus(
      recoveryRef.current
    );

  const proposalFreshnessStatus =
    getProposalFreshnessStatus(
      proposalFreshnessRef.current,
      proposalClock ||
        Date.now()
    );

  return (
    <main className="min-h-screen bg-[#080b11] text-slate-100">
      <header className="border-b border-slate-800 bg-[#0d121c]">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between">
          <div>
            <div className="text-lg font-black">
              BINARY
              <span className="text-emerald-400">
                SPOT
              </span>{' '}
              PRO
            </div>

            <p className="text-[9px] uppercase tracking-widest text-emerald-500">
              Algorithmic Hub
            </p>
          </div>

          {isAuthorized && (
            <AccountCard
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
            />
          )}
        </div>
      </header>

      <section className="max-w-7xl mx-auto px-4 py-8 space-y-6">
        {pendingBuyStatus.blocking && (
          <div className="border border-rose-700 bg-rose-950/30 rounded-2xl p-5">
            <p className="font-black text-rose-300">
              ⚠️ BUY SAFETY LOCK
            </p>

            <p className="mt-2 text-sm text-slate-300">
              {
                pendingBuyLabel
              }
            </p>

            <p className="mt-2 text-xs text-cyan-300">
              {
                reconciliationLabel
              }
            </p>

            <p className="mt-2 text-xs text-slate-400">
              {
                persistedPendingBuyLabel
              }
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <StatBox
            label="Pending BUY"
            value={
              pendingBuyLabel
            }
          />

          <StatBox
            label="Stored BUY"
            value={
              persistedPendingBuyLabel
            }
          />

          <StatBox
            label="BUY Reconciliation"
            value={
              reconciliationLabel
            }
          />

          <StatBox
            label="Contract Recovery"
            value={
              recoveryLabel
            }
          />

          <StatBox
            label="Persisted Contract"
            value={
              persistedRecoveryLabel
            }
          />

          <StatBox
            label="Request Guard"
            value={
              requestStatusLabel
            }
          />
        </div>

        <div className="bg-[#0f1522] border border-slate-800 rounded-2xl p-6">
          <h2 className="text-xl font-black">
            Bot Studio
          </h2>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
            <Field label="Synthetic Asset">
              <select
                value={symbol}
                onChange={(e) => {
                  if (
                    !pendingBuyStatus.blocking
                  ) {
                    setSymbol(
                      e.target.value
                    );

                    symbolRef.current =
                      e.target.value;
                  }
                }}
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
                onChange={(e) =>
                  setStrategy(
                    e.target.value
                  )
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

            <Field label="Base Stake">
              <input
                value={baseStake}
                onChange={(e) =>
                  setBaseStake(
                    e.target.value
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
                onChange={(e) =>
                  setMaxStake(
                    e.target.value
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
                onChange={(e) =>
                  setMinimumConfidence(
                    e.target.value
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
            <button
              onClick={
                startAutoBot
              }
              disabled={
                accountType !==
                  'demo' ||
                pendingBuyStatus.blocking ||
                contractOpenRef.current
              }
              className="py-4 bg-emerald-500 disabled:opacity-40 text-black font-black rounded-xl"
            >
              ▶ START SAFE SIGNAL BOT
            </button>

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
          </div>

          {!pendingBuyStatus.blocking &&
            !contractOpenRef.current && (
              <div className="border-t border-slate-800 mt-6 pt-6 grid sm:grid-cols-2 gap-3">
                <button
                  onClick={
                    requestManualProposal
                  }
                  className="py-3 bg-cyan-500 text-black font-black rounded-xl"
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
                  BUY DEMO CONTRACT
                </button>
              </div>
            )}

          {activeContract && (
            <div className="mt-6 border border-amber-500/30 rounded-2xl p-5">
              <p className="text-amber-400 font-black">
                CONTRACT #
                {
                  activeContract.contractId
                }
              </p>

              <p className="mt-2 font-black">
                {
                  contractStatus
                }
              </p>

              <p className="mt-2 text-emerald-400 font-mono">
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

        <div className="bg-[#0f1522] border border-slate-800 rounded-2xl p-6">
          <h2 className="text-xl font-black">
            Digit Analyzer
          </h2>

          <p className="mt-2 text-slate-400">
            {analysis.sampleSize}{' '}
            recent ticks
          </p>

          <div className="grid grid-cols-5 sm:grid-cols-10 gap-2 mt-6">
            {analysis.percentages.map(
              (item) => (
                <div
                  key={
                    item.digit
                  }
                  className="bg-[#080b11] border border-slate-800 rounded-xl p-3 text-center"
                >
                  <p className="font-black">
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
                </div>
              )
            )}
          </div>
        </div>
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
}) {
  return (
    <div className="bg-[#080b11] border border-slate-800 rounded-xl p-3">
      <p className="text-[10px] uppercase text-slate-500">
        {label}
      </p>

      <p className="mt-1 text-sm font-black font-mono break-words text-emerald-400">
        {value}
      </p>
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
          ? Number(
              balance
            ).toLocaleString(
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
