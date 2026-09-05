'use client';

import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

const DEFAULT_SYMBOL = 'R_100';

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

    return entrySymbol === symbol;
  });

  return (
    item?.underlying_symbol_name ||
    item?.display_name ||
    symbol
  );
}

function normalizePoint(
  item,
  index
) {
  if (item === null || item === undefined) {
    return null;
  }

  if (
    typeof item === 'number'
  ) {
    return {
      quote: item,
      epoch:
        Date.now() / 1000 +
        index,
    };
  }

  const quote = Number(
    item?.quote ??
      item?.price ??
      item?.Close ??
      item?.close
  );

  if (!Number.isFinite(quote)) {
    return null;
  }

  const epoch = Number(
    item?.epoch ??
      item?.time ??
      item?.timestamp ??
      Date.now() / 1000 +
        index
  );

  return {
    quote,
    epoch:
      Number.isFinite(epoch)
        ? epoch
        : Date.now() / 1000 +
          index,
  };
}

function formatPrice(
  value,
  pipSize
) {
  const number =
    Number(value);

  if (!Number.isFinite(number)) {
    return '—';
  }

  const decimals =
    Number.isFinite(
      Number(pipSize)
    )
      ? Number(pipSize)
      : 2;

  return number.toFixed(
    decimals
  );
}

function buildPath(
  points,
  width,
  height,
  padding
) {
  if (
    !Array.isArray(points) ||
    points.length < 2
  ) {
    return {
      path: '',
      min: null,
      max: null,
    };
  }

  const values =
    points.map(
      (point) =>
        point.quote
    );

  let min =
    Math.min(
      ...values
    );

  let max =
    Math.max(
      ...values
    );

  if (
    !Number.isFinite(min) ||
    !Number.isFinite(max)
  ) {
    return {
      path: '',
      min: null,
      max: null,
    };
  }

  if (min === max) {
    min -= 1;
    max += 1;
  }

  const usableWidth =
    width -
    padding * 2;

  const usableHeight =
    height -
    padding * 2;

  const priceRange =
    max - min;

  const lastIndex =
    points.length - 1;

  const coords =
    points.map(
      (point, index) => {
        const x =
          padding +
          (
            index /
            lastIndex
          ) *
            usableWidth;

        const normalized =
          (
            point.quote -
            min
          ) /
          priceRange;

        const y =
          padding +
          (
            1 -
            normalized
          ) *
            usableHeight;

        return {
          x,
          y,
        };
      }
    );

  const path =
    coords
      .map(
        (coord, index) =>
          `${
            index === 0
              ? 'M'
              : 'L'
          } ${coord.x.toFixed(
            2
          )} ${coord.y.toFixed(
            2
          )}`
      )
      .join(' ');

  return {
    path,
    min,
    max,
  };
}

