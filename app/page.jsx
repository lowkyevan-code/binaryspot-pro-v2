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

const CLIENT_ID = '34hh45FQkPfMgbgj20uoR';

const REDIRECT_URI =
  'https://binaryspot-pro-v2.vercel.app/auth/deriv/callback';

const PUBLIC_WS_URL =
  'wss://api.derivws.com/trading/v1/options/ws/public';

const INPUT_CLASS =
  'w-full mt-2 bg-[#151d2d] border border-slate-700 p-3 rounded-xl text-sm text-slate-100 font-mono disabled:opacity-50';

export default function BinarySpotPro() {
  // ============================================================
  // AUTH
  // ============================================================

  const [isLoading, setIsLoading] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);

  const [isAuthorized, setIsAuthorized] = useState(false);

  const [isTradingConnected, setIsTradingConnected] =
    useState(false);

  const [accounts, setAccounts] = useState([]);

  const [selectedAccountId, setSelectedAccountId] =
    useState('');

  const [accountId, setAccountId] = useState('');
  const [accountType, setAccountType] = useState('');

  const [balance, setBalance] = useState(null);
  const [currency, setCurrency] = useState('USD');

  const [authError, setAuthError] = useState('');

  // ============================================================
  // NAVIGATION
  // ============================================================

  const [activeTab, setActiveTab] = useState('overview');

  // ============================================================
  // MARKET
  // ============================================================

  const [isMarketConnected, setIsMarketConnected] =
    useState(false);

  const [symbol, setSymbol] = useState('R_100');

  const [lastTick, setLastTick] = useState(null);
  const [prevTick, setPrevTick] = useState(null);

  const [lastDigit, setLastDigit] = useState(null);

  const [digitHistory, setDigitHistory] = useState([]);

  // ============================================================
  // STRATEGY
  // ============================================================

  const [strategy, setStrategy] = useState('DIGITDIFF');

  const [predictionDigit, setPredictionDigit] =
    useState('0');

  const [minimumConfidence, setMinimumConfidence] =
    useState('60');

  const [signal, setSignal] = useState({
    shouldTrade: false,
    confidence: 0,
    reason: 'Waiting for market data.',
    sampleSize: 0,
  });

  // ============================================================
  // BOT SETTINGS
  // ============================================================

  const [baseStake, setBaseStake] = useState('1.00');
  const [currentStake, setCurrentStake] = useState('1.00');

  const [duration, setDuration] = useState('1');

  const [martingale, setMartingale] = useState('2.00');

  const [takeProfit, setTakeProfit] = useState('10.00');
  const [stopLoss, setStopLoss] = useState('20.00');

  const [
    maxConsecutiveLosses,
    setMaxConsecutiveLosses,
  ] = useState('3');

  const [maxStake, setMaxStake] = useState('10.00');

  const [maxTrades, setMaxTrades] = useState('10');

  const [cooldownSeconds, setCooldownSeconds] =
    useState('2');

  // ============================================================
  // BOT SESSION
  // ============================================================

  const [isAutoBotRunning, setIsAutoBotRunning] =
    useState(false);

  const [autoBotStatus, setAutoBotStatus] =
    useState('Standby');

  const [emergencyStopped, setEmergencyStopped] =
    useState(false);

  const [totalProfit, setTotalProfit] = useState(0);

  const [tradeCount, setTradeCount] = useState(0);
  const [winCount, setWinCount] = useState(0);
  const [lossCount, setLossCount] = useState(0);

  const [
    consecutiveLosses,
    setConsecutiveLosses,
  ] = useState(0);

  const [botLogs, setBotLogs] = useState([]);
  const [tradeHistory, setTradeHistory] = useState([]);

  // ============================================================
  // PROPOSAL / CONTRACT
  // ============================================================

  const [proposalLoading, setProposalLoading] =
    useState(false);

  const [proposalError, setProposalError] = useState('');

  const [proposalData, setProposalData] =
    useState(null);

  const [buyLoading, setBuyLoading] = useState(false);

  const [buyError, setBuyError] = useState('');

  const [activeContract, setActiveContract] =
    useState(null);

  const [contractStatus, setContractStatus] =
    useState('No active contract');

  const [contractProfit, setContractProfit] =
    useState(null);

  // ============================================================
  // REFS
  // ============================================================

  const publicWsRef = useRef(null);
  const tradingWsRef = useRef(null);

  const publicSubscriptionRef = useRef(null);
  const contractSubscriptionRef = useRef(null);

  const publicPingRef = useRef(null);
  const tradingPingRef = useRef(null);

  const requestIdRef = useRef(1000);

  const autoBotRunningRef = useRef(false);
  const emergencyStoppedRef = useRef(false);

  const proposalPendingRef = useRef(false);
  const buyPendingRef = useRef(false);
  const contractOpenRef = useRef(false);

  const cooldownUntilRef = useRef(0);

  const digitHistoryRef = useRef([]);

  const accountTypeRef = useRef('');
  const currencyRef = useRef('USD');

  const strategyRef = useRef('DIGITDIFF');
  const predictionDigitRef = useRef('0');

  const minimumConfidenceRef = useRef(60);

  const baseStakeRef = useRef(1);
  const currentStakeRef = useRef(1);

  const durationRef = useRef(1);

  const martingaleRef = useRef(2);

  const takeProfitRef = useRef(10);
  const stopLossRef = useRef(20);

  const maxLossesRef = useRef(3);
  const maxStakeRef = useRef(10);
  const maxTradesRef = useRef(10);

  const cooldownSecondsRef = useRef(2);

  const totalProfitRef = useRef(0);
  const tradeCountRef = useRef(0);

  const consecutiveLossesRef = useRef(0);

  const settledContractRef = useRef(null);

  // ============================================================
  // KEEP REFS CURRENT
  // ============================================================

  useEffect(() => {
    autoBotRunningRef.current = isAutoBotRunning;
  }, [isAutoBotRunning]);

  useEffect(() => {
    emergencyStoppedRef.current = emergencyStopped;
  }, [emergencyStopped]);

  useEffect(() => {
    accountTypeRef.current = accountType;
  }, [accountType]);

  useEffect(() => {
    currencyRef.current = currency;
  }, [currency]);

  useEffect(() => {
    strategyRef.current = strategy;
  }, [strategy]);

  useEffect(() => {
    predictionDigitRef.current = predictionDigit;
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

  // ============================================================
  // HELPERS
  // ============================================================

  const nextReqId = () => {
    requestIdRef.current += 1;
    return requestIdRef.current;
  };

  const addBotLog = useCallback(
    (message, type = 'info') => {
      const time = new Date().toLocaleTimeString();

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

  const stopAutoBot = useCallback(
    (reason = 'Stopped manually') => {
      autoBotRunningRef.current = false;

      setIsAutoBotRunning(false);

      proposalPendingRef.current = false;
      buyPendingRef.current = false;

      setProposalLoading(false);
      setBuyLoading(false);

      setAutoBotStatus(reason);

      addBotLog(
        `Auto bot stopped: ${reason}`,
        'system'
      );
    },
    [addBotLog]
  );

  // ============================================================
  // SESSION STATUS
  // ============================================================

  const getLiveSessionStatus = useCallback(() => {
    return buildSessionStatus({
      running: autoBotRunningRef.current,

      emergencyStopped:
        emergencyStoppedRef.current,

      contractOpen:
        contractOpenRef.current,

      proposalPending:
        proposalPendingRef.current,

      buyPending:
        buyPendingRef.current,

      cooldownUntil:
        cooldownUntilRef.current,
    });
  }, []);

  // ============================================================
  // EMERGENCY STOP
  // ============================================================

  const emergencyStop = useCallback(() => {
    emergencyStoppedRef.current = true;

    setEmergencyStopped(true);

    autoBotRunningRef.current = false;

    setIsAutoBotRunning(false);

    proposalPendingRef.current = false;

    setProposalLoading(false);

    setAutoBotStatus(
      'EMERGENCY STOP ACTIVATED'
    );

    addBotLog(
      'EMERGENCY STOP: No new demo purchases will be sent. Any active contract can still settle.',
      'error'
    );
  }, [addBotLog]);

  const clearEmergencyStop = () => {
    if (contractOpenRef.current) {
      setBuyError(
        'Wait for the active contract to settle before clearing Emergency Stop.'
      );

      return;
    }

    emergencyStoppedRef.current = false;

    setEmergencyStopped(false);

    setBuyError('');

    setAutoBotStatus('Standby');

    addBotLog(
      'Emergency Stop cleared.',
      'system'
    );
  };

  // ============================================================
  // TRADING SOCKET CLEANUP
  // ============================================================

  const closeTradingSocket = useCallback(() => {
    if (tradingPingRef.current) {
      clearInterval(
        tradingPingRef.current
      );

      tradingPingRef.current = null;
    }

    if (tradingWsRef.current) {
      try {
        tradingWsRef.current.onclose = null;
        tradingWsRef.current.close();
      } catch {}

      tradingWsRef.current = null;
    }

    contractSubscriptionRef.current = null;

    proposalPendingRef.current = false;
    buyPendingRef.current = false;
    contractOpenRef.current = false;

    setIsTradingConnected(false);
  }, []);

  // ============================================================
  // BUILD PROPOSAL
  // ============================================================

  const buildProposalPayload = useCallback(
    (stakeAmount, signalPrediction = null) => {
      const parsedStake =
        Number(stakeAmount);

      const parsedDuration =
        Number(durationRef.current);

      const currentStrategy =
        strategyRef.current;

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
        !Number.isInteger(parsedDuration) ||
        parsedDuration < 1
      ) {
        throw new Error(
          'Duration must be at least 1 tick.'
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
          !Number.isInteger(prediction) ||
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

        duration:
          parsedDuration,

        duration_unit: 't',

        underlying_symbol:
          symbol,

        req_id:
          nextReqId(),
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
    [symbol]
  );

  // ============================================================
  // SAFETY-CHECKED ENTRY
  // ============================================================

  const requestAutoProposal = useCallback(
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
            tradingWsRef.current?.readyState ===
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

      if (
        Number(
          entrySignal?.confidence
        ) <
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
        const stake =
          currentStakeRef.current;

        const payload =
          buildProposalPayload(
            stake,
            entrySignal?.predictionDigit
          );

        proposalPendingRef.current = true;

        setProposalLoading(true);

        setProposalError('');

        setAutoBotStatus(
          `ENTRY SIGNAL — ${Number(
            entrySignal.confidence
          ).toFixed(1)}% confidence`
        );

        addBotLog(
          `ENTRY | ${strategyRef.current} | Confidence ${Number(
            entrySignal.confidence
          ).toFixed(
            1
          )}% | Stake ${currencyRef.current} ${stake.toFixed(
            2
          )}`,
          'trade'
        );

        ws.send(
          JSON.stringify(payload)
        );
      } catch (error) {
        proposalPendingRef.current = false;

        setProposalLoading(false);

        stopAutoBot(
          error.message ||
            'Proposal setup error'
        );
      }
    },
    [
      buildProposalPayload,
      addBotLog,
      stopAutoBot,
    ]
  );

  // ============================================================
  // ENTRY ENGINE
  // ============================================================

  const evaluateAutoEntry = useCallback(
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
            tradingWsRef.current?.readyState ===
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

          return;
        }

        const sessionStatus =
          getLiveSessionStatus();

        setAutoBotStatus(
          sessionStatus.label
        );

        return;
      }

      if (
        !result.shouldTrade
      ) {
        setAutoBotStatus(
          `WAIT — ${result.reason}`
        );

        return;
      }

      if (
        Number(
          result.confidence
        ) <
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

      requestAutoProposal(
        result
      );
    },
    [
      requestAutoProposal,
      stopAutoBot,
      getLiveSessionStatus,
    ]
  );

  // ============================================================
  // SETTLEMENT
  // ============================================================

  const handleSettledContract = useCallback(
    (contract) => {
      const contractId =
        contract.contract_id;

      if (
        settledContractRef.current ===
        contractId
      ) {
        return;
      }

      settledContractRef.current =
        contractId;

      contractOpenRef.current = false;

      const profit =
        Number(
          contract.profit ?? 0
        );

      const safeProfit =
        Number.isFinite(profit)
          ? profit
          : 0;

      const tradeStake =
        Number(
          contract.buy_price ??
            currentStakeRef.current
        );

      const settlement =
        evaluateSettlementSafety({
          profit:
            safeProfit,

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

      if (settlement.won) {
        setWinCount(
          (value) => value + 1
        );
      } else if (
        settlement.lost
      ) {
        setLossCount(
          (value) => value + 1
        );
      }

      setTradeHistory(
        (previous) => [
          {
            id:
              contract.contract_id,

            result:
              settlement.won
                ? 'WIN'
                : settlement.lost
                ? 'LOSS'
                : 'DRAW',

            profit:
              safeProfit,

            stake:
              tradeStake,

            strategy:
              contract.contract_type ||
              strategyRef.current,

            symbol,

            time:
              new Date().toLocaleTimeString(),
          },
          ...previous.slice(
            0,
            49
          ),
        ]
      );

      if (settlement.won) {
        addBotLog(
          `WIN +${safeProfit.toFixed(
            2
          )} ${
            contract.currency ||
            currencyRef.current
          } | Net +${settlement.nextTotalProfit.toFixed(
            2
          )}`,
          'success'
        );
      } else if (
        settlement.lost
      ) {
        addBotLog(
          `LOSS ${safeProfit.toFixed(
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
          }`,
          'system'
        );
      }

      if (settlement.stopBot) {
        stopAutoBot(
          settlement.stopReason
        );

        return;
      }

      const stakeResult =
        calculateNextStake({
          won:
            settlement.won,

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

      if (
        !settlement.won &&
        settlement.lost
      ) {
        addBotLog(
          `Next stake ${stakeResult.stake.toFixed(
            2
          )}`,
          'system'
        );
      }

      if (
        emergencyStoppedRef.current
      ) {
        return;
      }

      if (
        autoBotRunningRef.current
      ) {
        cooldownUntilRef.current =
          createCooldown(
            cooldownSecondsRef.current
          );

        const sessionStatus =
          buildSessionStatus({
            running: true,

            emergencyStopped:
              emergencyStoppedRef.current,

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
      }
    },
    [
      symbol,
      addBotLog,
      stopAutoBot,
    ]
  );

  // ============================================================
  // TRADING SOCKET
  // ============================================================

  const connectTradingSocket = useCallback(
    (wsUrl) => {
      if (!wsUrl) {
        setIsTradingConnected(false);
        return;
      }

      closeTradingSocket();

      const ws =
        new WebSocket(wsUrl);

      tradingWsRef.current = ws;

      ws.onopen = () => {
        setIsTradingConnected(true);

        addBotLog(
          'Authenticated Deriv trading socket connected.',
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

      ws.onmessage = (
        event
      ) => {
        try {
          const data =
            JSON.parse(
              event.data
            );

          // ====================================================
          // ERROR
          // ====================================================

          if (data.error) {
            const message =
              data.error.message ||
              'Deriv rejected the request.';

            if (
              data.echo_req?.proposal ===
              1
            ) {
              proposalPendingRef.current =
                false;

              setProposalLoading(false);
              setProposalError(message);
            }

            if (
              data.echo_req?.buy
            ) {
              buyPendingRef.current =
                false;

              setBuyLoading(false);
              setBuyError(message);
            }

            addBotLog(
              message,
              'error'
            );

            if (
              autoBotRunningRef.current
            ) {
              stopAutoBot(
                message
              );
            }

            return;
          }

          // ====================================================
          // BALANCE
          // ====================================================

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

          // ====================================================
          // PROPOSAL
          // ====================================================

          if (
            data.msg_type ===
              'proposal' &&
            data.proposal
          ) {
            proposalPendingRef.current =
              false;

            setProposalLoading(false);
            setProposalError('');

            setProposalData(
              data.proposal
            );

            if (
              autoBotRunningRef.current
            ) {
              const permission =
                canOpenNewContract({
                  botRunning:
                    autoBotRunningRef.current,

                  emergencyStopped:
                    emergencyStoppedRef.current,

                  accountType:
                    accountTypeRef.current,

                  tradingConnected:
                    ws.readyState ===
                    WebSocket.OPEN,

                  proposalPending:
                    false,

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

              if (
                !permission.allowed
              ) {
                if (
                  permission.stopBot
                ) {
                  stopAutoBot(
                    permission.reason
                  );
                }

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

              buyPendingRef.current =
                true;

              setBuyLoading(true);

              setAutoBotStatus(
                'Signal confirmed — buying demo contract...'
              );

              ws.send(
                JSON.stringify({
                  buy:
                    data.proposal.id,

                  price:
                    askPrice,

                  req_id:
                    nextReqId(),
                })
              );

              return;
            }

            addBotLog(
              `Manual proposal ready: ${data.proposal.id}`,
              'success'
            );
          }

          // ====================================================
          // BUY
          // ====================================================

          if (
            data.msg_type ===
              'buy' &&
            data.buy
          ) {
            buyPendingRef.current =
              false;

            setBuyLoading(false);
            setBuyError('');

            const contractId =
              data.buy.contract_id;

            if (!contractId) {
              if (
                autoBotRunningRef.current
              ) {
                stopAutoBot(
                  'No contract ID returned.'
                );
              }

              return;
            }

            contractOpenRef.current =
              true;

            settledContractRef.current =
              null;

            setProposalData(null);

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
                autoBotRunningRef.current
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

                req_id:
                  nextReqId(),
              })
            );
          }

          // ====================================================
          // CONTRACT
          // ====================================================

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

            if (contract.is_sold) {
              contractOpenRef.current =
                false;

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

              if (
                autoBotRunningRef.current
              ) {
                handleSettledContract(
                  contract
                );
              } else if (
                settledContractRef.current !==
                contract.contract_id
              ) {
                settledContractRef.current =
                  contract.contract_id;

                addBotLog(
                  `Manual demo contract settled | ${
                    safeProfit >= 0
                      ? '+'
                      : ''
                  }${safeProfit.toFixed(
                    2
                  )}`,
                  safeProfit > 0
                    ? 'success'
                    : safeProfit < 0
                    ? 'error'
                    : 'system'
                );
              }
            } else {
              contractOpenRef.current =
                true;

              setContractStatus(
                'LIVE'
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

        if (
          autoBotRunningRef.current
        ) {
          stopAutoBot(
            'Trading socket error.'
          );
        }
      };

      ws.onclose = () => {
        setIsTradingConnected(false);

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
      closeTradingSocket,
      handleSettledContract,
      stopAutoBot,
    ]
  );

  // ============================================================
  // LOAD SESSION
  // ============================================================

  const loadDerivSession = useCallback(
    async (
      requestedAccountId = ''
    ) => {
      try {
        setIsLoading(true);
        setAuthError('');

        let endpoint =
          '/api/auth/deriv/session';

        if (
          requestedAccountId
        ) {
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

        const data =
          await response.json();

        if (
          !response.ok ||
          !data.authenticated
        ) {
          setIsAuthorized(false);

          closeTradingSocket();

          if (
            response.status !==
              401 &&
            data.error
          ) {
            setAuthError(
              data.error
            );
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

        buyPendingRef.current =
          false;

        contractOpenRef.current =
          false;

        cooldownUntilRef.current =
          0;

        setProposalData(null);
        setProposalError('');
        setBuyError('');

        setActiveContract(null);

        setContractProfit(null);

        setContractStatus(
          'No active contract'
        );

        settledContractRef.current =
          null;

        if (data.wsUrl) {
          connectTradingSocket(
            data.wsUrl
          );
        } else {
          closeTradingSocket();

          if (data.error) {
            setAuthError(
              data.error
            );
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
      closeTradingSocket,
      connectTradingSocket,
    ]
  );

  // ============================================================
  // INITIAL SESSION
  // ============================================================

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

    loadDerivSession();

    return () => {
      closeTradingSocket();
    };
  }, [
    loadDerivSession,
    closeTradingSocket,
  ]);

  // ============================================================
  // ACCOUNT SWITCH
  // ============================================================

  const switchAccount =
    async (newAccountId) => {
      if (
        !newAccountId ||
        newAccountId ===
          selectedAccountId
      ) {
        return;
      }

      if (
        contractOpenRef.current
      ) {
        setAuthError(
          'Wait for the active contract to settle before switching accounts.'
        );

        return;
      }

      stopAutoBot(
        'Switching accounts'
      );

      await loadDerivSession(
        newAccountId
      );
    };

  // ============================================================
  // MARKET
  // ============================================================

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
            if (
              data.subscription?.id
            ) {
              publicSubscriptionRef.current =
                data.subscription.id;
            }

            const quote =
              Number(
                data.tick.quote
              );

            setLastTick(
              (previous) => {
                setPrevTick(
                  previous
                );

                return quote;
              }
            );

            const text =
              String(
                data.tick.quote
              );

            const numbers =
              text.replace(
                /\D/g,
                ''
              );

            if (!numbers.length) {
              return;
            }

            const digit =
              Number(
                numbers[
                  numbers.length - 1
                ]
              );

            setLastDigit(
              digit
            );

            const updatedHistory =
              [
                digit,
                ...digitHistoryRef.current,
              ].slice(
                0,
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
      if (
        publicPingRef.current
      ) {
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
    symbol,
    evaluateAutoEntry,
  ]);

  // ============================================================
  // RECALCULATE SIGNAL
  // ============================================================

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

  // ============================================================
  // OAUTH
  // ============================================================

  const connectDeriv =
    async () => {
      try {
        setAuthError('');

        setIsConnecting(true);

        const chars =
          'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';

        const bytes =
          new Uint8Array(64);

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
          new Uint8Array(16);

        crypto.getRandomValues(
          stateBytes
        );

        const state =
          Array.from(
            stateBytes
          )
            .map((byte) =>
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
        setIsConnecting(false);

        setAuthError(
          'Unable to open Deriv authorization.'
        );
      }
    };

  // ============================================================
  // START BOT
  // ============================================================

  const startAutoBot = () => {
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

    if (
      !isTradingConnected
    ) {
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

    const startingStake =
      Number(baseStake);

    setBuyError('');
    setProposalError('');

    tradeCountRef.current = 0;

    setTradeCount(0);

    setWinCount(0);
    setLossCount(0);

    consecutiveLossesRef.current =
      0;

    setConsecutiveLosses(0);

    totalProfitRef.current = 0;

    setTotalProfit(0);

    setTradeHistory([]);

    currentStakeRef.current =
      startingStake;

    setCurrentStake(
      startingStake.toFixed(2)
    );

    proposalPendingRef.current =
      false;

    buyPendingRef.current =
      false;

    cooldownUntilRef.current =
      0;

    settledContractRef.current =
      null;

    autoBotRunningRef.current =
      true;

    setIsAutoBotRunning(true);

    setAutoBotStatus(
      'Scanning Market'
    );

    addBotLog(
      `SAFETY ENGINE ACTIVE — ${strategy}`,
      'system'
    );

    const initialSignal =
      evaluateEntrySignal({
        strategy,

        digitHistory:
          digitHistoryRef.current,

        predictionDigit,
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

  // ============================================================
  // MANUAL PROPOSAL
  // ============================================================

  const requestManualProposal =
    () => {
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
        const payload =
          buildProposalPayload(
            Number(
              baseStake
            )
          );

        proposalPendingRef.current =
          true;

        setProposalLoading(true);

        setProposalError('');

        ws.send(
          JSON.stringify(
            payload
          )
        );
      } catch (error) {
        proposalPendingRef.current =
          false;

        setProposalLoading(false);

        setProposalError(
          error.message
        );
      }
    };

  // ============================================================
  // MANUAL DEMO BUY
  // ============================================================

  const buyManualDemoProposal =
    () => {
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

      if (
        !proposalData?.id
      ) {
        setBuyError(
          'Get a proposal first.'
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

      buyPendingRef.current =
        true;

      setBuyLoading(true);

      ws.send(
        JSON.stringify({
          buy:
            proposalData.id,

          price,

          req_id:
            nextReqId(),
        })
      );
    };

  // ============================================================
  // SMART DIGIT
  // ============================================================

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

  // ============================================================
  // RESET
  // ============================================================

  const resetSessionStats =
    () => {
      if (
        isAutoBotRunning ||
        contractOpenRef.current
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

      setConsecutiveLosses(0);

      setTotalProfit(0);

      setTradeHistory([]);

      const base =
        Number(baseStake) || 1;

      currentStakeRef.current =
        base;

      setCurrentStake(
        base.toFixed(2)
      );

      cooldownUntilRef.current =
        0;

      setBotLogs([]);

      setProposalData(null);

      setProposalError('');
      setBuyError('');

      setAutoBotStatus(
        'Standby'
      );
    };

  // ============================================================
  // DERIVED
  // ============================================================

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

  const formattedQuote =
    lastTick !== null
      ? lastTick.toLocaleString(
          'en-US',
          {
            maximumFractionDigits:
              5,
          }
        )
      : 'Waiting...';

  const winRate =
    tradeCount > 0
      ? (
          (
            winCount /
            tradeCount
          ) * 100
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
        buyLoading,

      cooldownUntil:
        cooldownUntilRef.current,
    });

  // ============================================================
  // UI
  // ============================================================

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
                inactiveLabel="Trading Socket Offline"
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
              {formattedQuote}
            </span>

            <span className="bg-slate-800 border border-slate-700 px-2 py-1 rounded text-cyan-400 font-black">
              {lastDigit ??
                '-'}
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
              onClick={
                connectDeriv
              }
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
              {accounts.length >
                1 && (
                <select
                  value={
                    selectedAccountId
                  }
                  onChange={(
                    event
                  ) =>
                    switchAccount(
                      event.target
                        .value
                    )
                  }
                  disabled={
                    isAutoBotRunning ||
                    isContractOpen
                  }
                  className="bg-[#151d2d] border border-slate-700 rounded-xl px-3 py-2 text-xs"
                >
                  {accounts.map(
                    (
                      account
                    ) => (
                      <option
                        key={
                          account.id
                        }
                        value={
                          account.id
                        }
                      >
                        {account.type ===
                        'demo'
                          ? 'Demo'
                          : 'Real'}{' '}
                        —{' '}
                        {
                          account.id
                        }
                      </option>
                    )
                  )}
                </select>
              )}

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
            </div>
          )}
        </div>
      </header>

      <div className="border-b border-slate-800 bg-[#0b1019]">
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
            ([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() =>
                  setActiveTab(
                    id
                  )
                }
                className={`px-4 py-2 rounded-xl text-xs font-black whitespace-nowrap ${
                  activeTab ===
                  id
                    ? 'bg-emerald-500 text-black'
                    : 'bg-slate-900 border border-slate-800 text-slate-400'
                }`}
              >
                {label}
              </button>
            )
          )}
        </div>
      </div>

      <section className="max-w-7xl mx-auto px-4 py-8">
        {authError && (
          <Alert>
            ⚠️ {authError}
          </Alert>
        )}

        {activeTab ===
          'overview' && (
          <div className="space-y-6">
            <div className="rounded-3xl border border-slate-800 bg-[#0f1522] p-8 md:p-12">
              <span className="inline-flex rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-400 font-black">
                Safety Engine Active
              </span>

              <h1 className="mt-5 max-w-3xl text-4xl md:text-5xl font-black">
                Signal Trading With Hard Session Protection.
              </h1>

              <p className="mt-5 max-w-2xl text-slate-400">
                BinarySpot Pro now checks account type,
                duplicate entries, cooldowns, trade limits,
                loss limits and stake limits before every
                automated demo entry.
              </p>
            </div>

            <div className="grid md:grid-cols-4 gap-4">
              <StatBox
                label="Session"
                value={
                  sessionStatus.label
                }
                accent="text-cyan-400"
              />

              <StatBox
                label="Signal"
                value={
                  signal.shouldTrade
                    ? 'ENTER'
                    : 'WAIT'
                }
                accent={
                  signal.shouldTrade
                    ? 'text-emerald-400'
                    : 'text-amber-400'
                }
              />

              <StatBox
                label="Confidence"
                value={`${Number(
                  signal.confidence ||
                    0
                ).toFixed(1)}%`}
                accent="text-cyan-400"
              />

              <StatBox
                label="Sample"
                value={
                  signal.sampleSize ||
                  digitHistory.length
                }
              />
            </div>

            <div className="border border-slate-800 bg-[#0f1522] rounded-2xl p-5">
              <p className="text-[10px] uppercase text-slate-500 font-black">
                Strategy Reason
              </p>

              <p className="mt-2 text-sm text-slate-300">
                {signal.reason}
              </p>
            </div>
          </div>
        )}

        {activeTab ===
          'bots' && (
          <div className="space-y-6">
            <div className="flex flex-wrap justify-between gap-4">
              <div>
                <h2 className="text-xl font-black">
                  Bot Studio
                </h2>

                <p className="mt-1 text-xs text-slate-400">
                  Strategy controlled demo execution with
                  centralized safety checks.
                </p>
              </div>

              <span
                className={`px-3 py-1.5 rounded-full text-xs font-black ${
                  emergencyStopped
                    ? 'bg-rose-500/20 text-rose-400'
                    : isAutoBotRunning
                    ? 'bg-emerald-500/15 text-emerald-400'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                {
                  sessionStatus.label
                }
              </span>
            </div>

            <div
              className={`border rounded-2xl p-5 ${
                signal.shouldTrade &&
                signal.confidence >=
                  Number(
                    minimumConfidence
                  )
                  ? 'border-emerald-500/30 bg-emerald-500/5'
                  : 'border-amber-500/30 bg-amber-500/5'
              }`}
            >
              <div className="flex flex-wrap justify-between gap-4">
                <div>
                  <p className="text-[10px] uppercase text-slate-500 font-black">
                    Live Strategy Signal
                  </p>

                  <p
                    className={`mt-2 text-2xl font-black ${
                      signal.shouldTrade &&
                      signal.confidence >=
                        Number(
                          minimumConfidence
                        )
                        ? 'text-emerald-400'
                        : 'text-amber-400'
                    }`}
                  >
                    {signal.shouldTrade &&
                    signal.confidence >=
                      Number(
                        minimumConfidence
                      )
                      ? 'ENTER'
                      : 'WAIT'}
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-[10px] uppercase text-slate-500">
                    Confidence
                  </p>

                  <p className="mt-1 text-2xl font-black font-mono text-cyan-400">
                    {Number(
                      signal.confidence ||
                        0
                    ).toFixed(1)}
                    %
                  </p>
                </div>
              </div>

              <p className="mt-4 text-xs text-slate-400">
                {signal.reason}
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-[#0f1522] border border-slate-800 rounded-2xl p-6 space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Synthetic Asset">
                    <select
                      value={
                        symbol
                      }
                      onChange={(
                        event
                      ) => {
                        setSymbol(
                          event.target.value
                        );

                        digitHistoryRef.current =
                          [];

                        setDigitHistory(
                          []
                        );
                      }}
                      disabled={
                        isAutoBotRunning ||
                        isContractOpen
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
                      value={
                        strategy
                      }
                      onChange={(
                        event
                      ) =>
                        setStrategy(
                          event.target.value
                        )
                      }
                      disabled={
                        isAutoBotRunning ||
                        isContractOpen
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
                    <>
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
                          ) =>
                            setPredictionDigit(
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

                      <Field label="Smart Digit">
                        <button
                          type="button"
                          onClick={
                            applySuggestedDigit
                          }
                          disabled={
                            isAutoBotRunning ||
                            digitHistory.length ===
                              0
                          }
                          className="w-full mt-2 p-3 rounded-xl border border-cyan-500/30 bg-cyan-500/10 text-cyan-400 text-sm font-black disabled:opacity-40"
                        >
                          USE SUGGESTED DIGIT
                        </button>
                      </Field>
                    </>
                  )}

                  <Field label="Minimum Confidence %">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={
                        minimumConfidence
                      }
                      onChange={(
                        event
                      ) =>
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
                      value={
                        baseStake
                      }
                      onChange={(
                        event
                      ) => {
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
                      value={
                        currentStake
                      }
                      readOnly
                      className={`${INPUT_CLASS} text-amber-400`}
                    />
                  </Field>

                  <Field label="Maximum Stake">
                    <input
                      type="number"
                      min="0.35"
                      step="0.01"
                      value={
                        maxStake
                      }
                      onChange={(
                        event
                      ) =>
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
                      value={
                        duration
                      }
                      onChange={(
                        event
                      ) =>
                        setDuration(
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

                  <Field label="Martingale Multiplier">
                    <input
                      type="number"
                      min="1"
                      step="0.1"
                      value={
                        martingale
                      }
                      onChange={(
                        event
                      ) =>
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
                      value={
                        maxTrades
                      }
                      onChange={(
                        event
                      ) =>
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
                      onChange={(
                        event
                      ) =>
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
                      value={
                        takeProfit
                      }
                      onChange={(
                        event
                      ) =>
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
                      value={
                        stopLoss
                      }
                      onChange={(
                        event
                      ) =>
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
                      onChange={(
                        event
                      ) =>
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
                  <Alert>
                    ⚠️ {buyError}
                  </Alert>
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
                      onClick={
                        startAutoBot
                      }
                      disabled={
                        !isDemoAccount ||
                        !isTradingConnected ||
                        isContractOpen ||
                        emergencyStopped
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
                      isContractOpen
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
                    isContractOpen
                  }
                  className="w-full py-3 bg-slate-800 disabled:opacity-40 font-black rounded-xl"
                >
                  RESET SESSION
                </button>

                <div className="border border-slate-800 rounded-2xl p-5">
                  <p className="text-[10px] uppercase text-slate-500 font-black">
                    Bot Status
                  </p>

                  <p className="mt-2 font-mono text-cyan-400 font-black">
                    {autoBotStatus}
                  </p>
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
                        {
                          contractStatus
                        }
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
                              ).toFixed(
                                2
                              )}`
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
                  !emergencyStopped && (
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
                            !isTradingConnected
                          }
                          className="py-3 bg-cyan-500 disabled:opacity-40 text-black font-black rounded-xl"
                        >
                          {proposalLoading
                            ? 'REQUESTING...'
                            : 'GET PROPOSAL'}
                        </button>

                        <button
                          type="button"
                          onClick={
                            buyManualDemoProposal
                          }
                          disabled={
                            !proposalData ||
                            buyLoading ||
                            !isDemoAccount
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
              </div>

              <div className="bg-[#0f1522] border border-slate-800 rounded-2xl p-5">
                <h3 className="text-xs uppercase font-black">
                  Session Performance
                </h3>

                <div className="grid grid-cols-2 gap-2 mt-4">
                  <StatBox
                    label="Trades"
                    value={
                      tradeCount
                    }
                  />

                  <StatBox
                    label="Win Rate"
                    value={`${winRate}%`}
                    accent="text-cyan-400"
                  />

                  <StatBox
                    label="Wins"
                    value={
                      winCount
                    }
                    accent="text-emerald-400"
                  />

                  <StatBox
                    label="Losses"
                    value={
                      lossCount
                    }
                    accent="text-rose-400"
                  />

                  <StatBox
                    label="Net P/L"
                    value={`${
                      totalProfit >=
                      0
                        ? '+'
                        : ''
                    }${totalProfit.toFixed(
                      2
                    )}`}
                    accent={
                      totalProfit >=
                      0
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

                  <StatBox
                    label="Current Stake"
                    value={
                      currentStake
                    }
                    accent="text-amber-400"
                  />

                  <StatBox
                    label="Safety"
                    value={
                      sessionStatus.label
                    }
                    accent="text-cyan-400"
                  />
                </div>

                <div className="mt-4 bg-[#080b11] border border-slate-800 rounded-xl p-3 max-h-[520px] overflow-y-auto space-y-2">
                  {botLogs.length ===
                  0 ? (
                    <p className="text-center text-xs text-slate-600 py-10">
                      Bot activity will appear here.
                    </p>
                  ) : (
                    botLogs.map(
                      (
                        log,
                        index
                      ) => (
                        <div
                          key={`${log.time}-${index}`}
                          className="border border-slate-800 p-2 rounded-lg text-xs font-mono"
                        >
                          <span className="text-slate-600">
                            [
                            {
                              log.time
                            }
                            ]{' '}
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
                            {
                              log.message
                            }
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

            <p className="text-xs text-slate-400 mt-1">
              Settled demo contracts from this session.
            </p>

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
                      key={
                        trade.id
                      }
                      className="grid grid-cols-2 md:grid-cols-6 gap-3 bg-[#080b11] border border-slate-800 rounded-xl p-4"
                    >
                      <HistoryValue
                        label="Contract"
                        value={`#${trade.id}`}
                      />

                      <HistoryValue
                        label="Result"
                        value={
                          trade.result
                        }
                        accent={
                          trade.result ===
                          'WIN'
                            ? 'text-emerald-400'
                            : trade.result ===
                              'LOSS'
                            ? 'text-rose-400'
                            : 'text-slate-300'
                        }
                      />

                      <HistoryValue
                        label="Stake"
                        value={Number(
                          trade.stake
                        ).toFixed(
                          2
                        )}
                      />

                      <HistoryValue
                        label="P/L"
                        value={`${
                          trade.profit >=
                          0
                            ? '+'
                            : ''
                        }${trade.profit.toFixed(
                          2
                        )}`}
                        accent={
                          trade.profit >=
                          0
                            ? 'text-emerald-400'
                            : 'text-rose-400'
                        }
                      />

                      <HistoryValue
                        label="Strategy"
                        value={
                          trade.strategy
                        }
                      />

                      <HistoryValue
                        label="Time"
                        value={
                          trade.time
                        }
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
              <div className="flex justify-between flex-wrap gap-4">
                <div>
                  <h2 className="text-xl font-black">
                    Digit Analyzer
                  </h2>

                  <p className="text-xs text-slate-400">
                    {analysis.sampleSize} recent ticks on {symbol}
                  </p>
                </div>

                <div className="flex gap-2">
                  <span className="bg-slate-800 px-3 py-1 rounded text-xs font-black text-cyan-400">
                    Even{' '}
                    {analysis.evenOdd.evenPercentage}
                    %
                  </span>

                  <span className="bg-slate-800 px-3 py-1 rounded text-xs font-black text-amber-400">
                    Odd{' '}
                    {analysis.evenOdd.oddPercentage}
                    %
                  </span>
                </div>
              </div>

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

            <div className="grid md:grid-cols-3 gap-4">
              <StatBox
                label="Most Frequent"
                value={
                  analysis.sampleSize
                    ? `${analysis.mostFrequent.digit} — ${analysis.mostFrequent.percentage}%`
                    : '-'
                }
                accent="text-emerald-400"
              />

              <StatBox
                label="Least Frequent"
                value={
                  analysis.sampleSize
                    ? `${analysis.leastFrequent.digit} — ${analysis.leastFrequent.percentage}%`
                    : '-'
                }
                accent="text-amber-400"
              />

              <StatBox
                label="Current Streak"
                value={
                  analysis.streak.type
                    ? `${analysis.streak.type.toUpperCase()} × ${analysis.streak.length}`
                    : '-'
                }
                accent="text-cyan-400"
              />
            </div>

            <div className="bg-[#0f1522] border border-slate-800 p-6 rounded-2xl">
              <p className="text-xs uppercase font-black text-slate-500">
                Recent Digits
              </p>

              <div className="flex flex-wrap gap-2 mt-4">
                {digitHistory
                  .slice(
                    0,
                    30
                  )
                  .map(
                    (
                      digit,
                      index
                    ) => (
                      <span
                        key={`${digit}-${index}`}
                        className={`h-9 w-9 flex items-center justify-center rounded-xl font-black ${
                          index ===
                          0
                            ? 'bg-emerald-500 text-black'
                            : digit %
                                2 ===
                              0
                            ? 'bg-slate-800 text-cyan-400'
                            : 'bg-slate-800 text-amber-400'
                        }`}
                      >
                        {
                          digit
                        }
                      </span>
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

function HistoryValue({
  label,
  value,
  accent = 'text-white',
}) {
  return (
    <div>
      <p className="text-[9px] uppercase text-slate-600">
        {label}
      </p>

      <p
        className={`mt-1 text-xs font-mono font-black break-all ${accent}`}
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
