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
  // Authentication
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

  // Navigation
  const [activeTab, setActiveTab] = useState('overview');

  // Market
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

  // Bot
  const [strategy, setStrategy] = useState('DIGITDIFF');
  const [stake, setStake] = useState('1.00');
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

  const [isBotRunning, setIsBotRunning] =
    useState(false);

  const [simulationSignal, setSimulationSignal] =
    useState('Waiting for bot start');

  const [simulatedTrades, setSimulatedTrades] =
    useState(0);

  const [simulatedWins, setSimulatedWins] =
    useState(0);

  const [simulatedLosses, setSimulatedLosses] =
    useState(0);

  const [consecutiveLosses, setConsecutiveLosses] =
    useState(0);

  const [botLogs, setBotLogs] = useState([]);

  // Proposal
  const [proposalLoading, setProposalLoading] =
    useState(false);

  const [proposalError, setProposalError] =
    useState('');

  const [proposalData, setProposalData] =
    useState(null);

  // Refs
  const publicWsRef = useRef(null);
  const tradingWsRef = useRef(null);

  const publicSubscriptionRef = useRef(null);

  const publicPingRef = useRef(null);
  const tradingPingRef = useRef(null);

  const botRunningRef = useRef(false);

  useEffect(() => {
    botRunningRef.current = isBotRunning;
  }, [isBotRunning]);

  const addBotLog = useCallback(
    (message, type = 'info') => {
      const time = new Date().toLocaleTimeString();

      setBotLogs((previous) => [
        {
          time,
          message,
          type,
        },
        ...previous.slice(0, 79),
      ]);
    },
    []
  );

  // Trading socket cleanup
  const closeTradingSocket = useCallback(() => {
    if (tradingPingRef.current) {
      clearInterval(tradingPingRef.current);
      tradingPingRef.current = null;
    }

    if (tradingWsRef.current) {
      try {
        tradingWsRef.current.onclose = null;
        tradingWsRef.current.close();
      } catch {}

      tradingWsRef.current = null;
    }

    setIsTradingConnected(false);
  }, []);

  // Authenticated trading websocket
  const connectTradingSocket = useCallback(
    (wsUrl) => {
      if (!wsUrl) {
        setIsTradingConnected(false);
        return;
      }

      closeTradingSocket();

      const ws = new WebSocket(wsUrl);

      tradingWsRef.current = ws;

      ws.onopen = () => {
        setIsTradingConnected(true);

        addBotLog(
          'Authenticated Deriv trading socket connected.',
          'system'
        );

        tradingPingRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
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
          const data = JSON.parse(event.data);

          if (data.error) {
            const message =
              data.error.message ||
              'Deriv rejected the request.';

            if (
              data.msg_type === 'proposal' ||
              data.echo_req?.proposal === 1
            ) {
              setProposalLoading(false);
              setProposalError(message);

              addBotLog(
                `Proposal rejected: ${message}`,
                'error'
              );
            }

            return;
          }

          if (
            data.msg_type === 'proposal' &&
            data.proposal
          ) {
            setProposalLoading(false);
            setProposalError('');
            setProposalData(data.proposal);

            addBotLog(
              `Live proposal received. ID: ${data.proposal.id}`,
              'success'
            );
          }

          if (
            data.msg_type === 'balance' &&
            data.balance
          ) {
            setBalance(data.balance.balance);
            setCurrency(
              data.balance.currency || 'USD'
            );
          }
        } catch (error) {
          console.error(
            'Trading socket message error:',
            error
          );
        }
      };

      ws.onerror = () => {
        setIsTradingConnected(false);

        addBotLog(
          'Authenticated trading socket error.',
          'error'
        );
      };

      ws.onclose = () => {
        setIsTradingConnected(false);
      };
    },
    [addBotLog, closeTradingSocket]
  );

  // Load Deriv account/session
  const loadDerivSession = useCallback(
    async (requestedAccountId = '') => {
      try {
        setIsLoading(true);
        setAuthError('');

        let endpoint = '/api/auth/deriv/session';

        if (requestedAccountId) {
          endpoint += `?account_id=${encodeURIComponent(
            requestedAccountId
          )}`;
        }

        const response = await fetch(endpoint, {
          method: 'GET',
          credentials: 'include',
          cache: 'no-store',
        });

        const data = await response.json();

        if (!response.ok || !data.authenticated) {
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

        const availableAccounts = Array.isArray(
          data.accounts
        )
          ? data.accounts
          : [];

        setAccounts(availableAccounts);

        if (!data.account) {
          setAuthError(
            'No Deriv Options account was found.'
          );

          return;
        }

        setAccountId(data.account.id || '');
        setSelectedAccountId(
          data.account.id || ''
        );

        setAccountType(
          data.account.type || ''
        );

        setBalance(
          data.account.balance ?? null
        );

        setCurrency(
          data.account.currency || 'USD'
        );

        setProposalData(null);
        setProposalError('');

        if (data.wsUrl) {
          connectTradingSocket(data.wsUrl);
        } else {
          closeTradingSocket();

          if (data.error) {
            setAuthError(data.error);
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

  const switchAccount = async (
    newAccountId
  ) => {
    if (
      !newAccountId ||
      newAccountId === selectedAccountId
    ) {
      return;
    }

    setIsBotRunning(false);

    setProposalData(null);
    setProposalError('');

    addBotLog(
      'Switching Deriv account...',
      'system'
    );

    await loadDerivSession(newAccountId);
  };

  // Initial session restore
  useEffect(() => {
    const params = new URLSearchParams(
      window.location.search
    );

    const derivError =
      params.get('deriv_error');

    const derivConnected =
      params.get('deriv_connected');

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
      closeTradingSocket();
    };
  }, [
    loadDerivSession,
    closeTradingSocket,
  ]);

  // Digit stats
  const updateDigitStats = useCallback(
    (digit) => {
      setDigitHistory((previous) => {
        const updated = [
          digit,
          ...previous,
        ].slice(0, 100);

        const counts =
          Array(10).fill(0);

        let evenCount = 0;

        updated.forEach((item) => {
          counts[item] += 1;

          if (item % 2 === 0) {
            evenCount += 1;
          }
        });

        const total =
          updated.length || 1;

        setDigitStats(
          counts.map((count) =>
            Math.round(
              (count / total) * 100
            )
          )
        );

        setEvenOddRatio({
          even: Math.round(
            (evenCount / total) * 100
          ),

          odd: Math.round(
            ((total - evenCount) /
              total) *
              100
          ),
        });

        return updated;
      });
    },
    []
  );

  // Simulation
  const evaluateBotTick = useCallback(
    (digit) => {
      if (!botRunningRef.current) {
        return;
      }

      const prediction = Number(
        predictionDigit
      );

      let wouldWin = false;

      switch (strategy) {
        case 'DIGITDIFF':
          wouldWin =
            digit !== prediction;
          break;

        case 'DIGITMATCH':
          wouldWin =
            digit === prediction;
          break;

        case 'DIGITEVEN':
          wouldWin =
            digit % 2 === 0;
          break;

        case 'DIGITODD':
          wouldWin =
            digit % 2 !== 0;
          break;

        case 'DIGITOVER':
          wouldWin =
            digit > prediction;
          break;

        case 'DIGITUNDER':
          wouldWin =
            digit < prediction;
          break;

        default:
          wouldWin = false;
      }

      setSimulatedTrades(
        (value) => value + 1
      );

      if (wouldWin) {
        setSimulatedWins(
          (value) => value + 1
        );

        setConsecutiveLosses(0);

        setSimulationSignal(
          `SIMULATED WIN — digit ${digit}`
        );

        addBotLog(
          `Simulation WIN | ${strategy} | Digit ${digit}`,
          'success'
        );

        return;
      }

      setSimulatedLosses(
        (value) => value + 1
      );

      setConsecutiveLosses(
        (previous) => {
          const next =
            previous + 1;

          if (
            next >=
            Number(maxConsecutiveLosses)
          ) {
            setIsBotRunning(false);

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
    },
    [
      strategy,
      predictionDigit,
      maxConsecutiveLosses,
      addBotLog,
    ]
  );

  // Public market websocket
  const connectMarket = useCallback(() => {
    if (
      publicWsRef.current &&
      (
        publicWsRef.current.readyState ===
          WebSocket.OPEN ||
        publicWsRef.current.readyState ===
          WebSocket.CONNECTING
      )
    ) {
      return;
    }

    const ws = new WebSocket(
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

      if (publicPingRef.current) {
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

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(
          event.data
        );

        if (data.error) {
          return;
        }

        if (
          data.msg_type === 'tick' &&
          data.tick
        ) {
          if (
            data.subscription?.id
          ) {
            publicSubscriptionRef.current =
              data.subscription.id;
          }

          const quote = Number(
            data.tick.quote
          );

          setLastTick((previous) => {
            setPrevTick(previous);
            return quote;
          });

          const quoteText = String(
            data.tick.quote
          );

          const numericOnly =
            quoteText.replace(
              /\D/g,
              ''
            );

          if (numericOnly.length) {
            const digit = Number(
              numericOnly[
                numericOnly.length - 1
              ]
            );

            setLastDigit(digit);

            updateDigitStats(digit);
            evaluateBotTick(digit);
          }
        }
      } catch (error) {
        console.error(
          'Market tick error:',
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
  }, [
    symbol,
    updateDigitStats,
    evaluateBotTick,
  ]);

  useEffect(() => {
    connectMarket();

    return () => {
      if (publicPingRef.current) {
        clearInterval(
          publicPingRef.current
        );
      }

      if (publicWsRef.current) {
        publicWsRef.current.onclose =
          null;

        publicWsRef.current.close();
      }
    };
  }, [connectMarket]);

  // Change market subscription
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

  // OAuth
  const connectDeriv = async () => {
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
        Array.from(verifierBytes)
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

      const codeChallenge = btoa(
        String.fromCharCode(
          ...new Uint8Array(digest)
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
        codeVerifier
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
        'OAuth error:',
        error
      );

      setIsConnecting(false);

      setAuthError(
        'Unable to open Deriv authorization.'
      );
    }
  };

  // Bot controls
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
    setIsBotRunning(false);

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

  // Proposal
  const requestLiveProposal = () => {
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

    const parsedPrediction =
      Number(predictionDigit);

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
      amount: parsedStake,
      basis: 'stake',
      contract_type: strategy,
      currency:
        currency || 'USD',
      duration:
        parsedDuration,
      duration_unit: 't',
      underlying_symbol: symbol,
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
        String(
          parsedPrediction
        );
    }

    setProposalLoading(true);

    addBotLog(
      `Requesting ${strategy} proposal on ${symbol}.`,
      'system'
    );

    try {
      ws.send(
        JSON.stringify(payload)
      );
    } catch (error) {
      console.error(error);

      setProposalLoading(false);

      setProposalError(
        'Unable to send proposal request.'
      );
    }
  };

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

  return (
    <main className="min-h-screen bg-[#080b11] text-slate-100">
      {/* Status */}
      <div className="border-b border-slate-800 bg-[#0e131d] px-4 py-2.5">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  isMarketConnected
                    ? 'bg-emerald-400'
                    : 'bg-rose-500'
                }`}
              />

              <span className="font-semibold">
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

                <span className="font-semibold">
                  {isTradingConnected
                    ? 'Trading Socket Active'
                    : 'Trading Socket Offline'}
                </span>
              </div>
            )}
          </div>

          <div className="flex gap-4 items-center font-mono">
            <span className="text-slate-500">
              {symbol}
            </span>

            <span className="text-emerald-400 font-black">
              {formattedQuote}
            </span>

            <span className="bg-slate-800 px-2 py-1 rounded text-cyan-400 font-black">
              {lastDigit !== null
                ? lastDigit
                : '-'}
            </span>
          </div>
        </div>
      </div>

      {/* Header */}
      <header className="border-b border-slate-800 bg-[#0d121c]">
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex gap-3 items-center">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-black flex items-center justify-center text-xl font-black">
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

              <div className="text-[9px] tracking-widest text-emerald-500 uppercase font-bold">
                Algorithmic Hub
              </div>
            </div>
          </div>

          {!isAuthorized ? (
            <button
              onClick={connectDeriv}
              disabled={
                isLoading ||
                isConnecting
              }
              className="px-4 py-3 bg-emerald-500 text-black font-black rounded-xl text-xs"
            >
              {isConnecting
                ? 'OPENING...'
                : 'CONNECT DERIV'}
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
                  disabled={isLoading}
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

              <div
                className={`border rounded-xl px-3 py-2 text-right ${
                  isDemoAccount
                    ? 'border-cyan-700 bg-cyan-950/20'
                    : 'border-rose-700 bg-rose-950/20'
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

      {/* Nav */}
      <div className="border-b border-slate-800 bg-[#0b1019]">
        <div className="max-w-7xl mx-auto px-4 py-2 flex gap-2 overflow-x-auto">
          {[
            {
              id: 'overview',
              label: '🏠 Overview',
            },
            {
              id: 'bots',
              label: '🤖 Bot Studio',
            },
            {
              id: 'analyzer',
              label:
                '📊 Digit Analyzer',
            },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() =>
                setActiveTab(tab.id)
              }
              className={`px-4 py-2 rounded-xl text-xs font-black whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-emerald-500 text-black'
                  : 'bg-slate-900 text-slate-400 border border-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <section className="max-w-7xl mx-auto px-4 py-8">
        {authError && (
          <div className="mb-6 border border-rose-800 bg-rose-950/30 p-4 rounded-xl text-rose-300">
            ⚠️ {authError}
          </div>
        )}

        {activeTab ===
          'overview' && (
          <div className="space-y-6">
            <div className="rounded-3xl border border-slate-800 bg-[#0f1522] p-8 md:p-12">
              <span className="inline-flex rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-400">
                BinarySpot Pro
              </span>

              <h1 className="mt-5 max-w-3xl text-4xl md:text-5xl font-black">
                Automate Your Edge on Volatility Indices.
              </h1>

              <p className="mt-5 text-slate-400 max-w-2xl">
                OAuth, live market data, digit analysis,
                account switching and authenticated proposal
                access are active.
              </p>
            </div>

            {isAuthorized && (
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
                    ? 'Demo Mode Active'
                    : 'Real Account Selected'}
                </p>

                <p className="mt-2 text-sm text-slate-400">
                  {isDemoAccount
                    ? 'This account uses virtual funds and will be used for our first contract-purchase test.'
                    : 'Real-money execution remains blocked while development continues.'}
                </p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'bots' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-black">
                Bot Studio
              </h2>

              <p className="text-xs text-slate-400 mt-1">
                Live strategy simulation and Deriv proposal testing.
              </p>
            </div>

            <div
              className={`rounded-xl border p-4 ${
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
                  ? 'Demo Trading Account'
                  : 'Real Trading Account'}
              </p>

              <p className="text-xs text-slate-400 mt-1">
                {isDemoAccount
                  ? 'Virtual-funds account selected.'
                  : 'Real-money purchase testing is disabled.'}
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-[#0f1522] border border-slate-800 rounded-2xl p-6 space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Synthetic Asset">
                    <select
                      value={symbol}
                      onChange={(event) =>
                        setSymbol(
                          event.target.value
                        )
                      }
                      className="inputStyle"
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
                        setStrategy(
                          event.target.value
                        );

                        setProposalData(null);
                        setProposalError('');
                      }}
                      className="inputStyle"
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

                  <Field label="Stake">
                    <input
                      type="number"
                      value={stake}
                      onChange={(event) =>
                        setStake(
                          event.target.value
                        )
                      }
                      className="inputStyle"
                    />
                  </Field>

                  <Field label="Duration (Ticks)">
                    <input
                      type="number"
                      min="1"
                      max="10"
                      value={duration}
                      onChange={(event) =>
                        setDuration(
                          event.target.value
                        )
                      }
                      className="inputStyle"
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
                        onChange={(event) =>
                          setPredictionDigit(
                            event.target.value
                          )
                        }
                        className="inputStyle"
                      />
                    </Field>
                  )}

                  <Field label="Martingale">
                    <input
                      type="number"
                      value={martingale}
                      onChange={(event) =>
                        setMartingale(
                          event.target.value
                        )
                      }
                      className="inputStyle"
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
                      className="inputStyle"
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
                      className="inputStyle"
                    />
                  </Field>

                  <Field label="Max Consecutive Losses">
                    <input
                      type="number"
                      value={
                        maxConsecutiveLosses
                      }
                      onChange={(event) =>
                        setMaxConsecutiveLosses(
                          event.target.value
                        )
                      }
                      className="inputStyle"
                    />
                  </Field>
                </div>

                <div className="grid sm:grid-cols-2 gap-3">
                  {!isBotRunning ? (
                    <button
                      onClick={startBot}
                      className="py-4 bg-emerald-500 text-black font-black rounded-xl"
                    >
                      ▶ START SIMULATION
                    </button>
                  ) : (
                    <button
                      onClick={stopBot}
                      className="py-4 bg-rose-600 text-white font-black rounded-xl"
                    >
                      ⏹ STOP SIMULATION
                    </button>
                  )}

                  <button
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
                  <div className="border border-rose-800 bg-rose-950/30 p-4 rounded-xl text-rose-300">
                    ⚠️ {proposalError}
                  </div>
                )}

                {proposalData && (
                  <div className="border border-cyan-500/30 bg-cyan-500/5 rounded-2xl p-5">
                    <p className="text-xs uppercase font-black text-cyan-400">
                      Live Proposal
                    </p>

                    <p className="mt-2 text-xs font-mono text-slate-400 break-all">
                      ID: {proposalData.id}
                    </p>

                    <div className="grid grid-cols-2 gap-3 mt-4">
                      <StatBox
                        label="Ask Price"
                        value={
                          proposalData.ask_price ??
                          '-'
                        }
                      />

                      <StatBox
                        label="Payout"
                        value={
                          proposalData.payout ??
                          '-'
                        }
                        accent="text-emerald-400"
                      />
                    </div>

                    <p className="mt-4 text-[11px] text-slate-500">
                      Proposal only. No contract has been purchased.
                    </p>
                  </div>
                )}
              </div>

              <div className="bg-[#0f1522] border border-slate-800 rounded-2xl p-5">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-xs uppercase font-black">
                      Bot Stream
                    </h3>

                    <p className="text-[10px] mt-1 text-slate-500">
                      {simulationSignal}
                    </p>
                  </div>

                  <button
                    onClick={resetBotStats}
                    className="text-xs text-slate-500"
                  >
                    Reset
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2 mt-4">
                  <StatBox
                    label="Trades"
                    value={simulatedTrades}
                  />

                  <StatBox
                    label="Win Rate"
                    value={`${winRate}%`}
                    accent="text-emerald-400"
                  />

                  <StatBox
                    label="Wins"
                    value={simulatedWins}
                    accent="text-emerald-400"
                  />

                  <StatBox
                    label="Losses"
                    value={simulatedLosses}
                    accent="text-rose-400"
                  />
                </div>

                <div className="mt-4 bg-[#080b11] border border-slate-800 rounded-xl p-3 max-h-[420px] overflow-y-auto space-y-2">
                  {botLogs.length === 0 ? (
                    <p className="text-xs text-slate-600 text-center py-10">
                      Activity will appear here.
                    </p>
                  ) : (
                    botLogs.map((log, index) => (
                      <div
                        key={`${log.time}-${index}`}
                        className="border border-slate-800 rounded-lg p-2 text-xs font-mono"
                      >
                        <span className="text-slate-600">
                          [{log.time}]{' '}
                        </span>

                        <span
                          className={
                            log.type === 'error'
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
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab ===
          'analyzer' && (
          <div className="bg-[#0f1522] border border-slate-800 rounded-2xl p-6">
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
                <span className="px-3 py-1 bg-slate-800 rounded text-xs text-cyan-400 font-black">
                  Even {evenOddRatio.even}%
                </span>

                <span className="px-3 py-1 bg-slate-800 rounded text-xs text-amber-400 font-black">
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
                    className="text-center bg-[#080b11] border border-slate-800 rounded-xl p-3"
                  >
                    <p className="font-black">
                      {digit}
                    </p>

                    <p className="mt-2 text-xs text-cyan-400">
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
                      key={`${digit}-${index}`}
                      className={`h-9 w-9 flex items-center justify-center rounded-xl font-black ${
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

      <style jsx>{`
        .inputStyle {
          width: 100%;
          margin-top: 0.5rem;
          background: #151d2d;
          border: 1px solid #334155;
          padding: 0.75rem;
          border-radius: 0.75rem;
          color: #f8fafc;
        }
      `}</style>
    </main>
  );
}

function Field({ label, children }) {
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