export default function DerivChart({
  symbol = DEFAULT_SYMBOL,
  activeSymbols = [],
  quote = null,
  pipSize = null,
  height = 430,
  className = '',
  tickHistory = [],
}) {
  const containerRef =
    useRef(null);

  const [
    size,
    setSize,
  ] = useState({
    width: 720,
    height: 430,
  });

  const [
    localPoints,
    setLocalPoints,
  ] = useState([]);

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
    const element =
      containerRef.current;

    if (!element) {
      return;
    }

    const updateSize =
      () => {
        const rect =
          element.getBoundingClientRect();

        setSize({
          width:
            Math.max(
              rect.width,
              280
            ),
          height:
            Math.max(
              Number(height) ||
                430,
              320
            ),
        });
      };

    updateSize();

    const observer =
      new ResizeObserver(
        updateSize
      );

    observer.observe(
      element
    );

    return () => {
      observer.disconnect();
    };
  }, [height]);

  useEffect(() => {
    const normalized =
      (
        tickHistory ||
        []
      )
        .map(
          normalizePoint
        )
        .filter(Boolean);

    if (
      normalized.length
    ) {
      setLocalPoints(
        normalized.slice(
          -120
        )
      );
    }
  }, [
    tickHistory,
    symbol,
  ]);

  useEffect(() => {
    const liveQuote =
      Number(quote);

    if (
      !Number.isFinite(
        liveQuote
      )
    ) {
      return;
    }

    setLocalPoints(
      (current) => {
        const next =
          [
            ...current,
            {
              quote:
                liveQuote,
              epoch:
                Date.now() /
                1000,
            },
          ];

        return next.slice(
          -120
        );
      }
    );
  }, [quote]);

  const chart =
    useMemo(
      () =>
        buildPath(
          localPoints,
          size.width,
          size.height,
          22
        ),
      [
        localPoints,
        size,
      ]
    );

  const latest =
    localPoints[
      localPoints.length -
        1
    ]?.quote;

  const first =
    localPoints[0]
      ?.quote;

  const positive =
    Number.isFinite(
      latest
    ) &&
    Number.isFinite(
      first
    )
      ? latest >= first
      : true;

  const lineColor =
    positive
      ? '#22d3a5'
      : '#ff5f6d';

  const currentPrice =
    Number.isFinite(
      Number(quote)
    )
      ? Number(quote)
      : latest;

  const change =
    Number.isFinite(
      latest
    ) &&
    Number.isFinite(
      first
    )
      ? latest - first
      : null;

  const changePct =
    Number.isFinite(
      change
    ) &&
    Number.isFinite(
      first
    ) &&
    first !== 0
      ? (
          change /
          first
        ) * 100
      : null;

  return (
    <section
      className={
        className
      }
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
              display:
                'grid',
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
            display: 'flex',
            alignItems:
              'flex-end',
            gap: 10,
            flexWrap:
              'wrap',
          }}
        >
          <div
            style={{
              color:
                '#f8fafc',
              fontSize: 18,
              fontWeight:
                900,
              fontVariantNumeric:
                'tabular-nums',
            }}
          >
            {formatPrice(
              currentPrice,
              pipSize
            )}
          </div>

          {Number.isFinite(
            changePct
          ) && (
            <div
              style={{
                color:
                  positive
                    ? '#22d3a5'
                    : '#ff5f6d',
                fontSize: 12,
                fontWeight:
                  900,
              }}
            >
              {positive
                ? '+'
                : ''}
              {changePct.toFixed(
                2
              )}
              %
            </div>
          )}
        </div>
      </div>

      <div
        ref={
          containerRef
        }
        style={{
          position:
            'relative',
          width: '100%',
          height:
            Math.max(
              Number(height) ||
                430,
              320
            ),
          minHeight: 320,
          background:
            '#080d14',
        }}
      >
        <svg
          width="100%"
          height="100%"
          viewBox={`0 0 ${size.width} ${size.height}`}
          preserveAspectRatio="none"
          style={{
            position:
              'absolute',
            inset: 0,
            display: 'block',
          }}
        >
          <defs>
            <linearGradient
              id="binaryspot-fill"
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <stop
                offset="0%"
                stopColor={
                  lineColor
                }
                stopOpacity="0.22"
              />

              <stop
                offset="100%"
                stopColor={
                  lineColor
                }
                stopOpacity="0"
              />
            </linearGradient>
          </defs>

          {[0.2, 0.4, 0.6, 0.8].map(
            (ratio) => (
              <line
                key={
                  ratio
                }
                x1="0"
                x2={
                  size.width
                }
                y1={
                  size.height *
                  ratio
                }
                y2={
                  size.height *
                  ratio
                }
                stroke="#182235"
                strokeWidth="1"
              />
            )
          )}

          {chart.path && (
            <>
              <path
                d={`${chart.path} L ${size.width - 22} ${size.height - 22} L 22 ${size.height - 22} Z`}
                fill="url(#binaryspot-fill)"
                stroke="none"
              />

              <path
                d={
                  chart.path
                }
                fill="none"
                stroke={
                  lineColor
                }
                strokeWidth="2.4"
                vectorEffect="non-scaling-stroke"
              />
            </>
          )}
        </svg>

        {!chart.path && (
          <div
            style={{
              position:
                'absolute',
              inset: 0,
              display:
                'grid',
              placeItems:
                'center',
              color:
                '#748197',
              fontSize: 13,
              fontWeight:
                800,
            }}
          >
            Waiting for live ticks…
          </div>
        )}

        {chart.max !==
          null && (
          <div
            style={{
              position:
                'absolute',
              top: 12,
              right: 12,
              color:
                '#6f7d92',
              fontSize: 10,
              fontWeight:
                700,
            }}
          >
            HIGH{' '}
            {formatPrice(
              chart.max,
              pipSize
            )}
          </div>
        )}

        {chart.min !==
          null && (
          <div
            style={{
              position:
                'absolute',
              bottom: 12,
              right: 12,
              color:
                '#6f7d92',
              fontSize: 10,
              fontWeight:
                700,
            }}
          >
            LOW{' '}
            {formatPrice(
              chart.min,
              pipSize
            )}
          </div>
        )}
      </div>

      <div
        style={{
          minHeight: 38,
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
          BINARYSPOT LIVE CHART
        </span>

        <span>
          {localPoints.length} TICKS
        </span>
      </div>
    </section>
  );
}
