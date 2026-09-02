'use client';

import React from 'react';

export default function BinarySpotPro() {
  return (
    <main className="min-h-screen bg-[#080b11] text-slate-100">

      {/* Status Bar */}
      <div className="border-b border-slate-800 bg-[#0e131d] px-4 py-2.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
            <span className="font-semibold text-slate-300">
              BinarySpot Pro
            </span>
          </div>

          <span className="text-slate-500">
            Trading Gateway Offline
          </span>
        </div>
      </div>

      {/* Header */}
      <header className="border-b border-slate-800 bg-[#0d121c]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">

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

          <button
            type="button"
            className="px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl shadow-lg"
          >
            Connect Deriv
          </button>

        </div>
      </header>

      {/* Main Content */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">

        <div className="relative overflow-hidden rounded-3xl border border-slate-800 bg-gradient-to-br from-[#121824] via-[#0d121c] to-[#080b11] p-8 md:p-12 shadow-2xl">

          <div className="max-w-2xl space-y-5">

            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              BinarySpot Pro Trading Platform
            </div>

            <h1 className="text-4xl sm:text-5xl font-black text-white tracking-tight leading-tight">
              Automate Your Edge on Volatility Indices.
            </h1>

            <p className="text-slate-400 text-sm sm:text-base leading-relaxed">
              A professional trading interface built for Deriv
              volatility indices, digit analysis, automated
              strategies and risk management.
            </p>

            <div className="pt-2 flex flex-wrap gap-3">

              <button
                type="button"
                className="px-6 py-3.5 bg-emerald-500 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl shadow-xl"
              >
                Bot Studio
              </button>

              <button
                type="button"
                className="px-6 py-3.5 bg-slate-800 text-white font-bold text-xs uppercase tracking-wider rounded-xl border border-slate-700"
              >
                Digit Analyzer
              </button>

            </div>
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
              Configure automated trading strategies with
              stake management and risk controls.
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

        {/* Build Status */}
        <div className="mt-8 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-emerald-400">
            BinarySpot Pro V2
          </p>

          <p className="text-sm text-slate-400 mt-1">
            Base application installed successfully. Deriv
            authentication will be connected next.
          </p>
        </div>

      </section>

    </main>
  );
}
