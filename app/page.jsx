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
  const [isLoading, setIsLoading] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isTradingConnected, setIsTradingConnected] = useState(false);

  const [accountId, setAccountId] = useState('');
  const [balance, setBalance] = useState(null);
  const [currency, setCurrency] = useState('USD');
  const [accountType, setAccountType] = useState('');
  const [authError, setAuthError] = useState('');

  const [activeTab, setActiveTab] = useState('overview');

  const [isMarketConnected, setIsMarketConnected] = useState(false);
  const [symbol, setSymbol] = useState('R_100');
  const [lastTick, setLastTick] = useState(null);
  const [prevTick, setPrevTick] = useState(null);
  const [lastDigit, setLastDigit] = useState(null);
  const [digitHistory, setDigitHistory] = useState([]);
  const [digitStats, setDigitStats] = useState(Array(10).fill(0));
  const [evenOddRatio, setEvenOddRatio] = useState({
    even: 50,
    odd: 50,
  });

  const [strategy, setStrategy] = useState('DIGITDIFF');
  const [stake, setStake] = useState('1.00');
  const [duration, setDuration] = useState('1');
  const [predictionDigit, setPredictionDigit] = useState('0');
  const [takeProfit, setTakeProfit] = useState('10.00');
  const [stopLoss, setStopLoss] = useState('20.00');
  const [martingale, setMartingale] = useState('2.00');
  const [maxConsecutiveLosses, setMaxConsecutiveLosses] =
    useState('3');

  const [isBotRunning, setIsBotRunning] = useState(false);
  const [simulationSignal, setSimulationSignal] =
    useState('Waiting for bot start');

  const [simulatedTrades, setSimulatedTrades] = useState(0);
  const [simulatedWins, setSimulatedWins] = useState(0);
  const [simulatedLosses, setSimulatedLosses] = useState(0);
  const [consecutiveLosses, setConsecutiveLosses] = useState(0);

  const [botLogs, setBotLogs] = useState([]);

  const [proposalLoading, setProposalLoading] = useState(false);
  const [proposalError, setProposalError] = useState('');
  const [proposalData, setProposalData] = useState(null);

  const publicWsRef = useRef(null);
  const tradingWsRef = useRef(null);
  const publicSubscriptionRef = useRef(null);
  const publicPingRef = useRef(null);
  const tradingPingRef = useRef(null);
  const botRunningRef = useRef(false);

  useEffect(() => {
    botRunningRef.current = isBotRunning;
  }, [isBotRunning]);

  const addBotLog = useCallback((message, type = 'info') => {
    const time = new Date().toLocaleTimeString();

    setBotLogs((previous) => [
      {
        time,
        message,
        type,
      },
      ...previous.slice(0, 79),
    ]);
  }, []);

  const connectTradingSocket = useCallback(
    (wsUrl) => {
      if (!wsUrl) {
        setIsTradingConnected(false);
        return;
      }

      if (tradingWsRef.current) {
        try {
          tradingWsRef.current.onclose = null;
          tradingWsRef.current.close();
        } catch {}
      }

      const ws = new WebSocket(wsUrl);
      tradingWsRef.current = ws;

      ws.onopen = () => {
        setIsTradingConnected(true);

        addBotLog(
          'Authenticated Deriv trading socket connected.',
          'system'
        );

        if (tradingPingRef.current) {
          clearInterval(tradingPingRef.current);
        }

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
            setCurrency(data.balance.currency || 'USD');
          }
        } catch (error) {
          console.error(
            'Trading message parse error:',
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
    [addBotLog]
  );

  const loadDerivSession = useCallback(async () => {
    try {
      setIsLoading(true);

      const response = await fetch(
        '/api/auth/deriv/session',
        {
          method: 'GET',
          credentials: 'include',
          cache: 'no-store',
        }
      );

      const data = await response.json();

      if (!response.ok || !data.authenticated) {
        setIsAuthorized(false);
        setIsTradingConnected(false);

        if (response.status !== 401 && data.error) {
          setAuthError(data.error);
        }

        return;
      }

      if (!data.account) {
        setIsAuthorized(true);

        setAuthError(
          'Deriv authorization succeeded, but no Options trading account was found.'
        );

        return;
      }

      setIsAuthorized(true);
      setAccountId(data.account.id || '');
      setBalance(data.account.balance ?? null);
      setCurrency(data.account.currency || 'USD');
      setAccountType(data.account.type || '');
      setAuthError('');

      if (data.wsUrl) {
        connectTradingSocket(data.wsUrl);
      }
    } catch (error) {
      console.error(
        'Session loading error:',
        error
      );

      setIsAuthorized(false);
      setIsTradingConnected(false);

      setAuthError(
        'Unable to load your Deriv account.'
      );
    } finally {
      setIsLoading(false);
    }
  }, [connectTradingSocket]);

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
      if (tradingPingRef.current) {
        clearInterval(tradingPingRef.current);
      }

      if (tradingWsRef.current) {
        tradingWsRef.current.onclose = null;
        tradingWsRef.current.close();
      }
    };
  }, [loadDerivSession]);

  const updateDigitStats = useCallback((digit) => {
    setDigitHistory((previous) => {
      const updated = [
        digit,
        ...previous,
      ].slice(0, 100);

      const counts = Array(10).fill(0);
      let evenCount = 0;

      updated.forEach((item) => {
        counts[item] += 1;

        if (item % 2 === 0) {
          evenCount += 1;
        }
      });

      const total = updated.length || 1;

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
          ((total - evenCount) / total) * 100
        ),
      });

      return updated;
    });
  }, []);

  const evaluateBotTick = useCallback(
    (digit) => {
      if (!botRunningRef.current) {
        return;
      }

      const prediction = Number(
        predictionDigit
      );

      let wouldWin = false;

      if (strategy === 'DIGITDIFF') {
        wouldWin =
          digit !== prediction;
      }

      if (strategy === 'DIGITMATCH') {
        wouldWin =
          digit === prediction;
      }

      if (strategy === 'DIGITEVEN') {
        wouldWin =
          digit % 2 === 0;
      }

      if (strategy === 'DIGITODD') {
        wouldWin =
          digit % 2 !== 0;
      }

      if (strategy === 'DIGITOVER') {
        wouldWin =
          digit > prediction;
      }

      if (strategy === 'DIGITUNDER') {
        wouldWin =
          digit < prediction;
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
      } else {
        setSimulatedLosses(
          (value) => value + 1
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
      }
    },
    [
      strategy,
      predictionDigit,
      maxConsecutiveLosses,
      addBotLog,
    ]
  );

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

    const ws =
      new WebSocket(
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
        clearInterval(publicPingRef.current);
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
        const data =
          JSON.parse(event.data);

        if (data.error) {
          console.error(
            'Public WS error:',
            data.error
          );

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

          const quote =
            Number(
              data.tick.quote
            );

          setLastTick((previous) => {
            setPrevTick(previous);
            return quote;
          });

          const quoteText =
            String(
              data.tick.quote
            );

          const numericOnly =
            quoteText.replace(
              /\D/g,
              ''
            );

          if (numericOnly.length) {
            const digit =
              Number(
                numericOnly[
                  numericOnly.length - 1
                ]
              );

            setLastDigit(digit);

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
          'Tick parsing error:',
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
        clearInterval(publicPingRef.current);
      }

      if (publicWsRef.current) {
        publicWsRef.current.onclose = null;
        publicWsRef.current.close();
      }
    };
  }, [connectMarket]);

  useEffect(() => {
    const ws = publicWsRef.current;

    if (
      !ws ||
      ws.readyState !== WebSocket.OPEN
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
          .replace(/\+/g, '-')
          .replace(/\//g, '_')
          .replace(/=+$/, '');

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
        'Unable to start Deriv OAuth:',
        error
      );

      setIsConnecting(false);

      setAuthError(
        'Unable to open Deriv authorization.'
      );
    }
  };

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

  const requestLiveProposal = () => {
    setProposalError('');
    setProposalData(null);

    if (!isAuthorized) {
      setProposalError(
        'Connect your Deriv account first.'
      );

      return;
    }

    const ws =
      tradingWsRef.current;

    if (
      !ws ||
      ws.readyState !== WebSocket.OPEN
    ) {
      setProposalError(
        'Authenticated trading connection is not ready.'
      );

      addBotLog(
        'Proposal blocked: trading socket is offline.',
        'error'
      );

      return;
    }

    const parsedStake =
      Number(stake);

    const parsedDuration =
      Number(duration);

    const parsedPrediction =
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
        'Duration must be at least 1 tick.'
      );

      return;
    }

    if (
      [
        'DIGITDIFF',
        'DIGITMATCH',
        'DIGITOVER',
        'DIGITUNDER',
      ].includes(strategy) &&
      (
        !Number.isInteger(
          parsedPrediction
        ) ||
        parsedPrediction < 0 ||
        parsedPrediction > 9
      )
    ) {
      setProposalError(
        'Prediction digit must be between 0 and 9.'
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

      // New Deriv Options API field:
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
        String(
          parsedPrediction
        );
    }

    try {
      setProposalLoading(true);

      addBotLog(
        `Requesting live ${strategy} proposal for ${symbol} at ${currency} ${parsedStake.toFixed(
          2
        )}.`,
        'system'
      );

      ws.send(
        JSON.stringify(
          payload
        )
      );
    } catch (error) {
      console.error(
        'Proposal request error:',
        error
      );

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

  return (
    <main className="min-h-screen bg-[#080b11] text-slate-100">
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
              {lastDigit !== null
                ? lastDigit
                : '-'}
            </span>
          </div>
        </div>
      </div>

      <header className="border-b border-slate-800 bg-[#0d121c]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 min-h-16 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-gradient-to-tr from-emerald-500 to-teal-400 rounded-xl flex items-center justify-center font-black text-black text-xl shadow-lg">
              BS
            </div>

            <div>
              <div className="text-lg font-black tracking-tight text-white">
                BINARY
                <span className="text-emerald-400">
                  SPOT
                </span>{' '}
                PRO
              </div>

              <div className="text-[9px] uppercase font-bold tracking-widest text-emerald-500">
                Algorithmic Hub
              </div>
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
              className="px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-400 disabled:opacity-50 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl shadow-lg"
            >
              {isLoading
                ? 'Checking...'
                : isConnecting
                ? 'Opening...'
                : 'Connect Deriv'}
            </button>
          ) : (
            <div className="bg-[#131926] border border-slate-700 px-3 py-2 rounded-xl text-right">
              <p className="text-[9px] uppercase tracking-wider text-slate-500">
                {accountType ||
                  'Options Account'}
              </p>

              <p className="text-[10px] font-mono text-slate-400">
                {accountId}
              </p>

              <p className="text-sm font-black font-mono text-emerald-400">
                {balance !== null
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
                  : 'Connected'}
              </p>
            </div>
          )}
        </div>
      </header>

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
              type="button"
              onClick={() =>
                setActiveTab(
                  tab.id
                )
              }
              className={`px-4 py-2 rounded-xl text-xs font-black whitespace-nowrap ${
                activeTab ===
                tab.id
                  ? 'bg-emerald-500 text-black'
                  : 'bg-slate-900 text-slate-400 border border-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {authError && (
          <div className="mb-6 rounded-xl border border-rose-800 bg-rose-950/40 p-4 text-sm text-rose-300">
            ⚠️ {authError}
          </div>
        )}

        {activeTab ===
          'overview' && (
          <div className="space-y-8">
            <div className="rounded-3xl border border-slate-800 bg-gradient-to-br from-[#121824] via-[#0d121c] to-[#080b11] p-8 md:p-12 shadow-2xl">
              <div className="max-w-2xl space-y-5">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
                  <span className="h-2 w-2 rounded-full bg-emerald-400" />
                  BinarySpot Pro Trading Platform
                </div>

                <h1 className="text-4xl sm:text-5xl font-black text-white tracking-tight leading-tight">
                  Automate Your Edge on Volatility Indices.
                </h1>

                <p className="text-slate-400 text-sm sm:text-base leading-relaxed">
                  OAuth, live tick streaming and authenticated Deriv trading connectivity are active.
                </p>

                <button
                  type="button"
                  onClick={() =>
                    setActiveTab(
                      'bots'
                    )
                  }
                  className="px-6 py-3.5 bg-emerald-500 text-black font-black text-xs uppercase tracking-wider rounded-xl"
                >
                  Open Bot Studio
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab ===
          'bots' && (
          <div className="space-y-6">
            <div className="flex flex-wrap justify-between items-center gap-4">
              <div>
                <h2 className="text-xl font-black text-white">
                  Bot Studio
                </h2>

                <p className="text-xs text-slate-400 mt-1">
                  Live strategy testing and Deriv price proposal validation.
                </p>
              </div>

              <span
                className={`px-3 py-1.5 rounded-full text-xs font-black uppercase ${
                  isBotRunning
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                {isBotRunning
                  ? 'Simulation Active'
                  : 'Standby'}
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-[#0f1522] border border-slate-800 rounded-2xl p-6 space-y-6">
                <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-4">
                  <p className="text-xs font-black uppercase tracking-wider text-cyan-400">
                    Proposal Test Mode
                  </p>

                  <p className="mt-1 text-xs text-slate-400">
                    BinarySpot Pro can request a real Deriv contract quote. No purchase is sent.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-400">
                      Synthetic Asset
                    </label>

                    <select
                      value={symbol}
                      onChange={(event) =>
                        setSymbol(
                          event.target.value
                        )
                      }
                      disabled={isBotRunning}
                      className="w-full mt-2 bg-[#151d2d] border border-slate-700 p-3 rounded-xl text-sm"
                    >
                      <option value="R_100">
                        Volatility 100 Index
                      </option>

                      <option value="R_50">
                        Volatility 50 Index
                      </option>

                      <option value="R_25">
                        Volatility 25 Index
                      </option>

                      <option value="1HZ100V">
                        Volatility 100 (1s)
                      </option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-400">
                      Strategy
                    </label>

                    <select
                      value={strategy}
                      onChange={(event) => {
                        setStrategy(
                          event.target.value
                        );

                        setProposalData(
                          null
                        );

                        setProposalError(
                          ''
                        );
                      }}
                      disabled={isBotRunning}
                      className="w-full mt-2 bg-[#151d2d] border border-slate-700 p-3 rounded-xl text-sm"
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
                    <label className="text-xs font-bold text-slate-400">
                      Stake
                    </label>

                    <input
                      type="number"
                      min="0.35"
                      step="0.01"
                      value={stake}
                      onChange={(event) =>
                        setStake(
                          event.target.value
                        )
                      }
                      disabled={isBotRunning}
                      className="w-full mt-2 bg-[#151d2d] border border-slate-700 p-3 rounded-xl text-sm font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-400">
                      Duration (Ticks)
                    </label>

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
                      disabled={isBotRunning}
                      className="w-full mt-2 bg-[#151d2d] border border-slate-700 p-3 rounded-xl text-sm font-mono"
                    />
                  </div>

                  {needsPredictionDigit && (
                    <div>
                      <label className="text-xs font-bold text-cyan-400">
                        Prediction Digit
                      </label>

                      <input
                        type="number"
                        min="0"
                        max="9"
                        value={predictionDigit}
                        onChange={(event) =>
                          setPredictionDigit(
                            event.target.value
                          )
                        }
                        disabled={isBotRunning}
                        className="w-full mt-2 bg-[#151d2d] border border-cyan-900 p-3 rounded-xl text-sm font-mono text-cyan-300"
                      />
                    </div>
                  )}

                  <div>
                    <label className="text-xs font-bold text-slate-400">
                      Martingale Multiplier
                    </label>

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
                      disabled={isBotRunning}
                      className="w-full mt-2 bg-[#151d2d] border border-slate-700 p-3 rounded-xl text-sm font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-emerald-400">
                      Take Profit
                    </label>

                    <input
                      type="number"
                      value={takeProfit}
                      onChange={(event) =>
                        setTakeProfit(
                          event.target.value
                        )
                      }
                      disabled={isBotRunning}
                      className="w-full mt-2 bg-[#151d2d] border border-emerald-900 p-3 rounded-xl text-sm font-mono text-emerald-300"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-rose-400">
                      Stop Loss
                    </label>

                    <input
                      type="number"
                      value={stopLoss}
                      onChange={(event) =>
                        setStopLoss(
                          event.target.value
                        )
                      }
                      disabled={isBotRunning}
                      className="w-full mt-2 bg-[#151d2d] border border-rose-900 p-3 rounded-xl text-sm font-mono text-rose-300"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-rose-400">
                      Max Consecutive Losses
                    </label>

                    <input
                      type="number"
                      min="1"
                      max="20"
                      value={maxConsecutiveLosses}
                      onChange={(event) =>
                        setMaxConsecutiveLosses(
                          event.target.value
                        )
                      }
                      disabled={isBotRunning}
                      className="w-full mt-2 bg-[#151d2d] border border-rose-900 p-3 rounded-xl text-sm font-mono text-rose-300"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {!isBotRunning ? (
                    <button
                      type="button"
                      onClick={startBot}
                      className="py-4 bg-gradient-to-r from-emerald-500 to-teal-400 text-black font-black text-sm uppercase tracking-wider rounded-xl"
                    >
                      ▶ Start Simulation
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={stopBot}
                      className="py-4 bg-rose-600 text-white font-black text-sm uppercase tracking-wider rounded-xl"
                    >
                      ⏹ Stop Simulation
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={requestLiveProposal}
                    disabled={
                      proposalLoading ||
                      !isTradingConnected
                    }
                    className="py-4 bg-cyan-500 disabled:opacity-40 text-black font-black text-sm uppercase tracking-wider rounded-xl"
                  >
                    {proposalLoading
                      ? 'Requesting Quote...'
                      : 'Get Live Proposal'}
                  </button>
                </div>

                {proposalError && (
                  <div className="rounded-xl border border-rose-800 bg-rose-950/30 p-4 text-xs text-rose-300">
                    ⚠️ {proposalError}
                  </div>
                )}

                {proposalData && (
                  <div className="rounded-2xl border border-cyan-500/30 bg-cyan-950/10 p-5">
                    <div className="flex flex-wrap justify-between gap-4">
                      <div>
                        <p className="text-[10px] uppercase tracking-wider font-black text-cyan-400">
                          Deriv Live Proposal
                        </p>

                        <p className="mt-1 text-xs font-mono text-slate-400 break-all">
                          ID: {proposalData.id}
                        </p>
                      </div>

                      <span className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs font-black text-emerald-400">
                        Quote Received
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
                      <div className="bg-[#080b11] border border-slate-800 rounded-xl p-3">
                        <p className="text-[9px] uppercase text-slate-500">
                          Ask Price
                        </p>

                        <p className="mt-1 font-mono font-black text-white">
                          {proposalData.ask_price ??
                            '-'}
                        </p>
                      </div>

                      <div className="bg-[#080b11] border border-slate-800 rounded-xl p-3">
                        <p className="text-[9px] uppercase text-slate-500">
                          Payout
                        </p>

                        <p className="mt-1 font-mono font-black text-emerald-400">
                          {proposalData.payout ??
                            '-'}
                        </p>
                      </div>

                      <div className="bg-[#080b11] border border-slate-800 rounded-xl p-3">
                        <p className="text-[9px] uppercase text-slate-500">
                          Spot
                        </p>

                        <p className="mt-1 font-mono font-black text-amber-400">
                          {proposalData.spot ??
                            '-'}
                        </p>
                      </div>

                      <div className="bg-[#080b11] border border-slate-800 rounded-xl p-3">
                        <p className="text-[9px] uppercase text-slate-500">
                          Contract
                        </p>

                        <p className="mt-1 text-xs font-black text-cyan-400">
                          {strategy}
                        </p>
                      </div>
                    </div>

                    <p className="mt-4 text-[11px] text-slate-500">
                      This quote has not been purchased.
                    </p>
                  </div>
                )}
              </div>

              <div className="bg-[#0f1522] border border-slate-800 rounded-2xl p-5 flex flex-col min-h-[600px]">
                <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                  <div>
                    <h3 className="text-xs uppercase font-black tracking-wider text-slate-300">
                      Bot Stream
                    </h3>

                    <p className="text-[10px] text-slate-500 mt-1">
                      {simulationSignal}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={resetBotStats}
                    className="text-[10px] text-slate-500"
                  >
                    Reset
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2 mt-4">
                  <div className="bg-[#080b11] border border-slate-800 p-3 rounded-xl">
                    <div className="text-[10px] uppercase text-slate-500">
                      Trades
                    </div>

                    <div className="text-lg font-black font-mono">
                      {simulatedTrades}
                    </div>
                  </div>

                  <div className="bg-[#080b11] border border-slate-800 p-3 rounded-xl">
                    <div className="text-[10px] uppercase text-slate-500">
                      Win Rate
                    </div>

                    <div className="text-lg font-black font-mono text-emerald-400">
                      {winRate}%
                    </div>
                  </div>

                  <div className="bg-[#080b11] border border-slate-800 p-3 rounded-xl">
                    <div className="text-[10px] uppercase text-slate-500">
                      Wins
                    </div>

                    <div className="text-lg font-black font-mono text-emerald-400">
                      {simulatedWins}
                    </div>
                  </div>

                  <div className="bg-[#080b11] border border-slate-800 p-3 rounded-xl">
                    <div className="text-[10px] uppercase text-slate-500">
                      Losses
                    </div>

                    <div className="text-lg font-black font-mono text-rose-400">
                      {simulatedLosses}
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex-1 bg-[#080b11] border border-slate-800 rounded-xl p-3 overflow-y-auto space-y-2">
                  {botLogs.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-center text-xs text-slate-600">
                      Strategy and proposal activity will appear here.
                    </div>
                  ) : (
                    botLogs.map(
                      (
                        log,
                        index
                      ) => (
                        <div
                          key={index}
                          className={`p-2 rounded-lg border text-xs font-mono ${
                            log.type ===
                            'success'
                              ? 'bg-emerald-950/30 border-emerald-900 text-emerald-300'
                              : log.type ===
                                'error'
                              ? 'bg-rose-950/30 border-rose-900 text-rose-300'
                              : 'bg-slate-900 border-slate-800 text-slate-400'
                          }`}
                        >
                          <span className="opacity-50 mr-2">
                            [{log.time}]
                          </span>

                          {log.message}
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
          <div className="space-y-6">
            <div className="bg-[#0f1522] border border-slate-800 rounded-2xl p-5">
              <label className="text-xs uppercase font-black tracking-wider text-slate-500">
                Synthetic Asset
              </label>

              <select
                value={symbol}
                onChange={(event) =>
                  setSymbol(
                    event.target.value
                  )
                }
                className="w-full mt-2 bg-[#151d2d] border border-slate-700 p-3 rounded-xl text-sm"
              >
                <option value="R_100">
                  Volatility 100 Index
                </option>

                <option value="R_50">
                  Volatility 50 Index
                </option>

                <option value="R_25">
                  Volatility 25 Index
                </option>

                <option value="1HZ100V">
                  Volatility 100 (1s)
                </option>
              </select>
            </div>

            <div className="bg-[#0f1522] border border-slate-800 rounded-2xl p-6">
              <div className="flex flex-wrap justify-between items-center gap-4">
                <div>
                  <h2 className="text-lg font-black">
                    Last 100 Ticks
                  </h2>

                  <p className="text-xs text-slate-400 mt-1">
                    Digit distribution for {symbol}
                  </p>
                </div>

                <div className="flex gap-2">
                  <span className="bg-slate-800 px-3 py-1.5 rounded-lg text-xs font-mono font-black text-cyan-400">
                    Even {evenOddRatio.even}%
                  </span>

                  <span className="bg-slate-800 px-3 py-1.5 rounded-lg text-xs font-mono font-black text-amber-400">
                    Odd {evenOddRatio.odd}%
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-5 sm:grid-cols-10 gap-3 mt-6">
                {digitStats.map(
                  (
                    percentage,
                    digit
                  ) => (
                    <div
                      key={digit}
                      className="bg-[#080b11] border border-slate-800 rounded-xl p-3 text-center"
                    >
                      <div className="font-black text-white">
                        {digit}
                      </div>

                      <div className="h-24 mt-2 bg-slate-900 rounded-lg flex items-end overflow-hidden">
                        <div
                          className={`w-full ${
                            percentage >= 15
                              ? 'bg-emerald-400'
                              : percentage <= 6
                              ? 'bg-rose-500'
                              : 'bg-cyan-500'
                          }`}
                          style={{
                            height: `${Math.min(
                              percentage * 4,
                              100
                            )}%`,
                          }}
                        />
                      </div>

                      <div className="mt-2 text-xs font-mono font-black text-slate-300">
                        {percentage}%
                      </div>
                    </div>
                  )
                )}
              </div>

              <div className="mt-7 pt-5 border-t border-slate-800">
                <div className="text-xs uppercase font-black tracking-wider text-slate-500 mb-3">
                  Latest 25 Digits
                </div>

                <div className="flex flex-wrap gap-2">
                  {digitHistory
                    .slice(0, 25)
                    .map(
                      (
                        digit,
                        index
                      ) => (
                        <span
                          key={index}
                          className={`h-9 w-9 rounded-xl flex items-center justify-center font-mono font-black ${
                            index === 0
                              ? 'bg-emerald-500 text-black'
                              : digit % 2 === 0
                              ? 'bg-slate-800 text-cyan-400 border border-slate-700'
                              : 'bg-slate-800 text-amber-400 border border-slate-700'
                          }`}
                        >
                          {digit}
                        </span>
                      )
                    )}
                </div>
              </div>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
