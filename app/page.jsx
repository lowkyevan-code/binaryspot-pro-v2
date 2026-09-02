'use client';

import React, {
  useCallback,
  useEffect,
  useState,
} from 'react';

const CLIENT_ID = '34hh45FQkPfMgbgj20uoR';

const REDIRECT_URI =
  'https://binaryspot-pro-v2.vercel.app/auth/deriv/callback';

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

  return (
    <main className="min-h-screen bg-[#080b11] text-slate-100">

      {/* Status Bar */}
      <div className="border-b border-slate-800 bg-[#0e131d] px-4 py-2.5">

        <div className="max-w-7xl mx-auto flex items-center justify-between text-xs">

          <div className="flex items-center gap-2">

            <span
              className={`h-2.5 w-2.5 rounded-full ${
                isAuthorized
                  ? 'bg-emerald-400'
                  : isLoading ||
                    isConnecting
                  ? 'bg-amber-400'
                  : 'bg-rose-500'
              }`}
            />

            <span className="font-semibold text-slate-300">
              BinarySpot Pro
            </span>

          </div>

          <span
            className={
              isAuthorized
                ? 'text-emerald-400'
                : 'text-slate-500'
            }
          >
            {isLoading
              ? 'Checking Deriv Session...'
              : isConnecting
              ? 'Opening Deriv...'
              : isAuthorized
              ? 'Deriv Account Connected'
              : 'Trading Gateway Offline'}
          </span>

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

      {/* Main */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">

        {authError && (
          <div className="mb-6 rounded-xl border border-rose-800 bg-rose-950/40 p-4 text-sm text-rose-300">
            ⚠️ {authError}
          </div>
        )}

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
              A professional trading interface built for Deriv
              volatility indices, digit analysis, automated
              strategies and risk management.
            </p>

            {!isAuthorized &&
              !isLoading && (
                <button
                  type="button"
                  onClick={
                    connectDeriv
                  }
                  disabled={
                    isConnecting
                  }
                  className="px-6 py-3.5 bg-emerald-500 disabled:opacity-50 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl shadow-xl"
                >
                  {isConnecting
                    ? 'Opening Deriv...'
                    : 'Connect Deriv Account'}
                </button>
              )}

            {isAuthorized && (
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">

                <p className="text-sm font-bold text-emerald-400">
                  ✓ Deriv authorization successful
                </p>

                <p className="mt-1 text-xs text-slate-400">
                  Your BinarySpot Pro session is connected to
                  your Deriv Options account.
                </p>

              </div>
            )}

          </div>

        </div>

        {/* Features */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-8">

          <div className="p-6 rounded-2xl bg-[#0f1522] border border-slate-800">

            <div className="text-2xl mb-4">
              🤖
            </div>

            <h2 className="font-bold text-white">
              Algorithmic Bot Studio
            </h2>

            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              Configure automated trading strategies with stake
              management and risk controls.
            </p>

          </div>

          <div className="p-6 rounded-2xl bg-[#0f1522] border border-slate-800">

            <div className="text-2xl mb-4">
              📊
            </div>

            <h2 className="font-bold text-white">
              Digit Analyzer
            </h2>

            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              Analyze live tick distributions and digit
              statistics from supported Deriv markets.
            </p>

          </div>

          <div className="p-6 rounded-2xl bg-[#0f1522] border border-slate-800">

            <div className="text-2xl mb-4">
              ⚡
            </div>

            <h2 className="font-bold text-white">
              Trading Terminal
            </h2>

            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              A streamlined interface for executing and
              monitoring supported contracts.
            </p>

          </div>

        </div>

        <div className="mt-8 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5">

          <p className="text-xs font-bold uppercase tracking-wider text-emerald-400">
            OAuth Integration
          </p>

          <p className="text-sm text-slate-400 mt-1">
            {isAuthorized
              ? 'OAuth authentication is active.'
              : 'Press Connect Deriv to securely authorize your account.'}
          </p>

        </div>

      </section>

    </main>
  );
}
