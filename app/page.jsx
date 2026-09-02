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
  const [isLoading, setIsLoading] =
    useState(true);

  const [
    isConnecting,
    setIsConnecting,
  ] = useState(false);

  const [
    isAuthorized,
    setIsAuthorized,
  ] = useState(false);

  const [
    isMarketConnected,
    setIsMarketConnected,
  ] = useState(false);

  const [accountId, setAccountId] =
    useState('');

  const [balance, setBalance] =
    useState(null);

  const [currency, setCurrency] =
    useState('USD');

  const [
    accountType,
    setAccountType,
  ] = useState('');

  const [authError, setAuthError] =
    useState('');

  const [activeTab, setActiveTab] =
    useState('overview');

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

  const wsRef = useRef(null);

  const subscriptionRef =
    useRef(null);

  const pingRef = useRef(null);

  const loadDerivSession =
    useCallback(async () => {
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

        const data =
          await response.json();

        if (
          !response.ok ||
          !data.authenticated
        ) {
          setIsAuthorized(false);

          if (
            response.status !== 401 &&
            data.error
          ) {
            setAuthError(
              data.error
            );
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

        setAccountId(
          data.account.id || ''
        );

        setBalance(
          data.account.balance ??
            null
        );

        setCurrency(
          data.account.currency ||
            'USD'
        );

        setAccountType(
          data.account.type || ''
        );

        setAuthError('');
      } catch (error) {
        console.error(
          'Session loading error:',
          error
        );

        setIsAuthorized(false);

        setAuthError(
          'Unable to load your Deriv account.'
        );
      } finally {
        setIsLoading(false);
      }
    }, []);

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
  }, [loadDerivSession]);

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

  const connectMarket =
    useCallback(() => {
      if (
        wsRef.current &&
        (
          wsRef.current
            .readyState ===
            WebSocket.OPEN ||
          wsRef.current
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

      wsRef.current = ws;

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

        if (pingRef.current) {
          clearInterval(
            pingRef.current
          );
        }

        pingRef.current =
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
              console.error(
                'Deriv market error:',
                data.error
              );

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
                subscriptionRef.current =
                  data
                    .subscription
                    .id;
              }

              const quote =
                Number(
                  data.tick
                    .quote
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
                  data.tick
                    .quote
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
                      numericOnly
                        .length -
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
          } catch (error) {
            console.error(
              'Tick parsing error:',
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
        pingRef.current
      ) {
        clearInterval(
          pingRef.current
        );
      }

      if (
        wsRef.current
      ) {
        wsRef.current.onclose =
          null;

        wsRef.current.close();
      }
    };
  }, [connectMarket]);

  useEffect(() => {
    const ws =
      wsRef.current;

    if (
      !ws ||
      ws.readyState !==
        WebSocket.OPEN
    ) {
      return;
    }

    if (
      subscriptionRef.current
    ) {
      ws.send(
        JSON.stringify({
          forget:
            subscriptionRef.current,
        })
      );

      subscriptionRef.current =
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

    ws.send(
      JSON.stringify({
        ticks: symbol,
        subscribe: 1,
      })
    );
  }, [symbol]);

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
          'Unable to start Deriv OAuth:',
          error
        );

        setIsConnecting(false);

        setAuthError(
          'Unable to open Deriv authorization.'
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

  return (
    <main className="min-h-screen bg-[#080b11] text-slate-100">

      {/* Live Market Bar */}
      <div className="border-b border-slate-800 bg-[#0e131d] px-4 py-2.5">

        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3 text-xs">

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
                ? 'Deriv Market Feed Active'
                : 'Market Feed Offline'}
            </span>

          </div>

          <div className="flex items-center gap-4 font-mono">

            <span className="text-slate-500">
              {symbol}
            </span>

            <span
              className={`font-black ${
                lastTick !== null &&
                prevTick !== null &&
                lastTick >=
                  prevTick
                  ? 'text-emerald-400'
                  : 'text-rose-400'
              }`}
            >
              {formattedQuote}
            </span>

            <span className="bg-slate-800 border border-slate-700 px-2 py-1 rounded text-cyan-400 font-black">
              {lastDigit !==
              null
                ? lastDigit
                : '-'}
            </span>

          </div>

        </div>

      </div>

      {/* Header */}
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
              onClick={
                connectDeriv
              }
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
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      }
                    )}`
                  : 'Connected'}
              </p>

            </div>
          )}

        </div>

      </header>

      {/* Navigation */}
      <div className="border-b border-slate-800 bg-[#0b1019]">

        <div className="max-w-7xl mx-auto px-4 py-2 flex gap-2 overflow-x-auto">

          {[
            {
              id: 'overview',
              label: '🏠 Overview',
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

      {/* Main */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {authError && (
          <div className="mb-6 rounded-xl border border-rose-800 bg-rose-950/40 p-4 text-sm text-rose-300">
            ⚠️ {authError}
          </div>
        )}

        {activeTab ===
          'overview' && (
          <div className="space-y-8">

            <div className="relative overflow-hidden rounded-3xl border border-slate-800 bg-gradient-to-br from-[#121824] via-[#0d121c] to-[#080b11] p-8 md:p-12 shadow-2xl">

              <div className="max-w-2xl space-y-5">

                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">

                  <span className="h-2 w-2 rounded-full bg-emerald-400" />

                  {isAuthorized
                    ? 'Deriv Account Authorized'
                    : 'BinarySpot Pro Trading Platform'}

                </div>

                <h1 className="text-4xl sm:text-5xl font-black text-white tracking-tight leading-tight">
                  Automate Your Edge on Volatility Indices.
                </h1>

                <p className="text-slate-400 text-sm sm:text-base leading-relaxed">
                  Live Deriv market data is now feeding BinarySpot Pro in real time.
                </p>

                {!isAuthorized &&
                  !isLoading && (
                    <button
                      type="button"
                      onClick={
                        connectDeriv
                      }
                      className="px-6 py-3.5 bg-emerald-500 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl"
                    >
                      Connect Deriv Account
                    </button>
                  )}

                {isAuthorized && (
                  <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">

                    <p className="text-sm font-bold text-emerald-400">
                      ✓ Deriv authorization successful
                    </p>

                    <p className="mt-1 text-xs text-slate-400">
                      OAuth and account access are active.
                    </p>

                  </div>
                )}

              </div>

            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">

              <div className="p-6 rounded-2xl bg-[#0f1522] border border-slate-800">

                <div className="text-xs uppercase font-black text-slate-500">
                  Live Asset
                </div>

                <div className="mt-2 text-xl font-mono font-black text-amber-400">
                  {symbol}
                </div>

              </div>

              <div className="p-6 rounded-2xl bg-[#0f1522] border border-slate-800">

                <div className="text-xs uppercase font-black text-slate-500">
                  Live Quote
                </div>

                <div className="mt-2 text-xl font-mono font-black text-white">
                  {formattedQuote}
                </div>

              </div>

              <div className="p-6 rounded-2xl bg-[#0f1522] border border-slate-800">

                <div className="text-xs uppercase font-black text-slate-500">
                  Last Digit
                </div>

                <div className="mt-2 text-xl font-mono font-black text-cyan-400">
                  {lastDigit !==
                  null
                    ? lastDigit
                    : '-'}
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
                    event.target
                      .value
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
                  Volatility 100 (1s) Index
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
                    Digit frequency distribution for {symbol}
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
                  (percentage, digit) => (
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
                            percentage >=
                            15
                              ? 'bg-emerald-400'
                              : percentage <=
                                6
                              ? 'bg-rose-500'
                              : 'bg-cyan-500'
                          }`}
                          style={{
                            height: `${Math.min(
                              percentage *
                                4,
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
                          key={
                            index
                          }
                          className={`h-9 w-9 rounded-xl flex items-center justify-center font-mono font-black ${
                            index ===
                            0
                              ? 'bg-emerald-500 text-black'
                              : digit %
                                  2 ===
                                0
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
