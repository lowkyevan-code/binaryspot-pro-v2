'use client';

import React, {
  Component,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import createDerivSmartChartsAdapter from '../../lib/derivSmartChartsAdapter';

const DEFAULT_SYMBOL = 'R_100';

const DEFAULT_GRANULARITY = 60;

const GRANULARITIES = [
  {
    value: 0,
    label: 'Ticks',
  },
  {
    value: 60,
    label: '1m',
  },
  {
    value: 120,
    label: '2m',
  },
  {
    value: 300,
    label: '5m',
  },
  {
    value: 900,
    label: '15m',
  },
  {
    value: 3600,
    label: '1h',
  },
];

function getDisplayName(
  activeSymbols,
  symbol
) {
  const item = (
    activeSymbols || []
  ).find((entry) => {
    const entrySymbol =
      entry?.underlying_symbol ||
      entry?.symbol;

    return (
      entrySymbol === symbol
    );
  });

  return (
    item?.underlying_symbol_name ||
    item?.display_name ||
    symbol
  );
}

function mapActiveSymbols(
  activeSymbols
) {
  return (
    activeSymbols || []
  )
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

      const marketDisplayName =
        item?.market_display_name ||
        item?.market_name ||
        'Deriv';

      const submarket =
        item?.submarket ||
        item?.subgroup ||
        market;

      const submarketDisplayName =
        item?.submarket_display_name ||
        item?.subgroup_display_name ||
        marketDisplayName;

      const pipSize =
        Number(
          item?.pip_size
        );

      const pip =
        Number.isFinite(
          pipSize
        )
          ? 10 ** -pipSize
          : item?.pip ||
            0.01;

      return {
        ...item,
        symbol,
        display_name:
          displayName,
        market,
        market_display_name:
          marketDisplayName,
        submarket,
        submarket_display_name:
          submarketDisplayName,
        symbol_type:
          item?.symbol_type ||
          item?.underlying_symbol_type ||
          market,
        pip,
        exchange_is_open:
          item?.exchange_is_open ??
          1,
        is_trading_suspended:
          item?.is_trading_suspended ??
          0,
        allow_forward_starting:
          item?.allow_forward_starting ??
          0,
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

  static getDerivedStateFromError(
    error
  ) {
    return {
      hasError: true,
      message:
        error?.message ||
        'The chart could not be loaded.',
    };
  }

  componentDidCatch(
    error,
    info
  ) {
    console.error(
      '[BinarySpot DerivChart] SmartCharts render error:',
      error,
      info
    );
  }

  componentDidUpdate(
    previousProps
  ) {
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
    if (
      this.state.hasError
    ) {
      return (
        <div
          style={{
            minHeight: 360,
            display: 'flex',
            alignItems: 'center',
            justifyContent:
              'center',
            padding: 24,
            background:
              '#080d14',
          }}
        >
          <div
            style={{
              maxWidth: 420,
              textAlign:
                'center',
            }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                margin:
                  '0 auto 14px',
                borderRadius:
                  '50%',
                display: 'grid',
                placeItems:
                  'center',
                background:
                  'rgba(255, 68, 79, 0.12)',
                border:
                  '1px solid rgba(255, 68, 79, 0.35)',
                color:
                  '#ff6b74',
                fontWeight:
                  900,
              }}
            >
              !
            </div>

            <div
              style={{
                color:
                  '#f4f7fb',
                fontSize: 16,
                fontWeight:
                  800,
              }}
            >
              Chart unavailable
            </div>

            <div
              style={{
                marginTop: 8,
                color:
                  '#8290a6',
                fontSize: 13,
                lineHeight: 1.6,
              }}
            >
              {this.state
                .message}
            </div>

            <div
              style={{
                marginTop: 12,
                color:
                  '#64748b',
                fontSize: 12,
                lineHeight: 1.6,
              }}
            >
              BinarySpot remains
              available even if
              the chart fails.
            </div>
          </div>
        </div>
      );
    }

    return this.props
      .children;
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
  const adapterRef =
    useRef(null);

  const mountedRef =
    useRef(true);

  const [
    SmartChart,
    setSmartChart,
  ] = useState(null);

  const [
    chartReady,
    setChartReady,
  ] = useState(false);

  const [
    chartError,
    setChartError,
  ] = useState('');

  const [
    granularity,
    setGranularity,
  ] = useState(
    DEFAULT_GRANULARITY
  );

  const [
    chartType,
    setChartType,
  ] = useState(
    'candles'
  );

  const [
    reloadKey,
    setReloadKey,
  ] = useState(0);

  const normalizedSymbols =
    useMemo(
      () =>
        mapActiveSymbols(
          activeSymbols
        ),
      [activeSymbols]
    );

  const displayName =
    useMemo(
      () =>
        getDisplayName(
          activeSymbols,
          symbol
        ),
      [
        activeSymbols,
        symbol,
      ]
    );

  useEffect(() => {
    mountedRef.current =
      true;

    return () => {
      mountedRef.current =
        false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadSmartCharts() {
      setChartReady(false);
      setChartError('');

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
          typeof module
            .setSmartChartsPublicPath ===
          'function'
        ) {
          module.setSmartChartsPublicPath(
            '/smartcharts/'
          );
        }

        if (
          !module.SmartChart
        ) {
          throw new Error(
            'SmartChart export was not found.'
          );
        }

        setSmartChart(
          () =>
            module.SmartChart
        );

        setChartReady(true);
      } catch (error) {
        console.error(
          '[BinarySpot DerivChart] SmartCharts import failed:',
          error
        );

        if (
          !cancelled &&
          mountedRef.current
        ) {
          setSmartChart(null);

          setChartReady(false);

          setChartError(
            error?.message ||
              'Unable to load Deriv SmartCharts.'
          );
        }
      }
    }

    loadSmartCharts();

    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  useEffect(() => {
    if (
      adapterRef.current
    ) {
      return;
    }

    adapterRef.current =
      createDerivSmartChartsAdapter();

    return () => {
      adapterRef.current?.destroy?.();

      adapterRef.current =
        null;
    };
  }, []);

  const getQuotes =
    useMemo(
      () =>
        async (
          request
        ) => {
          if (
            !adapterRef.current
          ) {
            return {
              quotes: [],
              meta: {
                symbol:
                  request?.symbol ||
                  symbol,
                granularity:
                  request
                    ?.granularity ??
                  granularity,
              },
            };
          }

          return adapterRef.current.getQuotes(
            request
          );
        },
      [
        symbol,
        granularity,
      ]
    );

  const subscribeQuotes =
    useMemo(
      () =>
        (
          request,
          callback
        ) => {
          if (
            !adapterRef.current
          ) {
            return () => {};
          }

          return adapterRef.current.subscribeQuotes(
            request,
            callback
          );
        },
      []
    );

  const unsubscribeQuotes =
    useMemo(
      () =>
        (request) => {
          adapterRef.current?.unsubscribeQuotes?.(
            request
          );
        },
      []
    );

  const numericQuote =
    Number(quote);

  const formattedQuote =
    Number.isFinite(
      numericQuote
    )
      ? numericQuote.toFixed(
          Number.isFinite(
            Number(pipSize)
          )
            ? Number(
                pipSize
              )
            : 2
        )
      : '—';

  const handleRetry = () => {
    setChartError('');
    setSmartChart(null);
    setChartReady(false);

    setReloadKey(
      (value) =>
        value + 1
    );
  };

  const chartHeight =
    Math.max(
      Number(height) ||
        430,
      300
    );

  const chartKey = [
    symbol,
    granularity,
    chartType,
    reloadKey,
  ].join('-');

  return (
    <>
      <link
        rel="stylesheet"
        href="/smartcharts/smartcharts.css"
      />

      <section
        className={
          className
        }
        style={{
          width: '100%',
          overflow:
            'hidden',
          borderRadius:
            18,
          border:
            '1px solid #1d2a3d',
          background:
            '#080d14',
          boxShadow:
            '0 18px 50px rgba(0, 0, 0, 0.22)',
        }}
      >
        <div
          style={{
            minHeight: 66,
            display: 'flex',
            alignItems:
              'center',
            justifyContent:
              'space-between',
            gap: 14,
            padding:
              '12px 14px',
            borderBottom:
              '1px solid #172235',
            background:
              '#0c131f',
            flexWrap:
              'wrap',
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
                flex:
                  '0 0 auto',
                borderRadius:
                  10,
                display: 'grid',
                placeItems:
                  'center',
                background:
                  '#111d2d',
                border:
                  '1px solid #24334a',
                color:
                  '#ff4758',
                fontWeight:
                  900,
                fontSize: 17,
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
                  color:
                    '#f8fafc',
                  fontSize: 14,
                  fontWeight:
                    800,
                  overflow:
                    'hidden',
                  textOverflow:
                    'ellipsis',
                  whiteSpace:
                    'nowrap',
                }}
              >
                {displayName}
              </div>

              <div
                style={{
                  marginTop: 3,
                  display:
                    'flex',
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
                    boxShadow:
                      '0 0 10px rgba(34, 211, 165, 0.75)',
                  }}
                />

                LIVE

                <span>
                  •
                </span>

                {symbol}
              </div>
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems:
                'center',
              gap: 8,
              flexWrap:
                'wrap',
            }}
          >
            <div
              style={{
                padding:
                  '7px 10px',
                borderRadius:
                  9,
                background:
                  '#070c13',
                border:
                  '1px solid #1e2b3f',
                color:
                  '#e8edf5',
                fontSize: 13,
                fontWeight:
                  800,
                fontVariantNumeric:
                  'tabular-nums',
              }}
            >
              {formattedQuote}
            </div>

            <select
              value={
                granularity
              }
              onChange={(
                event
              ) => {
                const next =
                  Number(
                    event
                      .target
                      .value
                  );

                setGranularity(
                  next
                );

                if (
                  next === 0
                ) {
                  setChartType(
                    'line'
                  );
                }
              }}
              style={{
                height: 34,
                padding:
                  '0 9px',
                borderRadius:
                  9,
                border:
                  '1px solid #26364e',
                background:
                  '#111b29',
                color:
                  '#e8edf5',
                fontWeight:
                  800,
                outline:
                  'none',
              }}
            >
              {GRANULARITIES.map(
                (item) => (
                  <option
                    key={
                      item.value
                    }
                    value={
                      item.value
                    }
                  >
                    {
                      item.label
                    }
                  </option>
                )
              )}
            </select>

            <select
              value={
                chartType
              }
              disabled={
                granularity ===
                0
              }
              onChange={(
                event
              ) =>
                setChartType(
                  event
                    .target
                    .value
                )
              }
              style={{
                height: 34,
                padding:
                  '0 9px',
                borderRadius:
                  9,
                border:
                  '1px solid #26364e',
                background:
                  '#111b29',
                color:
                  granularity ===
                  0
                    ? '#536176'
                    : '#e8edf5',
                fontWeight:
                  800,
                outline:
                  'none',
              }}
            >
              <option value="candles">
                Candles
              </option>

              <option value="line">
                Line
              </option>
            </select>
          </div>
        </div>

        <div
          style={{
            position:
              'relative',
            width: '100%',
            height:
              chartHeight,
            minHeight: 300,
            background:
              '#080d14',
          }}
        >
          {!chartReady &&
            !chartError && (
              <div
                style={{
                  position:
                    'absolute',
                  inset: 0,
                  display:
                    'grid',
                  placeItems:
                    'center',
                  zIndex: 2,
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
                      width: 30,
                      height: 30,
                      margin:
                        '0 auto 12px',
                      borderRadius:
                        '50%',
                      border:
                        '3px solid #253248',
                      borderTopColor:
                        '#ff4758',
                      animation:
                        'binaryspot-chart-spin 0.8s linear infinite',
                    }}
                  />

                  <div
                    style={{
                      color:
                        '#a3afc2',
                      fontSize:
                        13,
                      fontWeight:
                        700,
                    }}
                  >
                    Loading Deriv
                    chart…
                  </div>
                </div>
              </div>
            )}

          {chartError && (
            <div
              style={{
                position:
                  'absolute',
                inset: 0,
                zIndex: 3,
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
                    fontSize:
                      16,
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
                    fontSize:
                      12,
                    lineHeight:
                      1.6,
                    wordBreak:
                      'break-word',
                  }}
                >
                  {chartError}
                </div>

                <button
                  type="button"
                  onClick={
                    handleRetry
                  }
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
                      '#ffffff',
                    fontWeight:
                      900,
                    cursor:
                      'pointer',
                  }}
                >
                  Retry chart
                </button>
              </div>
            </div>
          )}

          {chartReady &&
            SmartChart &&
            !chartError && (
              <ChartErrorBoundary
                resetKey={
                  chartKey
                }
              >
                <SmartChart
                  key={
                    chartKey
                  }
                  id={`binaryspot-chart-${symbol}`}
                  symbol={
                    symbol
                  }
                  granularity={
                    granularity
                  }
                  chartType={
                    granularity ===
                    0
                      ? 'line'
                      : chartType
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
                  getQuotes={
                    getQuotes
                  }
                  subscribeQuotes={
                    subscribeQuotes
                  }
                  unsubscribeQuotes={
                    unsubscribeQuotes
                  }
                  shouldFetchTradingTimes={
                    false
                  }
                  isMobile={
                    typeof window !==
                      'undefined'
                      ? window
                          .innerWidth <
                        768
                      : false
                  }
                  settings={{
                    language:
                      'en',
                    theme:
                      'dark',
                  }}
                />
              </ChartErrorBoundary>
            )}
        </div>

        <div
          style={{
            minHeight: 38,
            display: 'flex',
            alignItems:
              'center',
            justifyContent:
              'space-between',
            gap: 12,
            padding:
              '7px 13px',
            borderTop:
              '1px solid #172235',
            background:
              '#0a111b',
            color:
              '#64748b',
            fontSize: 10,
            fontWeight:
              700,
          }}
        >
          <span>
            DERIV MARKET DATA
          </span>

          <span>
            {granularity ===
            0
              ? 'TICK STREAM'
              : `${granularity / 60} MIN`}
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
