'use client';

import React, {
  Component,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import createDerivSmartChartsAdapter from '../../lib/derivSmartChartsAdapter';

const DEFAULT_SYMBOL = 'R_100';
const DEFAULT_GRANULARITY = 60;

function getDisplayName(activeSymbols, symbol) {
  const item = (activeSymbols || []).find((entry) => {
    const entrySymbol =
      entry?.underlying_symbol ||
      entry?.symbol;

    return entrySymbol === symbol;
  });

  return (
    item?.underlying_symbol_name ||
    item?.display_name ||
    symbol
  );
}

function mapActiveSymbols(activeSymbols) {
  return (activeSymbols || [])
    .map((item) => {
      const symbol =
        item?.underlying_symbol ||
        item?.symbol;

      if (!symbol) {
        return null;
      }

      const displayName =
        item?.underlying_symbol_name ||
        item?.display_name ||
        symbol;

      const market =
        item?.market ||
        item?.underlying_symbol_type ||
        'synthetic_index';

      return {
        symbol,
        display_name: displayName,
        market,
        market_display_name:
          item?.market_display_name ||
          'Synthetic Indices',
        submarket:
          item?.submarket ||
          item?.subgroup ||
          market,
        submarket_display_name:
          item?.submarket_display_name ||
          item?.subgroup_display_name ||
          'Synthetic Indices',
        symbol_type:
          item?.symbol_type ||
          item?.underlying_symbol_type ||
          market,
        exchange_is_open: 1,
        is_trading_suspended: 0,
        allow_forward_starting: 0,
      };
    })
    .filter(Boolean);
}

class ChartErrorBoundary extends Component {
  constructor(props) {
    super(props);

    this.state = {
      hasError: false,
      message: '',
    };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      message:
        error?.message ||
        'The Deriv chart encountered an error.',
    };
  }

  componentDidCatch(error, info) {
    console.error(
      '[BinarySpot DerivChart] Render error:',
      error,
      info
    );
  }

  componentDidUpdate(previousProps) {
    if (
      previousProps.resetKey !==
        this.props.resetKey &&
      this.state.hasError
    ) {
      this.setState({
        hasError: false,
        message: '',
      });
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-full min-h-[330px] items-center justify-center bg-[#080d14] px-6">
          <div className="max-w-md text-center">
            <div className="mx-auto mb-4 grid h-11 w-11 place-items-center rounded-full border border-red-500/30 bg-red-500/10 font-black text-red-400">
              !
            </div>

            <div className="text-base font-black text-slate-100">
              Chart unavailable
            </div>

            <div className="mt-2 break-words text-xs leading-6 text-slate-500">
              {this.state.message}
            </div>

            <div className="mt-3 text-xs leading-5 text-slate-600">
              The rest of BinarySpot remains available.
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default function DerivChart({
  symbol = DEFAULT_SYMBOL,
  activeSymbols = [],
  quote = null,
  pipSize = null,
  height = 430,
  className = '',
}) {
  const mountedRef = useRef(false);
  const adapterRef = useRef(null);
  const loadTimerRef = useRef(null);

  const [SmartChart, setSmartChart] =
    useState(null);

  const [status, setStatus] =
    useState('idle');

  const [error, setError] =
    useState('');

  const [retryKey, setRetryKey] =
    useState(0);

  const normalizedSymbols = useMemo(
    () => mapActiveSymbols(activeSymbols),
    [activeSymbols]
  );

  const displayName = useMemo(
    () =>
      getDisplayName(
        activeSymbols,
        symbol
      ),
    [activeSymbols, symbol]
  );

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;

      if (loadTimerRef.current) {
        window.clearTimeout(
          loadTimerRef.current
        );
      }
    };
  }, []);

  useEffect(() => {
    adapterRef.current =
      createDerivSmartChartsAdapter();

    return () => {
      adapterRef.current?.destroy?.();
      adapterRef.current = null;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    setSmartChart(null);
    setError('');
    setStatus('waiting');

    loadTimerRef.current =
      window.setTimeout(
        async () => {
          if (
            cancelled ||
            !mountedRef.current
          ) {
            return;
          }

          setStatus('loading');

          try {
            const module =
              await import(
                '@deriv-com/smartcharts-champion'
              );

            if (
              cancelled ||
              !mountedRef.current
            ) {
              return;
            }

            if (
              typeof module.setSmartChartsPublicPath ===
              'function'
            ) {
              module.setSmartChartsPublicPath(
                '/smartcharts/'
              );
            }

            if (
              typeof module.SmartChart !==
              'function'
            ) {
              throw new Error(
                'SmartChart export was not found.'
              );
            }

            setSmartChart(
              () => module.SmartChart
            );

            setStatus('ready');
          } catch (loadError) {
            console.error(
              '[BinarySpot DerivChart] SmartCharts loading failed:',
              loadError
            );

            if (
              !cancelled &&
              mountedRef.current
            ) {
              setStatus('error');

              setError(
                loadError?.message ||
                  'Unable to load Deriv SmartCharts.'
              );
            }
          }
        },
        350
      );

    return () => {
      cancelled = true;

      if (loadTimerRef.current) {
        window.clearTimeout(
          loadTimerRef.current
        );

        loadTimerRef.current = null;
      }
    };
  }, [retryKey]);

  const getQuotes = useCallback(
    async (request) => {
      const adapter =
        adapterRef.current;

      if (!adapter) {
        return {
          quotes: [],
          meta: {
            symbol:
              request?.symbol ||
              symbol,
            granularity:
              request?.granularity ??
              DEFAULT_GRANULARITY,
          },
        };
      }

      try {
        return await adapter.getQuotes(
          request
        );
      } catch (requestError) {
        console.error(
          '[BinarySpot DerivChart] getQuotes failed:',
          requestError
        );

        return {
          quotes: [],
          meta: {
            symbol:
              request?.symbol ||
              symbol,
            granularity:
              request?.granularity ??
              DEFAULT_GRANULARITY,
          },
        };
      }
    },
    [symbol]
  );

  const subscribeQuotes =
    useCallback(
      (request, callback) => {
        const adapter =
          adapterRef.current;

        if (!adapter) {
          return () => {};
        }

        try {
          return adapter.subscribeQuotes(
            request,
            callback
          );
        } catch (subscriptionError) {
          console.error(
            '[BinarySpot DerivChart] subscribeQuotes failed:',
            subscriptionError
          );

          return () => {};
        }
      },
      []
    );

  const unsubscribeQuotes =
    useCallback(
      (request) => {
        try {
          adapterRef.current
            ?.unsubscribeQuotes?.(
              request
            );
        } catch (unsubscribeError) {
          console.error(
            '[BinarySpot DerivChart] unsubscribeQuotes failed:',
            unsubscribeError
          );
        }
      },
      []
    );

  const numericQuote =
    Number(quote);

  const decimals =
    Number.isFinite(
      Number(pipSize)
    )
      ? Number(pipSize)
      : 2;

  const formattedQuote =
    Number.isFinite(
      numericQuote
    )
      ? numericQuote.toFixed(
          decimals
        )
      : '—';

  const chartHeight = Math.max(
    Number(height) || 430,
    330
  );

  const retry = () => {
    setError('');
    setStatus('idle');
    setSmartChart(null);

    setRetryKey(
      (value) => value + 1
    );
  };

  return (
    <>
      <link
        rel="stylesheet"
        href="/smartcharts/smartcharts.css"
      />

      <section
        className={className}
        style={{
          width: '100%',
          overflow: 'hidden',
          borderRadius: 18,
          border:
            '1px solid #1d2a3d',
          background:
            '#080d14',
        }}
      >
        <div
          style={{
            minHeight: 64,
            padding:
              '12px 14px',
            display: 'flex',
            alignItems:
              'center',
            justifyContent:
              'space-between',
            gap: 12,
            flexWrap:
              'wrap',
            background:
              '#0c131f',
            borderBottom:
              '1px solid #172235',
          }}
        >
          <div
            style={{
              minWidth: 0,
              display: 'flex',
              alignItems:
                'center',
              gap: 11,
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                flex: '0 0 auto',
                display: 'grid',
                placeItems:
                  'center',
                borderRadius:
                  10,
                background:
                  '#111d2d',
                border:
                  '1px solid #24334a',
                color:
                  '#ff4758',
                fontWeight:
                  900,
              }}
            >
              ∿
            </div>

            <div
              style={{
                minWidth: 0,
              }}
            >
              <div
                style={{
                  overflow:
                    'hidden',
                  textOverflow:
                    'ellipsis',
                  whiteSpace:
                    'nowrap',
                  color:
                    '#f8fafc',
                  fontSize: 14,
                  fontWeight:
                    900,
                }}
              >
                {displayName}
              </div>

              <div
                style={{
                  marginTop: 3,
                  display: 'flex',
                  alignItems:
                    'center',
                  gap: 7,
                  color:
                    '#718096',
                  fontSize: 11,
                  fontWeight:
                    700,
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius:
                      '50%',
                    background:
                      '#22d3a5',
                  }}
                />

                LIVE

                <span>•</span>

                {symbol}
              </div>
            </div>
          </div>

          <div
            style={{
              padding:
                '7px 11px',
              borderRadius:
                9,
              border:
                '1px solid #1e2b3f',
              background:
                '#070c13',
              color:
                '#e8edf5',
              fontSize: 13,
              fontWeight:
                900,
              fontVariantNumeric:
                'tabular-nums',
            }}
          >
            {formattedQuote}
          </div>
        </div>

        <div
          style={{
            position:
              'relative',
            width: '100%',
            height:
              chartHeight,
            minHeight: 330,
            background:
              '#080d14',
          }}
        >
          {status !==
            'ready' &&
            status !==
              'error' && (
              <div
                style={{
                  position:
                    'absolute',
                  inset: 0,
                  zIndex: 5,
                  display:
                    'grid',
                  placeItems:
                    'center',
                  background:
                    '#080d14',
                }}
              >
                <div
                  style={{
                    textAlign:
                      'center',
                  }}
                >
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      margin:
                        '0 auto 12px',
                      borderRadius:
                        '50%',
                      border:
                        '3px solid #243248',
                      borderTopColor:
                        '#ff4758',
                      animation:
                        'binaryspot-chart-spin 0.8s linear infinite',
                    }}
                  />

                  <div
                    style={{
                      color:
                        '#9aa8bb',
                      fontSize: 13,
                      fontWeight:
                        800,
                    }}
                  >
                    Preparing Deriv
                    chart…
                  </div>
                </div>
              </div>
            )}

          {status ===
            'error' && (
              <div
                style={{
                  position:
                    'absolute',
                  inset: 0,
                  zIndex: 6,
                  display:
                    'grid',
                  placeItems:
                    'center',
                  padding: 22,
                  background:
                    '#080d14',
                }}
              >
                <div
                  style={{
                    maxWidth:
                      430,
                    textAlign:
                      'center',
                  }}
                >
                  <div
                    style={{
                      color:
                        '#f8fafc',
                      fontSize: 16,
                      fontWeight:
                        900,
                    }}
                  >
                    Deriv chart
                    couldn't load
                  </div>

                  <div
                    style={{
                      marginTop: 8,
                      color:
                        '#7f8da3',
                      fontSize: 12,
                      lineHeight:
                        1.6,
                    }}
                  >
                    {error}
                  </div>

                  <button
                    type="button"
                    onClick={retry}
                    style={{
                      marginTop:
                        16,
                      minHeight:
                        38,
                      padding:
                        '0 16px',
                      border: 0,
                      borderRadius:
                        9,
                      background:
                        '#ff4758',
                      color:
                        '#fff',
                      fontWeight:
                        900,
                    }}
                  >
                    Retry chart
                  </button>
                </div>
              </div>
            )}

          {status ===
            'ready' &&
            SmartChart && (
              <ChartErrorBoundary
                resetKey={`${symbol}-${retryKey}`}
              >
                <SmartChart
                  id="binaryspot-main-chart"
                  symbol={symbol}
                  granularity={
                    DEFAULT_GRANULARITY
                  }
                  chartType="candle"
                  getQuotes={
                    getQuotes
                  }
                  subscribeQuotes={
                    subscribeQuotes
                  }
                  unsubscribeQuotes={
                    unsubscribeQuotes
                  }
                  chartData={{
                    activeSymbols:
                      normalizedSymbols,
                  }}
                  feedCall={{
                    activeSymbols:
                      false,
                    tradingTimes:
                      false,
                  }}
                  shouldFetchTradingTimes={
                    false
                  }
                  isAnimationEnabled={
                    false
                  }
                  enabledNavigationWidget={
                    false
                  }
                  isLive
                />
              </ChartErrorBoundary>
            )}
        </div>

        <div
          style={{
            minHeight: 36,
            padding:
              '7px 13px',
            display: 'flex',
            alignItems:
              'center',
            justifyContent:
              'space-between',
            gap: 10,
            borderTop:
              '1px solid #172235',
            background:
              '#0a111b',
            color:
              '#64748b',
            fontSize: 10,
            fontWeight:
              800,
          }}
        >
          <span>
            DERIV MARKET DATA
          </span>

          <span>
            1 MIN • CANDLES
          </span>
        </div>

        <style jsx>{`
          @keyframes binaryspot-chart-spin {
            from {
              transform: rotate(0deg);
            }

            to {
              transform: rotate(360deg);
            }
          }

          @media (max-width: 640px) {
            section {
              border-radius: 14px !important;
            }
          }
        `}</style>
      </section>
    </>
  );
}
