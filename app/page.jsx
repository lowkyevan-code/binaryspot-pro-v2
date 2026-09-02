'use client';

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

const CLIENT_ID = '34hh45FQkPfMgbgj20uoR';

const REDIRECT_URI =
  'https://binaryspot-pro-v2.vercel.app/auth/deriv/callback';

const PUBLIC_WS_URL =
  'wss://api.derivws.com/trading/v1/options/ws/public';

const INPUT_CLASS =
  'w-full mt-2 bg-[#151d2d] border border-slate-700 p-3 rounded-xl text-sm text-slate-100 font-mono';

export default function BinarySpotPro() {
  // ============================================================
  // AUTH / ACCOUNTS
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

  const [digitStats, setDigitStats] = useState(
    Array(10).fill(0)
  );

  const [evenOddRatio, setEvenOddRatio] = useState({
    even: 50,
    odd: 50,
  });

  // ============================================================
  // BOT SETTINGS
  // ============================================================

  const [strategy, setStrategy] = useState('DIGITDIFF');

  const [baseStake, setBaseStake] = useState('1.00');
  const [currentStake, setCurrentStake] = useState('1.00');

  const [duration, setDuration] = useState('1');

  const [predictionDigit, setPredictionDigit] =
    useState('0');

  const [martingale, setMartingale] = useState('2.00');

  const [takeProfit, setTakeProfit] = useState('10.00');
  const [stopLoss, setStopLoss] = useState('20.00');

  const [
    maxConsecutiveLosses,
    setMaxConsecutiveLosses,
  ] = useState('3');

  // ============================================================
  // AUTO BOT
  // ============================================================

  const [isAutoBotRunning, setIsAutoBotRunning] =
    useState(false);

  const [autoBotStatus, setAutoBotStatus] =
    useState('Standby');

  const [totalProfit, setTotalProfit] = useState(0);
  const [tradeCount, setTradeCount] = useState(0);
  const [winCount, setWinCount] = useState(0);
  const [lossCount, setLossCount] = useState(0);

  const [
    consecutiveLosses,
    setConsecutiveLosses,
  ] = useState(0);

  const [botLogs, setBotLogs] = useState([]);

  // ============================================================
  // PROPOSAL
  // ============================================================

  const [proposalLoading, setProposalLoading] =
    useState(false);

  const [proposalError, setProposalError] =
    useState('');

  const [proposalData, setProposalData] =
    useState(null);

  // ============================================================
  // CONTRACT
  // ============================================================

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
  const totalProfitRef = useRef(0);
  const currentStakeRef = useRef(1);
  const consecutiveLossesRef = useRef(0);

  const settledContractRef = useRef(null);

  const botTimerRef = useRef(null);

  useEffect(() => {
    autoBotRunningRef.current =
      isAutoBotRunning;
  }, [isAutoBotRunning]);

  useEffect(() => {
    totalProfitRef.current = totalProfit;
  }, [totalProfit]);

  useEffect(() => {
    currentStakeRef.current =
      Number(currentStake) || 1;
  }, [currentStake]);

  useEffect(() => {
    consecutiveLossesRef.current =
      consecutiveLosses;
  }, [consecutiveLosses]);

  const nextReqId = () => {
    requestIdRef.current += 1;
    return requestIdRef.current;
  };

  // ============================================================
  // LOGGING
  // ============================================================

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
        ...previous.slice(0, 99),
      ]);
    },
    []
  );

  // ============================================================
  // STOP BOT
  // ============================================================

  const stopAutoBot = useCallback(
    (reason = 'Stopped manually') => {
      autoBotRunningRef.current = false;

      setIsAutoBotRunning(false);
      setAutoBotStatus(reason);

      if (botTimerRef.current) {
        clearTimeout(botTimerRef.current);
        botTimerRef.current = null;
      }

      addBotLog(
        `Auto bot stopped: ${reason}`,
        'system'
      );
    },
    [addBotLog]
  );

  // ============================================================
  // TRADING SOCKET CLEANUP
  // ============================================================

  const closeTradingSocket = useCallback(() => {
    if (tradingPingRef.current) {
      clearInterval(tradingPingRef.current);
      tradingPingRef.current = null;
    }

    if (botTimerRef.current) {
      clearTimeout(botTimerRef.current);
      botTimerRef.current = null;
    }

    if (tradingWsRef.current) {
      try {
        tradingWsRef.current.onclose = null;
        tradingWsRef.current.close();
      } catch {}

      tradingWsRef.current = null;
    }

    contractSubscriptionRef.current = null;

    setIsTradingConnected(false);
  }, []);

  // ============================================================
  // BUILD PROPOSAL PAYLOAD
  // ============================================================

  const buildProposalPayload = useCallback(
    (stakeAmount) => {
      const parsedStake =
        Number(stakeAmount);

      const parsedDuration =
        Number(duration);

      const prediction =
        Number(predictionDigit);

      if (
        !Number.isFinite(parsedStake) ||
        parsedStake <= 0
      ) {
        throw new Error(
          'Stake must be greater than zero.'
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
        ].includes(strategy)
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

        amount:
          Number(
            parsedStake.toFixed(2)
          ),

        basis: 'stake',

        contract_type:
          strategy,

        currency:
          currency || 'USD',

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
        ].includes(strategy)
      ) {
        payload.barrier =
          String(prediction);
      }

      return payload;
    },
    [
      strategy,
      duration,
      predictionDigit,
      currency,
      symbol,
    ]
  );

  // ============================================================
  // AUTO REQUEST PROPOSAL
  // ============================================================

  const requestAutoProposal =
    useCallback(() => {
      if (
        !autoBotRunningRef.current
      ) {
        return;
      }

      if (accountType !== 'demo') {
        stopAutoBot(
          'Real account protection triggered'
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
          'Trading socket disconnected'
        );

        return;
      }

      try {
        const stakeAmount =
          currentStakeRef.current;

        const payload =
          buildProposalPayload(
            stakeAmount
          );

        setAutoBotStatus(
          `Requesting proposal — ${currency} ${stakeAmount.toFixed(
            2
          )}`
        );

        addBotLog(
          `AUTO proposal | ${strategy} | ${symbol} | Stake ${currency} ${stakeAmount.toFixed(
            2
          )}`,
          'trade'
        );

        ws.send(
          JSON.stringify(payload)
        );
      } catch (error) {
        stopAutoBot(
          error.message ||
            'Proposal setup error'
        );
      }
    }, [
      accountType,
      buildProposalPayload,
      currency,
      strategy,
      symbol,
      stopAutoBot,
      addBotLog,
    ]);

  // ============================================================
  // HANDLE SETTLED CONTRACT
  // ============================================================

  const handleSettledContract =
    useCallback(
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

        const profit =
          Number(
            contract.profit ?? 0
          );

        const safeProfit =
          Number.isFinite(profit)
            ? profit
            : 0;

        const newTotal =
          Number(
            (
              totalProfitRef.current +
              safeProfit
            ).toFixed(2)
          );

        totalProfitRef.current =
          newTotal;

        setTotalProfit(newTotal);

        setTradeCount(
          (value) => value + 1
        );

        if (safeProfit > 0) {
          setWinCount(
            (value) => value + 1
          );

          setConsecutiveLosses(0);
          consecutiveLossesRef.current = 0;

          const resetStake =
            Number(baseStake) || 1;

          currentStakeRef.current =
            resetStake;

          setCurrentStake(
            resetStake.toFixed(2)
          );

          addBotLog(
            `WIN +${safeProfit.toFixed(
              2
            )} ${contract.currency || currency} | Net ${
              newTotal >= 0 ? '+' : ''
            }${newTotal.toFixed(2)}`,
            'success'
          );
        } else {
          setLossCount(
            (value) => value + 1
          );

          const nextLosses =
            consecutiveLossesRef.current +
            1;

          consecutiveLossesRef.current =
            nextLosses;

          setConsecutiveLosses(
            nextLosses
          );

          const multiplier =
            Math.max(
              1,
              Number(martingale) || 1
            );

          const nextStake =
            Number(
              (
                currentStakeRef.current *
                multiplier
              ).toFixed(2)
            );

          currentStakeRef.current =
            nextStake;

          setCurrentStake(
            nextStake.toFixed(2)
          );

          addBotLog(
            `LOSS ${safeProfit.toFixed(
              2
            )} ${contract.currency || currency} | Next stake ${nextStake.toFixed(
              2
            )}`,
            'error'
          );
        }

        const tp =
          Number(takeProfit);

        const sl =
          Number(stopLoss);

        const maxLosses =
          Math.max(
            1,
            Number(
              maxConsecutiveLosses
            ) || 1
          );

        if (
          Number.isFinite(tp) &&
          tp > 0 &&
          newTotal >= tp
        ) {
          stopAutoBot(
            `Take Profit reached: +${newTotal.toFixed(
              2
            )}`
          );

          return;
        }

        if (
          Number.isFinite(sl) &&
          sl > 0 &&
          newTotal <= -sl
        ) {
          stopAutoBot(
            `Stop Loss reached: ${newTotal.toFixed(
              2
            )}`
          );

          return;
        }

        if (
          safeProfit <= 0 &&
          consecutiveLossesRef.current >=
            maxLosses
        ) {
          stopAutoBot(
            `Maximum consecutive losses reached (${maxLosses})`
          );

          return;
        }

        if (
          autoBotRunningRef.current
        ) {
          setAutoBotStatus(
            'Waiting for next trade...'
          );

          botTimerRef.current =
            setTimeout(() => {
              if (
                autoBotRunningRef.current
              ) {
                requestAutoProposal();
              }
            }, 800);
        }
      },
      [
        baseStake,
        martingale,
        takeProfit,
        stopLoss,
        maxConsecutiveLosses,
        currency,
        addBotLog,
        stopAutoBot,
        requestAutoProposal,
      ]
    );

  // ============================================================
  // CONNECT AUTH TRADING SOCKET
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
          'Authenticated trading socket connected.',
          'system'
        );

        // Balance stream
        ws.send(
          JSON.stringify({
            balance: 1,
            subscribe: 1,
            req_id: nextReqId(),
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

      ws.onmessage = (event) => {
        try {
          const data =
            JSON.parse(event.data);

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
              setProposalLoading(false);
              setProposalError(message);

              addBotLog(
                `Proposal rejected: ${message}`,
                'error'
              );

              if (
                autoBotRunningRef.current
              ) {
                stopAutoBot(
                  `Proposal error: ${message}`
                );
              }
            }

            if (
              data.echo_req?.buy
            ) {
              setBuyLoading(false);
              setBuyError(message);

              addBotLog(
                `Purchase rejected: ${message}`,
                'error'
              );

              if (
                autoBotRunningRef.current
              ) {
                stopAutoBot(
                  `Purchase error: ${message}`
                );
              }
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

            setCurrency(
              data.balance.currency ||
                'USD'
            );
          }

          // ====================================================
          // PROPOSAL
          // ====================================================

          if (
            data.msg_type ===
              'proposal' &&
            data.proposal
          ) {
            setProposalLoading(false);
            setProposalError('');
            setProposalData(
              data.proposal
            );

            // Auto bot: immediately buy proposal
            if (
              autoBotRunningRef.current
            ) {
              if (
                accountType !== 'demo'
              ) {
                stopAutoBot(
                  'Real account purchase blocked'
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
                  'Invalid proposal returned'
                );

                return;
              }

              setAutoBotStatus(
                'Buying demo contract...'
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
              `Proposal ready: ${data.proposal.id}`,
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
            setBuyLoading(false);
            setBuyError('');

            const contractId =
              data.buy.contract_id;

            if (!contractId) {
              if (
                autoBotRunningRef.current
              ) {
                stopAutoBot(
                  'No contract ID returned'
                );
              }

              return;
            }

            settledContractRef.current =
              null;

            setProposalData(null);

            setActiveContract({
              contractId,

              buyPrice:
                data.buy.buy_price ??
                data.buy.price ??
                null,

              transactionId:
                data.buy
                  .transaction_id ??
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
                  : 'DEMO'
              } contract purchased #${contractId}`,
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
          // CONTRACT MONITOR
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

                isExpired:
                  Boolean(
                    contract.is_expired
                  ),

                status:
                  contract.status,
              })
            );

            if (
              contract.is_sold
            ) {
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
                  `Demo contract settled | ${
                    safeProfit >= 0
                      ? '+'
                      : ''
                  }${safeProfit.toFixed(
                    2
                  )} ${
                    contract.currency ||
                    currency
                  }`,
                  safeProfit > 0
                    ? 'success'
                    : 'error'
                );
              }
            } else {
              setContractStatus(
                'LIVE'
              );
            }
          }
        } catch (error) {
          console.error(
            'Trading socket error:',
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
            'Trading socket error'
          );
        }
      };

      ws.onclose = () => {
        setIsTradingConnected(false);

        if (
          autoBotRunningRef.current
        ) {
          stopAutoBot(
            'Trading socket closed'
          );
        }
      };
    },
    [
      accountType,
      currency,
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

        setBalance(
          data.account.balance ??
            null
        );

        setCurrency(
          data.account.currency ||
            'USD'
        );

        stopAutoBot(
          'Account session loaded'
        );

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
      stopAutoBot,
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

  const isContractOpen =
    Boolean(
      activeContract &&
        !activeContract.isSold
    );

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
        isContractOpen
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
  // MARKET STATISTICS
  // ============================================================

  const updateDigitStats =
    useCallback((digit) => {
      setDigitHistory(
        (previous) => {
          const updated = [
            digit,
            ...previous,
          ].slice(0, 100);

          const counts =
            Array(10).fill(0);

          let evenCount = 0;

          updated.forEach(
            (item) => {
              counts[item] += 1;

              if (
                item % 2 === 0
              ) {
                evenCount += 1;
              }
            }
          );

          const total =
            updated.length || 1;

          setDigitStats(
            counts.map(
              (count) =>
                Math.round(
                  (count /
                    total) *
                    100
                )
            )
          );

          setEvenOddRatio({
            even:
              Math.round(
                (evenCount /
                  total) *
                  100
              ),

            odd:
              Math.round(
                ((total -
                  evenCount) /
                  total) *
                  100
              ),
          });

          return updated;
        }
      );
    }, []);

  // ============================================================
  // PUBLIC MARKET CONNECTION
  // ============================================================

  const connectMarket =
    useCallback(() => {
      if (
        publicWsRef.current &&
        (
          publicWsRef.current
            .readyState ===
            WebSocket.OPEN ||
          publicWsRef.current
            .readyState ===
            WebSocket.CONNECTING
        )
      ) {
        return;
      }

      const ws =
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

            subscribe: 1,
          })
        );

        if (
          publicPingRef.current
        ) {
          clearInterval(
            publicPingRef.current
          );
        }

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

      ws.onmessage =
        (event) => {
          try {
            const data =
              JSON.parse(
                event.data
              );

            if (
              data.error
            ) {
              return;
            }

            if (
              data.msg_type ===
                'tick' &&
              data.tick
            ) {
              if (
                data.subscription
                  ?.id
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

              const quoteText =
                String(
                  data.tick.quote
                );

              const numericOnly =
                quoteText.replace(
                  /\D/g,
                  ''
                );

              if (
                numericOnly.length
              ) {
                const digit =
                  Number(
                    numericOnly[
                      numericOnly.length -
                        1
                    ]
                  );

                setLastDigit(
                  digit
                );

                updateDigitStats(
                  digit
                );
              }
            }
          } catch (
            error
          ) {
            console.error(
              error
            );
          }
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
    }, [
      symbol,
      updateDigitStats,
    ]);

  useEffect(() => {
    connectMarket();

    return () => {
      if (
        publicPingRef.current
      ) {
        clearInterval(
          publicPingRef.current
        );
      }

      if (
        publicWsRef.current
      ) {
        publicWsRef.current.onclose =
          null;

        publicWsRef.current.close();
      }
    };
  }, [connectMarket]);

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
      } catch (error) {
        setIsConnecting(false);

        setAuthError(
          'Unable to open Deriv authorization.'
        );
      }
    };

  // ============================================================
  // MANUAL PROPOSAL
  // ============================================================

  const requestLiveProposal =
    () => {
      setProposalError('');
      setProposalData(null);

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

        setProposalLoading(
          true
        );

        ws.send(
          JSON.stringify(
            payload
          )
        );
      } catch (error) {
        setProposalLoading(
          false
        );

        setProposalError(
          error.message
        );
      }
    };

  // ============================================================
  // MANUAL DEMO BUY
  // ============================================================

  const buyDemoProposal =
    () => {
      setBuyError('');

      if (
        accountType !==
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
        isContractOpen
      ) {
        setBuyError(
          'Wait for the current contract to settle.'
        );

        return;
      }

      const price =
        Number(
          proposalData.ask_price
        );

      const ws =
        tradingWsRef.current;

      if (
        !ws ||
        ws.readyState !==
          WebSocket.OPEN
      ) {
        setBuyError(
          'Trading socket offline.'
        );

        return;
      }

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
  // START AUTO BOT
  // ============================================================

  const startAutoBot =
    () => {
      if (
        accountType !==
        'demo'
      ) {
        setBuyError(
          'Auto trading is locked to Demo accounts.'
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
        isContractOpen
      ) {
        setBuyError(
          'Wait for the active contract to settle.'
        );

        return;
      }

      const stake =
        Number(baseStake);

      if (
        !Number.isFinite(
          stake
        ) ||
        stake <= 0
      ) {
        setBuyError(
          'Enter a valid base stake.'
        );

        return;
      }

      setBuyError('');
      setProposalError('');

      setTradeCount(0);
      setWinCount(0);
      setLossCount(0);
      setConsecutiveLosses(0);

      consecutiveLossesRef.current =
        0;

      setTotalProfit(0);
      totalProfitRef.current =
        0;

      setCurrentStake(
        stake.toFixed(2)
      );

      currentStakeRef.current =
        stake;

      settledContractRef.current =
        null;

      autoBotRunningRef.current =
        true;

      setIsAutoBotRunning(
        true
      );

      setAutoBotStatus(
        'Starting...'
      );

      addBotLog(
        `AUTO BOT STARTED — DEMO ONLY — ${strategy}`,
        'system'
      );

      requestAutoProposal();
    };

  // ============================================================
  // RESET
  // ============================================================

  const resetSessionStats =
    () => {
      if (
        isAutoBotRunning
      ) {
        return;
      }

      setTradeCount(0);
      setWinCount(0);
      setLossCount(0);
      setConsecutiveLosses(0);

      setTotalProfit(0);
      totalProfitRef.current =
        0;

      const base =
        Number(baseStake) ||
        1;

      currentStakeRef.current =
        base;

      setCurrentStake(
        base.toFixed(2)
      );

      setBotLogs([]);

      setAutoBotStatus(
        'Standby'
      );
    };

  // ============================================================
  // DERIVED
  // ============================================================

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
          (winCount /
            tradeCount) *
          100
        ).toFixed(1)
      : '0.0';

  const needsPredictionDigit =
    [
      'DIGITDIFF',
      'DIGITMATCH',
      'DIGITOVER',
      'DIGITUNDER',
    ].includes(strategy);

  const isDemoAccount =
    accountType ===
    'demo';

  // ============================================================
  // UI
  // ============================================================

  return (
    <main className="min-h-screen bg-[#080b11] text-slate-100">

      <div className="border-b border-slate-800 bg-[#0e131d] px-4 py-2.5">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3 text-xs">

          <div className="flex items-center gap-4">

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

            <span className="text-emerald-400 font-black">
              {formattedQuote}
            </span>

            <span className="bg-slate-800 px-2 py-1 rounded text-cyan-400 font-black">
              {lastDigit ??
                '-'}
            </span>

          </div>

        </div>
      </div>

      <header className="border-b border-slate-800 bg-[#0d121c]">
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-wrap items-center justify-between gap-4">

          <div className="flex items-center gap-3">

            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-black text-xl font-black">
              BS
            </div>

            <div>

              <div className="font-black text-lg">
                BINARY
                <span className="text-emerald-400">
                  SPOT
                </span>{' '}
                PRO
              </div>

              <p className="text-[9px] uppercase tracking-widest text-emerald-500 font-bold">
                Algorithmic Hub
              </p>

            </div>

          </div>

          {!isAuthorized ? (
            <button
              onClick={
                connectDeriv
              }
              disabled={
                isLoading ||
                isConnecting
              }
              className="px-4 py-3 rounded-xl bg-emerald-500 text-black font-black text-xs"
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
                    isContractOpen ||
                    isAutoBotRunning
                  }
                  className="bg-[#151d2d] border border-slate-700 px-3 py-2 rounded-xl text-xs"
                >
                  {accounts.map(
                    (account) => (
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
              'analyzer',
              '📊 Digit Analyzer',
            ],
          ].map(
            ([id, label]) => (
              <button
                key={id}
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

            <div className="bg-[#0f1522] border border-slate-800 rounded-3xl p-8 md:p-12">

              <span className="inline-flex border border-emerald-500/20 bg-emerald-500/10 text-emerald-400 rounded-full px-3 py-1 text-xs font-black">
                BinarySpot Pro
              </span>

              <h1 className="mt-5 max-w-3xl text-4xl md:text-5xl font-black">
                Automated Demo Trading Engine.
              </h1>

              <p className="mt-5 max-w-2xl text-slate-400">
                Live Deriv pricing, automated demo purchases,
                contract monitoring, P/L tracking and risk
                controls are now integrated.
              </p>

            </div>

            <div
              className={`rounded-2xl border p-5 ${
                isDemoAccount
                  ? 'border-cyan-500/30 bg-cyan-500/5'
                  : 'border-rose-500/30 bg-rose-500/5'
              }`}
            >

              <p
                className={`text-xs uppercase font-black ${
                  isDemoAccount
                    ? 'text-cyan-400'
                    : 'text-rose-400'
                }`}
              >
                {isDemoAccount
                  ? 'Demo Automation Available'
                  : 'Real Automation Locked'}
              </p>

              <p className="mt-2 text-sm text-slate-400">
                {isDemoAccount
                  ? 'Automated contract purchases use virtual funds only.'
                  : 'Switch to your Demo account to enable automated testing.'}
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

                <p className="text-xs text-slate-400 mt-1">
                  Automated Demo execution with live P/L and circuit breakers.
                </p>

              </div>

              <span
                className={`px-3 py-1.5 rounded-full text-xs font-black ${
                  isAutoBotRunning
                    ? 'bg-emerald-500/15 text-emerald-400'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                {isAutoBotRunning
                  ? 'AUTO BOT ACTIVE'
                  : 'STANDBY'}
              </span>

            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

              <div className="lg:col-span-2 bg-[#0f1522] border border-slate-800 rounded-2xl p-6 space-y-6">

                <div
                  className={`p-4 rounded-xl border ${
                    isDemoAccount
                      ? 'border-cyan-500/30 bg-cyan-500/5'
                      : 'border-rose-500/30 bg-rose-500/5'
                  }`}
                >

                  <p
                    className={`text-xs uppercase font-black ${
                      isDemoAccount
                        ? 'text-cyan-400'
                        : 'text-rose-400'
                    }`}
                  >
                    {isDemoAccount
                      ? 'Demo Only Automation'
                      : 'Real Account Protection'}
                  </p>

                  <p className="text-xs text-slate-400 mt-1">
                    Real-money automated purchases are disabled in this build.
                  </p>

                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                  <Field label="Synthetic Asset">
                    <select
                      value={
                        symbol
                      }
                      onChange={(
                        event
                      ) =>
                        setSymbol(
                          event.target
                            .value
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
                          event.target
                            .value
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
                          event.target
                            .value
                        );

                        if (
                          !isAutoBotRunning
                        ) {
                          setCurrentStake(
                            event.target
                              .value
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
                          event.target
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
                    <Field label="Prediction Digit">
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
                            event.target
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
                          event.target
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
                      type="number"
                      value={
                        takeProfit
                      }
                      onChange={(
                        event
                      ) =>
                        setTakeProfit(
                          event.target
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
                      type="number"
                      value={
                        stopLoss
                      }
                      onChange={(
                        event
                      ) =>
                        setStopLoss(
                          event.target
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
                      type="number"
                      min="1"
                      value={
                        maxConsecutiveLosses
                      }
                      onChange={(
                        event
                      ) =>
                        setMaxConsecutiveLosses(
                          event.target
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
                      onClick={
                        startAutoBot
                      }
                      disabled={
                        !isDemoAccount ||
                        !isTradingConnected ||
                        isContractOpen
                      }
                      className="py-4 bg-emerald-500 disabled:opacity-40 text-black font-black rounded-xl"
                    >
                      ▶ START DEMO AUTO BOT
                    </button>
                  ) : (
                    <button
                      onClick={() =>
                        stopAutoBot(
                          'Stopped manually'
                        )
                      }
                      className="py-4 bg-rose-600 text-white font-black rounded-xl"
                    >
                      ⏹ STOP AUTO BOT
                    </button>
                  )}

                  <button
                    onClick={
                      resetSessionStats
                    }
                    disabled={
                      isAutoBotRunning
                    }
                    className="py-4 bg-slate-800 disabled:opacity-40 font-black rounded-xl"
                  >
                    RESET SESSION
                  </button>

                </div>

                <div className="border border-slate-800 rounded-2xl p-5">

                  <p className="text-[10px] uppercase font-black text-slate-500">
                    Auto Bot Status
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
                  !isContractOpen && (
                    <div className="border-t border-slate-800 pt-6">

                      <p className="text-xs uppercase font-black text-slate-500 mb-3">
                        Manual Demo Test
                      </p>

                      <div className="grid sm:grid-cols-2 gap-3">

                        <button
                          onClick={
                            requestLiveProposal
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
                          onClick={
                            buyDemoProposal
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

                <div className="flex justify-between">

                  <div>

                    <h3 className="text-xs uppercase font-black">
                      Session Performance
                    </h3>

                    <p className="mt-1 text-[10px] text-slate-500">
                      Demo session only
                    </p>

                  </div>

                </div>

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
          'analyzer' && (
          <div className="bg-[#0f1522] border border-slate-800 p-6 rounded-2xl">

            <div className="flex justify-between flex-wrap gap-4">

              <div>

                <h2 className="text-xl font-black">
                  Digit Analyzer
                </h2>

                <p className="text-xs text-slate-400">
                  Last 100 ticks on {symbol}
                </p>

              </div>

              <div className="flex gap-2">

                <span className="bg-slate-800 px-3 py-1 rounded text-xs font-black text-cyan-400">
                  Even {
                    evenOddRatio.even
                  }%
                </span>

                <span className="bg-slate-800 px-3 py-1 rounded text-xs font-black text-amber-400">
                  Odd {
                    evenOddRatio.odd
                  }%
                </span>

              </div>

            </div>

            <div className="grid grid-cols-5 sm:grid-cols-10 gap-2 mt-6">

              {digitStats.map(
                (
                  percentage,
                  digit
                ) => (
                  <div
                    key={
                      digit
                    }
                    className="bg-[#080b11] border border-slate-800 rounded-xl p-3 text-center"
                  >

                    <p className="font-black">
                      {digit}
                    </p>

                    <p className="text-xs text-cyan-400 mt-2">
                      {
                        percentage
                      }%
                    </p>

                  </div>
                )
              )}

            </div>

            <div className="flex flex-wrap gap-2 mt-6">

              {digitHistory
                .slice(
                  0,
                  25
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
    accountType ===
    'demo';

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
