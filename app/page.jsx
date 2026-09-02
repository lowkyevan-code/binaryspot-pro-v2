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

export default function BinarySpotPro() {
  /* =========================
     AUTH + ACCOUNTS
  ========================= */

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

  const [balance, setBalance] =
    useState(null);

  const [currency, setCurrency] =
    useState('USD');

  const [accountType, setAccountType] =
    useState('');

  const [authError, setAuthError] =
    useState('');

  /* =========================
     NAVIGATION
  ========================= */

  const [activeTab, setActiveTab] =
    useState('overview');

  /* =========================
     MARKET DATA
  ========================= */

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

  const [lastDigit, setLastDigit] =
    useState(null);

  const [
    digitHistory,
    setDigitHistory,
  ] = useState([]);

  const [
    digitStats,
    setDigitStats,
  ] = useState(
    Array(10).fill(0)
  );

  const [
    evenOddRatio,
    setEvenOddRatio,
  ] = useState({
    even: 50,
    odd: 50,
  });

  /* =========================
     BOT STUDIO
  ========================= */

  const [strategy, setStrategy] =
    useState('DIGITDIFF');

  const [stake, setStake] =
    useState('1.00');

  const [duration, setDuration] =
    useState('1');

  const [
    predictionDigit,
    setPredictionDigit,
  ] = useState('0');

  const [takeProfit, setTakeProfit] =
    useState('10.00');

  const [stopLoss, setStopLoss] =
    useState('20.00');

  const [martingale, setMartingale] =
    useState('2.00');

  const [
    maxConsecutiveLosses,
    setMaxConsecutiveLosses,
  ] = useState('3');

  const [
    isBotRunning,
    setIsBotRunning,
  ] = useState(false);

  const [
    simulationSignal,
    setSimulationSignal,
  ] = useState(
    'Waiting for bot start'
  );

  const [
    simulatedTrades,
    setSimulatedTrades,
  ] = useState(0);

  const [
    simulatedWins,
    setSimulatedWins,
  ] = useState(0);

  const [
    simulatedLosses,
    setSimulatedLosses,
  ] = useState(0);

  const [
    consecutiveLosses,
    setConsecutiveLosses,
  ] = useState(0);

  const [botLogs, setBotLogs] =
    useState([]);

  /* =========================
     PROPOSALS
  ========================= */

  const [
    proposalLoading,
    setProposalLoading,
  ] = useState(false);

  const [
    proposalError,
    setProposalError,
  ] = useState('');

  const [
    proposalData,
    setProposalData,
  ] = useState(null);

  /* =========================
     REFS
  ========================= */

  const publicWsRef =
    useRef(null);

  const tradingWsRef =
    useRef(null);

  const publicSubscriptionRef =
    useRef(null);

  const publicPingRef =
    useRef(null);

  const tradingPingRef =
    useRef(null);

  const botRunningRef =
    useRef(false);

  useEffect(() => {
    botRunningRef.current =
      isBotRunning;
  }, [isBotRunning]);

  /* =========================
     LOGGING
  ========================= */

  const addBotLog =
    useCallback(
      (
        message,
        type = 'info'
      ) => {
        const time =
          new Date().toLocaleTimeString();

        setBotLogs(
          (previous) => [
            {
              time,
              message,
              type,
            },
            ...previous.slice(
              0,
              79
            ),
          ]
        );
      },
      []
    );

  /* =========================
     TRADING WEBSOCKET
  ========================= */

  const closeTradingSocket =
    useCallback(() => {
      if (
        tradingPingRef.current
      ) {
        clearInterval(
          tradingPingRef.current
        );

        tradingPingRef.current =
          null;
      }

      if (
        tradingWsRef.current
      ) {
        try {
          tradingWsRef.current.onclose =
            null;

          tradingWsRef.current.close();
        } catch {}

        tradingWsRef.current =
          null;
      }

      setIsTradingConnected(
        false
      );
    }, []);

  const connectTradingSocket =
    useCallback(
      (wsUrl) => {
        if (!wsUrl) {
          setIsTradingConnected(
            false
          );

          return;
        }

        closeTradingSocket();

        const ws =
          new WebSocket(wsUrl);

        tradingWsRef.current =
          ws;

        ws.onopen = () => {
          setIsTradingConnected(
            true
          );

          addBotLog(
            'Authenticated Deriv trading socket connected.',
            'system'
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

        ws.onmessage =
          (event) => {
            try {
              const data =
                JSON.parse(
                  event.data
                );

              if (data.error) {
                const message =
                  data.error
                    .message ||
                  'Deriv rejected the request.';

                if (
                  data.msg_type ===
                    'proposal' ||
                  data.echo_req
                    ?.proposal === 1
                ) {
                  setProposalLoading(
                    false
                  );

                  setProposalError(
                    message
                  );

                  addBotLog(
                    `Proposal rejected: ${message}`,
                    'error'
                  );
                }

                return;
              }

              if (
                data.msg_type ===
                  'proposal' &&
                data.proposal
              ) {
                setProposalLoading(
                  false
                );

                setProposalError(
                  ''
                );

                setProposalData(
                  data.proposal
                );

                addBotLog(
                  `Live proposal received. ID: ${data.proposal.id}`,
                  'success'
                );
              }

              if (
                data.msg_type ===
                  'balance' &&
                data.balance
              ) {
                setBalance(
                  data.balance
                    .balance
                );

                setCurrency(
                  data.balance
                    .currency ||
                    'USD'
                );
              }
            } catch (error) {
              console.error(
                'Trading message parse error:',
                error
              );
            }
          };

        ws.onerror = () => {
          setIsTradingConnected(
            false
          );

          addBotLog(
            'Authenticated trading socket error.',
            'error'
          );
        };

        ws.onclose = () => {
          setIsTradingConnected(
            false
          );
        };
      },
      [
        addBotLog,
        closeTradingSocket,
      ]
    );

  /* =========================
     LOAD / SWITCH ACCOUNT
  ========================= */

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
            setIsAuthorized(
              false
            );

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
              'No Deriv Options trading account was found.'
            );

            return;
          }

          setAccountId(
            data.account.id ||
              ''
          );

          setSelectedAccountId(
            data.account.id ||
              ''
          );

          setBalance(
            data.account
              .balance ?? null
          );

          setCurrency(
            data.account
              .currency ||
              'USD'
          );

          setAccountType(
            data.account.type ||
              ''
          );

          setProposalData(
            null
          );

          setProposalError(
            ''
          );

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
          console.error(
            'Session loading error:',
            error
          );

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

  const switchAccount =
    async (newAccountId) => {
      if (
        !newAccountId ||
        newAccountId ===
          selectedAccountId
      ) {
        return;
      }

      setIsBotRunning(
        false
      );

      setProposalData(
        null
      );

      setProposalError(
        ''
      );

      closeTradingSocket();

      addBotLog(
        'Switching Deriv trading account...',
        'system'
      );

      await loadDerivSession(
        newAccountId
      );
    };

  /* =========================
     INITIAL SESSION
  ========================= */

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

  /* =========================
     DIGIT STATISTICS
  ========================= */

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

  /* =========================
     BOT SIMULATION
  ========================= */

  const evaluateBotTick =
    useCallback(
      (digit) => {
        if (
          !botRunningRef.current
        ) {
          return;
        }

        const prediction =
          Number(
            predictionDigit
          );

        let wouldWin = false;

        if (
          strategy ===
          'DIGITDIFF'
        ) {
          wouldWin =
            digit !== prediction;
        }

        if (
          strategy ===
          'DIGITMATCH'
        ) {
          wouldWin =
            digit === prediction;
        }

        if (
          strategy ===
          'DIGITEVEN'
        ) {
          wouldWin =
            digit % 2 === 0;
        }

        if (
          strategy ===
          'DIGITODD'
        ) {
          wouldWin =
            digit % 2 !== 0;
        }

        if (
          strategy ===
          'DIGITOVER'
        ) {
          wouldWin =
            digit > prediction;
        }

        if (
          strategy ===
          'DIGITUNDER'
        ) {
          wouldWin =
            digit < prediction;
        }

        setSimulatedTrades(
          (value) =>
            value + 1
        );

        if (wouldWin) {
          setSimulatedWins(
            (value) =>
              value + 1
          );

          setConsecutiveLosses(
            0
          );

          setSimulationSignal(
            `SIMULATED WIN — digit ${digit}`
          );

          addBotLog(
            `Simulation WIN | ${strategy} | Digit ${digit}`,
            'success'
          );
        } else {
          setSimulatedLosses(
            (value) =>
              value + 1
          );

          setConsecutiveLosses(
            (previous) => {
              const next =
                previous + 1;

              if (
                next >=
                Number(
                  maxConsecutiveLosses
                )
              ) {
                setIsBotRunning(
                  false
                );

                setSimulationSignal(
                  'Bot stopped by loss limit'
                );

                addBotLog(
                  `Circuit breaker activated after ${next} consecutive simulated losses.`,
                  'error'
                );
              }

              return next;
            }
          );

          setSimulationSignal(
            `SIMULATED LOSS — digit ${digit}`
          );

          addBotLog(
            `Simulation LOSS | ${strategy} | Digit ${digit}`,
            'error'
          );
        }
      },
      [
        strategy,
        predictionDigit,
        maxConsecutiveLosses,
        addBotLog,
      ]
    );

  /* =========================
     PUBLIC MARKET SOCKET
  ========================= */

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
            ticks: symbol,
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

            if (data.error) {
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

                evaluateBotTick(
                  digit
                );
              }
            }
          } catch (error) {
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
      evaluateBotTick,
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

  /* =========================
     SYMBOL CHANGE
  ========================= */

  useEffect(() => {
    const ws =
      publicWsRef.current;

    if (
      !ws ||
      ws.readyState !==
        WebSocket.OPEN
    ) {
      return;
    }

    if (
      publicSubscriptionRef.current
    ) {
      ws.send(
        JSON.stringify({
          forget:
            publicSubscriptionRef.current,
        })
      );

      publicSubscriptionRef.current =
        null;
    }

    setDigitHistory([]);

    setDigitStats(
      Array(10).fill(0)
    );

    setEvenOddRatio({
      even: 50,
      odd: 50,
    });

    setProposalData(null);
    setProposalError('');

    ws.send(
      JSON.stringify({
        ticks: symbol,
        subscribe: 1,
      })
    );
  }, [symbol]);

  /* =========================
     OAUTH
  ========================= */

  const connectDeriv =
    async () => {
      try {
        setAuthError('');
        setIsConnecting(true);

        const characters =
          'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';

        const verifierBytes =
          new Uint8Array(64);

        crypto.getRandomValues(
          verifierBytes
        );

        const codeVerifier =
          Array.from(
            verifierBytes
          )
            .map(
              (byte) =>
                characters[
                  byte %
                    characters.length
                ]
            )
            .join('');

        const verifierData =
          new TextEncoder().encode(
            codeVerifier
          );

        const digest =
          await crypto.subtle.digest(
            'SHA-256',
            verifierData
          );

        const codeChallenge =
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
          codeVerifier
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
          codeChallenge
        );

        authUrl.searchParams.set(
          'code_challenge_method',
          'S256'
        );

        window.location.assign(
          authUrl.toString()
        );
      } catch (error) {
        console.error(
          error
        );

        setIsConnecting(false);

        setAuthError(
          'Unable to open Deriv authorization.'
        );
      }
    };

  /* =========================
     BOT CONTROLS
  ========================= */

  const startBot = () => {
    if (!isMarketConnected) {
      addBotLog(
        'Cannot start: market feed is offline.',
        'error'
      );

      return;
    }

    setSimulatedTrades(0);
    setSimulatedWins(0);
    setSimulatedLosses(0);
    setConsecutiveLosses(0);

    setSimulationSignal(
      'Simulation running'
    );

    setIsBotRunning(true);

    addBotLog(
      `Bot simulation started: ${strategy}`,
      'system'
    );
  };

  const stopBot = () => {
    setIsBotRunning(false);

    setSimulationSignal(
      'Simulation stopped'
    );

    addBotLog(
      'Bot simulation stopped manually.',
      'system'
    );
  };

  const resetBotStats = () => {
    setSimulatedTrades(0);
    setSimulatedWins(0);
    setSimulatedLosses(0);
    setConsecutiveLosses(0);

    setSimulationSignal(
      'Waiting for bot start'
    );

    setBotLogs([]);

    setProposalData(null);
    setProposalError('');
  };

  /* =========================
     LIVE PROPOSAL
  ========================= */

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
          'Authenticated trading connection is not ready.'
        );

        return;
      }

      const parsedStake =
        Number(stake);

      const parsedDuration =
        Number(duration);

      const prediction =
        Number(
          predictionDigit
        );

      if (
        !Number.isFinite(
          parsedStake
        ) ||
        parsedStake <= 0
      ) {
        setProposalError(
          'Enter a valid stake.'
        );

        return;
      }

      if (
        !Number.isInteger(
          parsedDuration
        ) ||
        parsedDuration < 1
      ) {
        setProposalError(
          'Enter a valid duration.'
        );

        return;
      }

      const payload = {
        proposal: 1,

        amount:
          parsedStake,

        basis:
          'stake',

        contract_type:
          strategy,

        currency:
          currency ||
          'USD',

        duration:
          parsedDuration,

        duration_unit:
          't',

        underlying_symbol:
          symbol,

        subscribe: 1,
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

      setProposalLoading(
        true
      );

      addBotLog(
        `Requesting ${strategy} proposal on ${symbol}.`,
        'system'
      );

      ws.send(
        JSON.stringify(
          payload
        )
      );
    };

  /* =========================
     DERIVED VALUES
  ========================= */

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
    simulatedTrades > 0
      ? (
          (simulatedWins /
            simulatedTrades) *
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
    accountType === 'demo';

  /* =========================
     UI
  ========================= */

  return (
    <main className="min-h-screen bg-[#080b11] text-slate-100">

      {/* STATUS BAR */}

      <div className="border-b border-slate-800 bg-[#0e131d] px-4 py-2.5">

        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3 text-xs">

          <div className="flex items-center gap-4">

            <div className="flex items-center gap-2">

              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  isMarketConnected
                    ? 'bg-emerald-400'
                    : 'bg-rose-500'
                }`}
              />

              <span className="font-semibold text-slate-300">
                {isMarketConnected
                  ? 'Market Feed Active'
                  : 'Market Feed Offline'}
              </span>

            </div>

            {isAuthorized && (
              <div className="flex items-center gap-2">

                <span
                  className={`h-2.5 w-2.5 rounded-full ${
                    isTradingConnected
                      ? 'bg-cyan-400'
                      : 'bg-amber-400'
                  }`}
                />

                <span className="font-semibold text-slate-300">
                  {isTradingConnected
                    ? 'Trading Socket Active'
                    : 'Trading Socket Offline'}
                </span>

              </div>
            )}

          </div>

          <div className="flex items-center gap-4 font-mono">

            <span className="text-slate-500">
              {symbol}
            </span>

            <span className="font-black text-emerald-400">
              {formattedQuote}
            </span>

            <span className="bg-slate-800 border border-slate-700 px-2 py-1 rounded text-cyan-400 font-black">
              {lastDigit !== null
                ? lastDigit
                : '-'}
            </span>

          </div>

        </div>

      </div>

      {/* HEADER */}

      <header className="border-b border-slate-800 bg-[#0d121c]">

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-wrap items-center justify-between gap-3">

          <div className="flex items-center gap-3">

            <div className="h-10 w-10 bg-gradient-to-tr from-emerald-500 to-teal-400 rounded-xl flex items-center justify-center font-black text-black text-xl">
              BS
            </div>

            <div>

              <div className="text-lg font-black text-white">
                BINARY
                <span className="text-emerald-400">
                  SPOT
                </span>{' '}
                PRO
              </div>

              <div className="text-[9px] uppercase tracking-widest text-emerald-500 font-bold">
                Algorithmic Hub
              </div>

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
              className="px-4 py-2.5 bg-emerald-500 text-black font-black text-xs uppercase rounded-xl"
            >
              Connect Deriv
            </button>
          ) : (
            <div className="flex items-center gap-3">

              {accounts.length >
                1 && (
                <select
                  value={
                    selectedAccountId
                  }
                  onChange={(event) =>
                    switchAccount(
                      event.target
                        .value
                    )
                  }
                  disabled={
                    isLoading
                  }
                  className="bg-[#151d2d] border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold"
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

              <div
                className={`border px-3 py-2 rounded-xl text-right ${
                  isDemoAccount
                    ? 'bg-cyan-950/20 border-cyan-700'
                    : 'bg-rose-950/20 border-rose-700'
                }`}
              >

                <p
                  className={`text-[9px] uppercase font-black ${
                    isDemoAccount
                      ? 'text-cyan-400'
                      : 'text-rose-400'
                  }`}
                >
                  {isDemoAccount
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

            </div>
          )}

        </div>

      </header>

      {/* NAVIGATION */}

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
                    : 'bg-slate-900 text-slate-400 border border-slate-800'
                }`}
              >
                {label}
              </button>
            )
          )}

        </div>

      </div>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {authError && (
          <div className="mb-6 border border-rose-800 bg-rose-950/30 text-rose-300 p-4 rounded-xl text-sm">
            ⚠️ {authError}
          </div>
        )}

        {/* OVERVIEW */}

        {activeTab ===
          'overview' && (
          <div className="space-y-6">

            <div className="rounded-3xl border border-slate-800 bg-gradient-to-br from-[#121824] via-[#0d121c] to-[#080b11] p-8 md:p-12">

              <div className="max-w-2xl">

                <span className="inline-flex px-3 py-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 text-xs text-emerald-400 font-bold">
                  BinarySpot Pro
                </span>

                <h1 className="mt-5 text-4xl sm:text-5xl font-black">
                  Automate Your Edge on Volatility Indices.
                </h1>

                <p className="mt-5 text-slate-400 leading-relaxed">
                  OAuth, live market data, digit analysis and authenticated Deriv proposal access are active.
                </p>

              </div>

            </div>

            {isAuthorized && (
              <div
                className={`p-5 rounded-2xl border ${
                  isDemoAccount
                    ? 'border-cyan-500/30 bg-cyan-500/5'
                    : 'border-rose-500/30 bg-rose-500/5'
                }`}
              >

                <p
                  className={`text-xs font-black uppercase ${
                    isDemoAccount
                      ? 'text-cyan-400'
                      : 'text-rose-400'
                  }`}
                >
                  Current Trading Account
                </p>

                <p className="mt-2 font-black">
                  {isDemoAccount
                    ? 'Demo mode selected'
                    : 'Real-money account selected'}
                </p>

                <p className="mt-1 text-xs text-slate-400">
                  Use the account selector at the top to switch between your Deriv Options accounts.
                </p>

              </div>
            )}

          </div>
        )}

        {/* BOT STUDIO */}

        {activeTab ===
          'bots' && (
          <div className="space-y-6">

            <div>

              <h2 className="text-xl font-black">
                Bot Studio
              </h2>

              <p className="text-xs text-slate-400 mt-1">
                Strategy simulation and live Deriv proposal testing.
              </p>

            </div>

            <div
              className={`p-4 rounded-xl border ${
                isDemoAccount
                  ? 'border-cyan-500/30 bg-cyan-500/5'
                  : 'border-rose-500/30 bg-rose-500/5'
              }`}
            >

              <p
                className={`text-xs font-black uppercase ${
                  isDemoAccount
                    ? 'text-cyan-400'
                    : 'text-rose-400'
                }`}
              >
                {isDemoAccount
                  ? 'Demo Trading Account'
                  : 'Real Trading Account'}
              </p>

              <p className="mt-1 text-xs text-slate-400">
                {isDemoAccount
                  ? 'Safe development account selected. The next stage can test contract purchases using virtual funds.'
                  : 'Real-money account selected. Purchase testing will remain blocked while we develop.'}
              </p>

            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

              <div className="lg:col-span-2 bg-[#0f1522] border border-slate-800 rounded-2xl p-6 space-y-6">

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                  <div>

                    <label className="text-xs text-slate-400 font-bold">
                      Synthetic Asset
                    </label>

                    <select
                      value={symbol}
                      onChange={(e) =>
                        setSymbol(
                          e.target
                            .value
                        )
                      }
                      className="w-full mt-2 bg-[#151d2d] border border-slate-700 p-3 rounded-xl"
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

                  </div>

                  <div>

                    <label className="text-xs text-slate-400 font-bold">
                      Strategy
                    </label>

                    <select
                      value={strategy}
                      onChange={(e) => {
                        setStrategy(
                          e.target
                            .value
                        );

                        setProposalData(
                          null
                        );
                      }}
                      className="w-full mt-2 bg-[#151d2d] border border-slate-700 p-3 rounded-xl"
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

                  </div>

                  <div>

                    <label className="text-xs text-slate-400 font-bold">
                      Stake
                    </label>

                    <input
                      type="number"
                      value={stake}
                      onChange={(e) =>
                        setStake(
                          e.target
                            .value
                        )
                      }
                      className="w-full mt-2 bg-[#151d2d] border border-slate-700 p-3 rounded-xl font-mono"
                    />

                  </div>

                  <div>

                    <label className="text-xs text-slate-400 font-bold">
                      Duration
                    </label>

                    <input
                      type="number"
                      min="1"
                      max="10"
                      value={duration}
                      onChange={(e) =>
                        setDuration(
                          e.target
                            .value
                        )
                      }
                      className="w-full mt-2 bg-[#151d2d] border border-slate-700 p-3 rounded-xl font-mono"
                    />

                  </div>

                  {needsPredictionDigit && (
                    <div>

                      <label className="text-xs text-cyan-400 font-bold">
                        Prediction Digit
                      </label>

                      <input
                        type="number"
                        min="0"
                        max="9"
                        value={
                          predictionDigit
                        }
                        onChange={(e) =>
                          setPredictionDigit(
                            e.target
                              .value
                          )
                        }
                        className="w-full mt-2 bg-[#151d2d] border border-cyan-900 p-3 rounded-xl font-mono"
                      />

                    </div>
                  )}

                  <div>

                    <label className="text-xs text-slate-400 font-bold">
                      Martingale
                    </label>

                    <input
                      type="number"
                      value={
                        martingale
                      }
                      onChange={(e) =>
                        setMartingale(
                          e.target
                            .value
                        )
                      }
                      className="w-full mt-2 bg-[#151d2d] border border-slate-700 p-3 rounded-xl"
                    />

                  </div>

                  <div>

                    <label className="text-xs text-emerald-400 font-bold">
                      Take Profit
                    </label>

                    <input
                      type="number"
                      value={
                        takeProfit
                      }
                      onChange={(e) =>
                        setTakeProfit(
                          e.target
                            .value
                        )
                      }
                      className="w-full mt-2 bg-[#151d2d] border border-emerald-900 p-3 rounded-xl"
                    />

                  </div>

                  <div>

                    <label className="text-xs text-rose-400 font-bold">
                      Stop Loss
                    </label>

                    <input
                      type="number"
                      value={stopLoss}
                      onChange={(e) =>
                        setStopLoss(
                          e.target
                            .value
                        )
                      }
                      className="w-full mt-2 bg-[#151d2d] border border-rose-900 p-3 rounded-xl"
                    />

                  </div>

                  <div>

                    <label className="text-xs text-rose-400 font-bold">
                      Max Consecutive Losses
                    </label>

                    <input
                      type="number"
                      value={
                        maxConsecutiveLosses
                      }
                      onChange={(e) =>
                        setMaxConsecutiveLosses(
                          e.target
                            .value
                        )
                      }
                      className="w-full mt-2 bg-[#151d2d] border border-rose-900 p-3 rounded-xl"
                    />

                  </div>

                </div>

                <div className="grid sm:grid-cols-2 gap-3">

                  {!isBotRunning ? (
                    <button
                      type="button"
                      onClick={
                        startBot
                      }
                      className="py-4 bg-emerald-500 text-black font-black rounded-xl"
                    >
                      ▶ START SIMULATION
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={
                        stopBot
                      }
                      className="py-4 bg-rose-600 font-black rounded-xl"
                    >
                      ⏹ STOP SIMULATION
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={
                      requestLiveProposal
                    }
                    disabled={
                      proposalLoading ||
                      !isTradingConnected
                    }
                    className="py-4 bg-cyan-500 disabled:opacity-40 text-black font-black rounded-xl"
                  >
                    {proposalLoading
                      ? 'REQUESTING...'
                      : 'GET LIVE PROPOSAL'}
                  </button>

                </div>

                {proposalError && (
                  <div className="border border-rose-800 bg-rose-950/30 p-4 rounded-xl text-rose-300 text-sm">
                    ⚠️ {proposalError}
                  </div>
                )}

                {proposalData && (
                  <div className="border border-cyan-500/30 bg-cyan-500/5 rounded-2xl p-5">

                    <p className="text-xs font-black uppercase text-cyan-400">
                      Live Proposal
                    </p>

                    <p className="text-xs font-mono text-slate-400 mt-2 break-all">
                      ID: {proposalData.id}
                    </p>

                    <div className="grid grid-cols-2 gap-3 mt-4">

                      <div className="bg-[#080b11] p-3 rounded-xl">
                        <p className="text-[10px] text-slate-500">
                          Ask Price
                        </p>

                        <p className="font-black font-mono">
                          {proposalData.ask_price ??
                            '-'}
                        </p>
                      </div>

                      <div className="bg-[#080b11] p-3 rounded-xl">
                        <p className="text-[10px] text-slate-500">
                          Payout
                        </p>

                        <p className="font-black font-mono text-emerald-400">
                          {proposalData.payout ??
                            '-'}
                        </p>
                      </div>

                    </div>

                    <p className="text-[11px] text-slate-500 mt-4">
                      Proposal only. No contract has been purchased.
                    </p>

                  </div>
                )}

              </div>

              {/* STREAM */}

              <div className="bg-[#0f1522] border border-slate-800 rounded-2xl p-5">

                <div className="flex justify-between">

                  <div>

                    <h3 className="font-black text-xs uppercase">
                      Bot Stream
                    </h3>

                    <p className="text-[10px] text-slate-500 mt-1">
                      {simulationSignal}
                    </p>

                  </div>

                  <button
                    onClick={
                      resetBotStats
                    }
                    className="text-xs text-slate-500"
                  >
                    Reset
                  </button>

                </div>

                <div className="grid grid-cols-2 gap-2 mt-4">

                  <div className="bg-[#080b11] p-3 rounded-xl">
                    <p className="text-[10px] text-slate-500">
                      TRADES
                    </p>
                    <p className="font-black text-xl">
                      {simulatedTrades}
                    </p>
                  </div>

                  <div className="bg-[#080b11] p-3 rounded-xl">
                    <p className="text-[10px] text-slate-500">
                      WIN RATE
                    </p>
                    <p className="font-black text-xl text-emerald-400">
                      {winRate}%
                    </p>
                  </div>

                  <div className="bg-[#080b11] p-3 rounded-xl">
                    <p className="text-[10px] text-slate-500">
                      WINS
                    </p>
                    <p className="font-black text-xl text-emerald-400">
                      {simulatedWins}
                    </p>
                  </div>

                  <div className="bg-[#080b11] p-3 rounded-xl">
                    <p className="text-[10px] text-slate-500">
                      LOSSES
                    </p>
                    <p className="font-black text-xl text-rose-400">
                      {simulatedLosses}
                    </p>
                  </div>

                </div>

                <div className="mt-4 bg-[#080b11] rounded-xl p-3 max-h-[400px] overflow-y-auto space-y-2">

                  {botLogs.length ===
                  0 ? (
                    <p className="text-xs text-slate-600 text-center py-10">
                      Activity will appear here.
                    </p>
                  ) : (
                    botLogs.map(
                      (
                        log,
                        index
                      ) => (
                        <div
                          key={
                            index
                          }
                          className="text-xs font-mono border border-slate-800 rounded-lg p-2"
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
                                : 'text-slate-400'
                            }
                          >
                            {log.message}
                          </span>
                        </div>
                      )
                    )}

                </div>

              </div>

            </div>

          </div>
        )}

        {/* ANALYZER */}

        {activeTab ===
          'analyzer' && (
          <div className="bg-[#0f1522] border border-slate-800 rounded-2xl p-6">

            <div className="flex justify-between gap-4 flex-wrap">

              <div>

                <h2 className="font-black text-xl">
                  Digit Analyzer
                </h2>

                <p className="text-xs text-slate-400">
                  Last 100 ticks on {symbol}
                </p>

              </div>

              <div className="flex gap-2">

                <span className="px-3 py-1 rounded bg-slate-800 text-cyan-400 text-xs font-black">
                  Even {evenOddRatio.even}%
                </span>

                <span className="px-3 py-1 rounded bg-slate-800 text-amber-400 text-xs font-black">
                  Odd {evenOddRatio.odd}%
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
                    key={digit}
                    className="text-center bg-[#080b11] rounded-xl p-3 border border-slate-800"
                  >
                    <p className="font-black">
                      {digit}
                    </p>

                    <p className="text-xs text-cyan-400 mt-2">
                      {percentage}%
                    </p>
                  </div>
                )
              )}

            </div>

            <div className="flex flex-wrap gap-2 mt-6">

              {digitHistory
                .slice(0, 25)
                .map(
                  (
                    digit,
                    index
                  ) => (
                    <span
                      key={index}
                      className={`h-9 w-9 rounded-xl flex items-center justify-center font-black ${
                        index === 0
                          ? 'bg-emerald-500 text-black'
                          : 'bg-slate-800'
                      }`}
                    >
                      {digit}
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
