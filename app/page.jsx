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

        recoveryTimerRef.current =
          null;
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
            ? `Auto bot stopped: ${reason}. In-flight BUY will still be accounted for.`
            : `Auto bot stopped: ${reason}`,
          'system'
        );
      },
      [addBotLog, syncRequestStatus]
    );

  const emergencyStop =
    useCallback(() => {
      emergencyStoppedRef.current =
        true;

      setEmergencyStopped(true);

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

      setBuyLoading(status.buyPending);

      syncRequestStatus();

      setAutoBotStatus(
        'EMERGENCY STOP ACTIVATED'
      );

      addBotLog(
        contractOpenRef.current ||
          status.buyPending
          ? 'EMERGENCY STOP: New entries blocked. Any already-purchased or in-flight contract will still be accounted for.'
          : 'EMERGENCY STOP: New entries blocked.',
        'error'
      );
    }, [addBotLog, syncRequestStatus]);

  const clearEmergencyStop = () => {
    const requestStatus =
      getRequestGuardStatus(
        requestGuardRef.current
      );

    if (
      contractOpenRef.current ||
      requestStatus.buyPending
    ) {
      setBuyError(
        'Wait for the active or in-flight contract purchase to finish first.'
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

        tradingPingRef.current =
          null;
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

      proposalPendingRef.current =
        false;

      buyPendingRef.current = false;

      requestGuardRef.current =
        resetRequestGuard();

      setProposalLoading(false);
      setBuyLoading(false);

      setRequestStatusLabel(
        'Socket closed — requests reset'
      );

      setIsTradingConnected(false);
    }, [clearRecoveryTimer]);

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
          !Number.isFinite(
            parsedStake
          ) ||
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
              id: contract.contract_id,
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

          addBotLog(
            `Next stake ${stakeResult.stake.toFixed(
              2
            )}`,
            'system'
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

          addBotLog(
            `Trade recorded. ${postSettlement.reason}`,
            'system'
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

          tradingPingRef.current =
            null;
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

            // ==================================================
            // CLASSIFIED DERIV ERROR HANDLING
            // ==================================================

            if (data.error) {
              const message =
                data.error.message ||
                'Deriv rejected the request.';

              let matchedProposal =
                false;

              let proposalOwner = '';

              let matchedBuy = false;
              let buyOwner = '';

              // ----------------------------------------------
              // Resolve proposal ownership first.
              // ----------------------------------------------

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

                  setProposalLoading(
                    false
                  );

                  setProposalError(
                    message
                  );

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

              // ----------------------------------------------
              // Resolve BUY ownership first.
              // ----------------------------------------------

              if (data.echo_req?.buy) {
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

              // ----------------------------------------------
              // Contract monitor errors require recovery.
              // ----------------------------------------------

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

                addBotLog(
                  'Active contract remains tracked. A fresh recovery session has been queued.',
                  'system'
                );

                queueContractRecovery();

                return;
              }

              // ----------------------------------------------
              // Only critical auto proposal / BUY errors stop bot.
              // ----------------------------------------------

              if (
                classification.action ===
                  SOCKET_ERROR_ACTION.STOP_BOT &&
                classification.stopBot &&
                autoBotRunningRef.current
              ) {
                stopAutoBot(message);
                return;
              }

              // ----------------------------------------------
              // Balance / forget / ping / stale / unknown errors
              // are logged without stopping the bot.
              // ----------------------------------------------

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

              setCurrency(
                nextCurrency
              );

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
                addBotLog(
                  `Ignored stale proposal response${
                    resolved.match.reqId !==
                    null
                      ? ` #${resolved.match.reqId}`
                      : ''
                  }.`,
                  'system'
                );

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
                  addBotLog(
                    'Auto proposal returned after bot stop. Purchase cancelled.',
                    'system'
                  );

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

                requestGuardRef.current =
                  registration.guard;

                syncRequestStatus();

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

              addBotLog(
                `Manual proposal ready: ${data.proposal.id}. Freshness timer started.`,
                'success'
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
                  `Ignored unmatched BUY response${
                    resolved.match.reqId !==
                    null
                      ? ` #${resolved.match.reqId}`
                      : ''
                  }.`,
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

              if (!isAutoOwner(owner)) {
                clearManualProposal();
              }

              const contractId =
                data.buy.contract_id;

              if (!contractId) {
                if (
                  isAutoOwner(owner)
                ) {
                  stopAutoBot(
                    'No contract ID returned.'
                  );
                }

                return;
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
              } else {
                addBotLog(
                  `Recovery registration warning: ${recoveryRegistration.reason}`,
                  'error'
                );
              }

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
                } demo contract purchased #${contractId} | Req #${resolved.match.reqId}`,
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

                addBotLog(
                  `Contract #${contract.contract_id} monitor recovered successfully.`,
                  'success'
                );
              } else {
                syncRecoveryLabel();
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

            tradingPingRef.current =
              null;
          }

          setIsTradingConnected(false);

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
        handleAutoSettlement,
        queueContractRecovery,
        registerRecoveryFailure,
        stopAutoBot,
        syncLifecycleLabel,
        syncRecoveryBackoff,
        syncRecoveryLabel,
        syncRequestStatus,
      ]
    );

  connectTradingSocketRef.current =
    connectTradingSocket;

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

        addBotLog(
          `Recovery attempt ${permission.attempts + 1}/${permission.maxAttempts} for contract #${status.contractId}.`,
          'system'
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

        if (!data.wsUrl) {
          throw new Error(
            'Recovery session did not return a fresh WebSocket URL.'
          );
        }

        if (
          !connectTradingSocketRef.current
        ) {
          throw new Error(
            'Trading socket recovery handler is unavailable.'
          );
        }

        addBotLog(
          `Fresh recovery session received for ${status.accountId}.`,
          'system'
        );

        connectTradingSocketRef.current(
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

    addBotLog(
      `Manual recovery retry started for contract #${recoveryStatus.contractId}.`,
      'system'
    );

    queueContractRecovery(0);
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
            Array.isArray(
              data.accounts
            )
              ? data.accounts
              : []
          );

          if (!data.account) {
            setAuthError(
              'No Deriv Options account was found.'
            );
            return;
          }

          setAccountId(
            data.account.id || ''
          );

          accountIdRef.current =
            data.account.id || '';

          setSelectedAccountId(
            data.account.id || ''
          );

          setAccountType(
            data.account.type || ''
          );

          accountTypeRef.current =
            data.account.type || '';

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
          syncRecoveryLabel();
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

          if (data.wsUrl) {
            connectTradingSocket(
              data.wsUrl
            );
          } else {
            closeTradingSocket();

            if (data.error) {
              setAuthError(data.error);
            }
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
        clearRecoveryTimer,
        closeTradingSocket,
        connectTradingSocket,
        syncLifecycleLabel,
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

    loadDerivSession();

    return () => {
      clearRecoveryTimer();
      closeTradingSocket();
    };
  }, [
    clearRecoveryTimer,
    closeTradingSocket,
    loadDerivSession,
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

      if (
        contractOpenRef.current ||
        requestStatus.buyPending ||
        (recoveryStatus.hasContract &&
          !recoveryStatus.settled)
      ) {
        setAuthError(
          'Wait for the active or recovering contract to settle before switching accounts.'
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
            if (
              data.subscription?.id
            ) {
              publicSubscriptionRef.current =
                data.subscription.id;
            }

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
        } catch (error) {
          console.error(
            'Market message error:',
            error
          );
        }
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

        publicPingRef.current =
          null;
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
    const result =
      evaluateEntrySignal({
        strategy,
        digitHistory:
          digitHistoryRef.current,
        predictionDigit,
      });

    setSignal(result);
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

      const verifierData =
        new TextEncoder().encode(
          verifier
        );

      const digest =
        await crypto.subtle.digest(
          'SHA-256',
          verifierData
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
    const recoveryStatus =
      getContractRecoveryStatus(
        recoveryRef.current
      );

    if (
      recoveryStatus.hasContract &&
      !recoveryStatus.settled
    ) {
      setBuyError(
        'Wait for the active or recovering contract to settle before starting another bot session.'
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

    if (
      contractOpenRef.current
    ) {
      setBuyError(
        'Wait for the active contract to settle.'
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
      startingStake.toFixed(2)
    );

    cooldownUntilRef.current = 0;

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
      `SOCKET ERROR GUARD ACTIVE — ${strategy}`,
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

      setProposalClock(Date.now());
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

    const recoveryStatus =
      getContractRecoveryStatus(
        recoveryRef.current
      );

    if (
      recoveryStatus.hasContract &&
      !recoveryStatus.settled
    ) {
      setBuyError(
        'A contract is still active or recovering.'
      );
      return;
    }

    const guardStatus =
      getRequestGuardStatus(
        requestGuardRef.current
      );

    if (guardStatus.buyPending) {
      setBuyError(
        'A purchase request is already in flight.'
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

    requestGuardRef.current =
      registration.guard;

    syncRequestStatus();

    buyPendingRef.current = true;

    setBuyLoading(true);
    setBuyError('');

    addBotLog(
      `Manual proposal ${proposalData.id} passed freshness guard. BUY sent with ${Math.ceil(
        freshnessPermission.remainingMs /
          1000
      )}s freshness remaining.`,
      'trade'
    );

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

    addBotLog(
      `Public market feed switching to ${nextSymbol}. Authenticated trading socket remains unchanged.`,
      'system'
    );
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

    if (
      isAutoBotRunning ||
      contractOpenRef.current ||
      requestStatus.proposalPending ||
      requestStatus.buyPending ||
      (recoveryStatus.hasContract &&
        !recoveryStatus.settled)
    ) {
      return;
    }

    tradeCountRef.current = 0;
    totalProfitRef.current = 0;

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
      Number(baseStake) || 1;

    currentStakeRef.current = base;

    setCurrentStake(
      base.toFixed(2)
    );

    cooldownUntilRef.current = 0;

    lifecycleRef.current =
      createTradeLifecycle();

    requestGuardRef.current =
      resetRequestGuard();

    recoveryRef.current =
      clearContractRecovery();

    recoveryBackoffRef.current =
      resetRecoveryBackoff(
        recoveryBackoffRef.current
      );

    proposalFreshnessRef.current =
      clearProposalFreshness();

    clearRecoveryTimer();

    syncLifecycleLabel();
    syncRequestStatus();
    syncRecoveryLabel();
    syncRecoveryBackoff();

    setBotLogs([]);
    setProposalData(null);
    setProposalClock(Date.now());
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
      buyPending: buyLoading,
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
                  recoveryBackoffUi.exhausted
                    ? 'Trading Recovery Paused'
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

            <span
              className={`font-black ${
                lastTick !== null &&
                prevTick !== null &&
                lastTick >= prevTick
                  ? 'text-emerald-400'
                  : 'text-rose-400'
              }`}
            >
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
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-black font-black text-xl">
              BS
            </div>

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
            <div className="flex flex-wrap items-center gap-3">
              {accounts.length > 1 && (
                <select
                  value={
                    selectedAccountId
                  }
                  onChange={(event) =>
                    switchAccount(
                      event.target.value
                    )
                  }
                  disabled={
                    isAutoBotRunning ||
                    isContractOpen ||
                    buyLoading ||
                    (recoveryStatus.hasContract &&
                      !recoveryStatus.settled)
                  }
                  className="bg-[#151d2d] border border-slate-700 rounded-xl px-3 py-2 text-xs"
                >
                  {accounts.map(
                    (account) => (
                      <option
                        key={account.id}
                        value={account.id}
                      >
                        {account.type ===
                        'demo'
                          ? 'Demo'
                          : 'Real'}{' '}
                        — {account.id}
                      </option>
                    )
                  )}
                </select>
              )}

              <AccountCard
                accountType={
                  accountType
                }
                accountId={accountId}
                balance={balance}
                currency={currency}
              />
            </div>
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
              type="button"
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

        {activeTab ===
          'overview' && (
          <div className="space-y-6">
            <div className="rounded-3xl border border-slate-800 bg-[#0f1522] p-8 md:p-12">
              <span className="inline-flex rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-400 font-black">
                Socket Error Guard Active
              </span>

              <h1 className="mt-5 max-w-3xl text-4xl md:text-5xl font-black">
                Critical Errors Stop Trading.
                Harmless Errors Don&apos;t.
              </h1>

              <p className="mt-5 max-w-2xl text-slate-400">
                Proposal, BUY and live-contract monitor errors are
                handled according to their actual ownership and
                severity. Balance, cleanup, ping and unrelated socket
                errors are logged without unnecessarily stopping the
                demo bot.
              </p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatBox
                label="Session"
                value={
                  sessionStatus.label
                }
                accent="text-cyan-400"
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
                accent={
                  recoveryStatus.needsRecovery ||
                  recoveryStatus.recovering
                    ? 'text-amber-400'
                    : 'text-emerald-400'
                }
              />

              <StatBox
                label="Recovery Backoff"
                value={
                  recoveryBackoffUi.label
                }
                accent={
                  recoveryBackoffUi.exhausted
                    ? 'text-rose-400'
                    : recoveryBackoffUi.attempts >
                      0
                    ? 'text-amber-400'
                    : 'text-emerald-400'
                }
              />

              <StatBox
                label="Socket Error Guard"
                value={
                  socketErrorLabel
                }
                accent={
                  socketErrorLabel ===
                  'No socket errors'
                    ? 'text-emerald-400'
                    : 'text-amber-400'
                }
              />

              <StatBox
                label="Tick Precision"
                value={precisionLabel}
                accent={
                  usedPipSize
                    ? 'text-emerald-400'
                    : 'text-amber-400'
                }
              />

              <StatBox
                label="Manual Proposal"
                value={
                  proposalFreshnessStatus.label
                }
                accent={
                  proposalFreshnessStatus.fresh
                    ? 'text-emerald-400'
                    : proposalFreshnessStatus.expired
                    ? 'text-rose-400'
                    : 'text-slate-400'
                }
              />

              <StatBox
                label="Account Safety"
                value={
                  isDemoAccount
                    ? 'Demo execution'
                    : 'Real BUY blocked'
                }
                accent={
                  isDemoAccount
                    ? 'text-cyan-400'
                    : 'text-rose-400'
                }
              />
            </div>
          </div>
        )}

        {activeTab === 'bots' && (
          <div className="space-y-6">
            <div className="flex flex-wrap justify-between gap-4">
              <div>
                <h2 className="text-xl font-black">
                  Bot Studio
                </h2>

                <p className="mt-1 text-xs text-slate-400">
                  Demo automation with classified socket errors,
                  capped contract recovery and request protection.
                </p>
              </div>

              <span
                className={`px-3 py-1.5 rounded-full text-xs font-black ${
                  emergencyStopped
                    ? 'bg-rose-500/20 text-rose-400'
                    : recoveryBackoffUi.exhausted
                    ? 'bg-rose-500/20 text-rose-400'
                    : recoveryStatus.needsRecovery ||
                      recoveryStatus.recovering
                    ? 'bg-amber-500/15 text-amber-400'
                    : isAutoBotRunning
                    ? 'bg-emerald-500/15 text-emerald-400'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                {recoveryBackoffUi.exhausted
                  ? 'RECOVERY PAUSED'
                  : recoveryStatus.needsRecovery
                  ? 'RECOVERY REQUIRED'
                  : recoveryStatus.recovering
                  ? 'RECOVERING CONTRACT'
                  : sessionStatus.label}
              </span>
            </div>

            {recoveryBackoffUi.exhausted &&
              recoveryStatus.hasContract &&
              !recoveryStatus.settled && (
                <div className="border border-rose-700/50 bg-rose-950/20 rounded-2xl p-5">
                  <p className="text-sm font-black text-rose-300">
                    Automatic contract recovery is paused.
                  </p>

                  <p className="mt-2 text-xs text-slate-400">
                    The contract ID remains remembered after the
                    automatic retry limit.
                  </p>

                  <button
                    type="button"
                    onClick={
                      retryContractRecovery
                    }
                    className="mt-4 w-full py-3 bg-amber-400 text-black font-black rounded-xl"
                  >
                    RETRY RECOVERY
                  </button>
                </div>
              )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-[#0f1522] border border-slate-800 rounded-2xl p-6 space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                        proposalLoading ||
                        buyLoading ||
                        (recoveryStatus.hasContract &&
                          !recoveryStatus.settled)
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
                      onChange={(event) => {
                        clearManualProposal();
                        setStrategy(
                          event.target.value
                        );
                      }}
                      disabled={
                        isAutoBotRunning ||
                        isContractOpen ||
                        proposalLoading ||
                        buyLoading
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
                        type="number"
                        min="0"
                        max="9"
                        value={
                          predictionDigit
                        }
                        onChange={(
                          event
                        ) => {
                          clearManualProposal();
                          setPredictionDigit(
                            event.target.value
                          );
                        }}
                        disabled={
                          isAutoBotRunning ||
                          proposalLoading ||
                          buyLoading
                        }
                        className={
                          INPUT_CLASS
                        }
                      />
                    </Field>
                  )}

                  <Field label="Minimum Confidence %">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={
                        minimumConfidence
                      }
                      onChange={(event) =>
                        setMinimumConfidence(
                          event.target.value
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

                  <Field label="Base Stake">
                    <input
                      type="number"
                      min="0.35"
                      step="0.01"
                      value={baseStake}
                      onChange={(event) => {
                        clearManualProposal();

                        setBaseStake(
                          event.target.value
                        );

                        if (
                          !isAutoBotRunning
                        ) {
                          setCurrentStake(
                            event.target.value
                          );
                        }
                      }}
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
                      value={currentStake}
                      readOnly
                      className={`${INPUT_CLASS} text-amber-400`}
                    />
                  </Field>

                  <Field label="Maximum Stake">
                    <input
                      type="number"
                      min="0.35"
                      step="0.01"
                      value={maxStake}
                      onChange={(event) =>
                        setMaxStake(
                          event.target.value
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

                  <Field label="Duration (Ticks)">
                    <input
                      type="number"
                      min="1"
                      max="10"
                      value={duration}
                      onChange={(event) => {
                        clearManualProposal();

                        setDuration(
                          event.target.value
                        );
                      }}
                      disabled={
                        isAutoBotRunning
                      }
                      className={
                        INPUT_CLASS
                      }
                    />
                  </Field>

                  <Field label="Martingale Multiplier">
                    <input
                      type="number"
                      min="1"
                      step="0.1"
                      value={martingale}
                      onChange={(event) =>
                        setMartingale(
                          event.target.value
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
                      type="number"
                      min="1"
                      value={maxTrades}
                      onChange={(event) =>
                        setMaxTrades(
                          event.target.value
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
                      type="number"
                      min="0"
                      value={
                        cooldownSeconds
                      }
                      onChange={(event) =>
                        setCooldownSeconds(
                          event.target.value
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
                      type="number"
                      value={takeProfit}
                      onChange={(event) =>
                        setTakeProfit(
                          event.target.value
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
                      type="number"
                      value={stopLoss}
                      onChange={(event) =>
                        setStopLoss(
                          event.target.value
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
                      type="number"
                      min="1"
                      value={
                        maxConsecutiveLosses
                      }
                      onChange={(event) =>
                        setMaxConsecutiveLosses(
                          event.target.value
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

                {buyError && (
                  <Alert>⚠️ {buyError}</Alert>
                )}

                {proposalError && (
                  <Alert>
                    ⚠️ {proposalError}
                  </Alert>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {!isAutoBotRunning ? (
                    <button
                      type="button"
                      onClick={startAutoBot}
                      disabled={
                        !isDemoAccount ||
                        !isTradingConnected ||
                        isContractOpen ||
                        emergencyStopped ||
                        proposalLoading ||
                        buyLoading ||
                        (recoveryStatus.hasContract &&
                          !recoveryStatus.settled)
                      }
                      className="py-4 bg-emerald-500 disabled:opacity-40 text-black font-black rounded-xl"
                    >
                      ▶ START SAFE SIGNAL BOT
                    </button>
                  ) : (
                    <button
                      type="button"
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
                    type="button"
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

                {emergencyStopped && (
                  <button
                    type="button"
                    onClick={
                      clearEmergencyStop
                    }
                    disabled={
                      isContractOpen ||
                      buyLoading
                    }
                    className="w-full py-3 bg-slate-700 disabled:opacity-40 font-black rounded-xl"
                  >
                    CLEAR EMERGENCY STOP
                  </button>
                )}

                <button
                  type="button"
                  onClick={
                    resetSessionStats
                  }
                  disabled={
                    isAutoBotRunning ||
                    isContractOpen ||
                    proposalLoading ||
                    buyLoading ||
                    (recoveryStatus.hasContract &&
                      !recoveryStatus.settled)
                  }
                  className="w-full py-3 bg-slate-800 disabled:opacity-40 font-black rounded-xl"
                >
                  RESET SESSION
                </button>

                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  <StatusCard
                    label="Bot Status"
                    value={
                      autoBotStatus
                    }
                    accent="text-cyan-400"
                  />

                  <StatusCard
                    label="Request Guard"
                    value={
                      requestStatusLabel
                    }
                    accent="text-emerald-400"
                  />

                  <StatusCard
                    label="Socket Error Guard"
                    value={
                      socketErrorLabel
                    }
                    accent={
                      socketErrorLabel ===
                      'No socket errors'
                        ? 'text-emerald-400'
                        : 'text-amber-400'
                    }
                  />

                  <StatusCard
                    label="Contract Recovery"
                    value={
                      recoveryLabel
                    }
                    accent="text-emerald-400"
                  />

                  <StatusCard
                    label="Recovery Backoff"
                    value={
                      recoveryBackoffUi.label
                    }
                    accent="text-emerald-400"
                  />

                  <StatusCard
                    label="Trade Lifecycle"
                    value={
                      lifecycleLabel
                    }
                    accent="text-amber-400"
                  />
                </div>

                {activeContract && (
                  <div className="border border-amber-500/30 bg-amber-500/5 rounded-2xl p-5">
                    <div className="flex justify-between flex-wrap gap-3">
                      <div>
                        <p className="text-xs uppercase font-black text-amber-400">
                          Contract Monitor
                        </p>

                        <p className="text-xs font-mono text-slate-500 mt-1">
                          #
                          {
                            activeContract.contractId
                          }
                        </p>
                      </div>

                      <span className="px-3 py-1 rounded-full bg-slate-800 text-xs font-black">
                        {contractStatus}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
                      <StatBox
                        label="Buy Price"
                        value={
                          activeContract.buyPrice ??
                          '-'
                        }
                      />

                      <StatBox
                        label="Payout"
                        value={
                          activeContract.payout ??
                          '-'
                        }
                      />

                      <StatBox
                        label="Current Spot"
                        value={
                          activeContract.currentSpot ??
                          '-'
                        }
                        accent="text-cyan-400"
                      />

                      <StatBox
                        label="Live P/L"
                        value={
                          contractProfit !==
                          null
                            ? `${
                                Number(
                                  contractProfit
                                ) >= 0
                                  ? '+'
                                  : ''
                              }${Number(
                                contractProfit
                              ).toFixed(2)}`
                            : '-'
                        }
                        accent={
                          Number(
                            contractProfit
                          ) >= 0
                            ? 'text-emerald-400'
                            : 'text-rose-400'
                        }
                      />
                    </div>
                  </div>
                )}

                {!isAutoBotRunning &&
                  !isContractOpen &&
                  !emergencyStopped &&
                  !(
                    recoveryStatus.hasContract &&
                    !recoveryStatus.settled
                  ) && (
                    <div className="border-t border-slate-800 pt-6">
                      <p className="text-xs uppercase font-black text-slate-500 mb-3">
                        Manual Demo Test
                      </p>

                      <div className="grid sm:grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={
                            requestManualProposal
                          }
                          disabled={
                            proposalLoading ||
                            buyLoading ||
                            !isTradingConnected
                          }
                          className="py-3 bg-cyan-500 disabled:opacity-40 text-black font-black rounded-xl"
                        >
                          {proposalLoading
                            ? 'REQUESTING...'
                            : proposalFreshnessStatus.expired
                            ? 'GET FRESH PROPOSAL'
                            : 'GET PROPOSAL'}
                        </button>

                        <button
                          type="button"
                          onClick={
                            buyManualDemoProposal
                          }
                          disabled={
                            !proposalData ||
                            !proposalFreshnessStatus.fresh ||
                            buyLoading ||
                            proposalLoading ||
                            !isDemoAccount
                          }
                          className="py-3 bg-amber-400 disabled:opacity-40 text-black font-black rounded-xl"
                        >
                          {buyLoading
                            ? 'BUYING...'
                            : proposalFreshnessStatus.expired
                            ? 'PROPOSAL EXPIRED'
                            : 'BUY DEMO CONTRACT'}
                        </button>
                      </div>
                    </div>
                  )}
              </div>

              <div className="bg-[#0f1522] border border-slate-800 rounded-2xl p-5">
                <h3 className="text-xs uppercase font-black">
                  Session Performance
                </h3>

                <div className="grid grid-cols-2 gap-2 mt-4">
                  <StatBox
                    label="Trades"
                    value={tradeCount}
                  />

                  <StatBox
                    label="Win Rate"
                    value={`${winRate}%`}
                    accent="text-cyan-400"
                  />

                  <StatBox
                    label="Wins"
                    value={winCount}
                    accent="text-emerald-400"
                  />

                  <StatBox
                    label="Losses"
                    value={lossCount}
                    accent="text-rose-400"
                  />

                  <StatBox
                    label="Net P/L"
                    value={`${
                      totalProfit >= 0
                        ? '+'
                        : ''
                    }${totalProfit.toFixed(
                      2
                    )}`}
                    accent={
                      totalProfit >= 0
                        ? 'text-emerald-400'
                        : 'text-rose-400'
                    }
                  />

                  <StatBox
                    label="Loss Streak"
                    value={
                      consecutiveLosses
                    }
                    accent="text-amber-400"
                  />
                </div>

                <div className="mt-4 bg-[#080b11] border border-slate-800 rounded-xl p-3 max-h-[520px] overflow-y-auto space-y-2">
                  {botLogs.length === 0 ? (
                    <p className="text-center text-xs text-slate-600 py-10">
                      Bot activity will appear here.
                    </p>
                  ) : (
                    botLogs.map(
                      (log, index) => (
                        <div
                          key={`${log.time}-${index}`}
                          className="border border-slate-800 p-2 rounded-lg text-xs font-mono"
                        >
                          <span className="text-slate-600">
                            [{log.time}]{' '}
                          </span>

                          <span
                            className={
                              log.type ===
                              'error'
                                ? 'text-rose-300'
                                : log.type ===
                                  'success'
                                ? 'text-emerald-300'
                                : log.type ===
                                  'trade'
                                ? 'text-cyan-300'
                                : 'text-slate-400'
                            }
                          >
                            {log.message}
                          </span>
                        </div>
                      )
                    )
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab ===
          'history' && (
          <div className="bg-[#0f1522] border border-slate-800 rounded-2xl p-6">
            <h2 className="text-xl font-black">
              Session Trade History
            </h2>

            {tradeHistory.length ===
            0 ? (
              <div className="py-16 text-center text-sm text-slate-600">
                No settled contracts yet.
              </div>
            ) : (
              <div className="mt-6 space-y-3">
                {tradeHistory.map(
                  (trade) => (
                    <div
                      key={trade.id}
                      className="grid grid-cols-2 md:grid-cols-6 gap-3 bg-[#080b11] border border-slate-800 rounded-xl p-4"
                    >
                      <HistoryValue
                        label="Contract"
                        value={`#${trade.id}`}
                      />

                      <HistoryValue
                        label="Result"
                        value={trade.result}
                      />

                      <HistoryValue
                        label="Stake"
                        value={Number(
                          trade.stake
                        ).toFixed(2)}
                      />

                      <HistoryValue
                        label="P/L"
                        value={`${
                          trade.profit >= 0
                            ? '+'
                            : ''
                        }${trade.profit.toFixed(
                          2
                        )}`}
                      />

                      <HistoryValue
                        label="Strategy"
                        value={
                          trade.strategy
                        }
                      />

                      <HistoryValue
                        label="Time"
                        value={trade.time}
                      />
                    </div>
                  )
                )}
              </div>
            )}
          </div>
        )}

        {activeTab ===
          'analyzer' && (
          <div className="space-y-6">
            <div className="bg-[#0f1522] border border-slate-800 p-6 rounded-2xl">
              <h2 className="text-xl font-black">
                Digit Analyzer
              </h2>

              <p className="text-xs text-slate-400 mt-1">
                {analysis.sampleSize} recent ticks on {symbol}
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
        className={`mt-1 text-lg font-black font-mono ${accent}`}
      >
        {value}
      </p>
    </div>
  );
}

function StatusCard({
  label,
  value,
  accent = 'text-white',
}) {
  return (
    <div className="border border-slate-800 rounded-2xl p-5">
      <p className="text-[10px] uppercase text-slate-500 font-black">
        {label}
      </p>

      <p
        className={`mt-2 font-mono font-black text-xs ${accent}`}
      >
        {value}
      </p>
    </div>
  );
}

function HistoryValue({
  label,
  value,
}) {
  return (
    <div>
      <p className="text-[9px] uppercase text-slate-600">
        {label}
      </p>

      <p className="mt-1 text-xs font-mono font-black break-all">
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
    <div
      className={`border rounded-xl px-3 py-2 text-right ${
        demo
          ? 'border-cyan-700 bg-cyan-950/20'
          : 'border-rose-700 bg-rose-950/20'
      }`}
    >
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
    <div className="border border-rose-800 bg-rose-950/30 p-4 rounded-xl text-rose-300 text-sm">
      {children}
    </div>
  );
}
