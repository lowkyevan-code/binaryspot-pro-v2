const DEFAULT_WS_URL =
  'wss://api.derivws.com/trading/v1/options/ws/public';

const DEFAULT_HISTORY_COUNT = 1000;
const REQUEST_TIMEOUT = 15000;

function createRequestId() {
  return Math.floor(
    Date.now() + Math.random() * 1000000
  );
}

function toNumber(value, fallback = null) {
  const parsed = Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : fallback;
}

function normalizeGranularity(value) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 0;
  }

  return parsed;
}

function normalizeCount(value) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_HISTORY_COUNT;
  }

  return Math.min(
    Math.max(Math.floor(parsed), 1),
    5000
  );
}

function createEmptyResult(symbol, granularity) {
  return {
    quotes: [],
    meta: {
      symbol: symbol || '',
      granularity:
        normalizeGranularity(granularity),
    },
  };
}

function transformTickHistory(
  response,
  symbol,
  granularity
) {
  const prices =
    response?.history?.prices || [];

  const times =
    response?.history?.times || [];

  const quotes = [];

  const length = Math.min(
    prices.length,
    times.length
  );

  for (let index = 0; index < length; index += 1) {
    const price = toNumber(
      prices[index]
    );

    const epoch = toNumber(
      times[index]
    );

    if (
      price === null ||
      epoch === null
    ) {
      continue;
    }

    quotes.push({
      Date: String(epoch),
      Close: price,
      DT: new Date(epoch * 1000),
      tick: {
        quote: price,
        epoch,
        symbol,
      },
    });
  }

  return {
    quotes,
    meta: {
      symbol,
      granularity: 0,
      pip_size:
        response?.pip_size ?? null,
    },
  };
}

function transformCandleHistory(
  response,
  symbol,
  granularity
) {
  const candles =
    Array.isArray(response?.candles)
      ? response.candles
      : [];

  const quotes = candles
    .map((candle) => {
      const epoch = toNumber(
        candle?.epoch
      );

      const open = toNumber(
        candle?.open
      );

      const high = toNumber(
        candle?.high
      );

      const low = toNumber(
        candle?.low
      );

      const close = toNumber(
        candle?.close
      );

      if (
        epoch === null ||
        open === null ||
        high === null ||
        low === null ||
        close === null
      ) {
        return null;
      }

      return {
        Date: String(epoch),
        Open: open,
        High: high,
        Low: low,
        Close: close,
        DT: new Date(
          epoch * 1000
        ),
        ohlc: {
          epoch,
          open,
          high,
          low,
          close,
          symbol,
          granularity,
        },
      };
    })
    .filter(Boolean);

  return {
    quotes,
    meta: {
      symbol,
      granularity,
      pip_size:
        response?.pip_size ?? null,
    },
  };
}

function transformHistory(
  response,
  symbol,
  granularity
) {
  if (granularity === 0) {
    return transformTickHistory(
      response,
      symbol,
      granularity
    );
  }

  return transformCandleHistory(
    response,
    symbol,
    granularity
  );
}

function transformStreamMessage(
  response,
  symbol,
  granularity
) {
  if (response?.tick) {
    const epoch = toNumber(
      response.tick.epoch
    );

    const quote = toNumber(
      response.tick.quote
    );

    if (
      epoch === null ||
      quote === null
    ) {
      return null;
    }

    return {
      Date: String(epoch),
      Close: quote,
      DT: new Date(
        epoch * 1000
      ),
      tick: {
        ...response.tick,
        epoch,
        quote,
        symbol:
          response.tick.symbol ||
          symbol,
      },
    };
  }

  if (response?.ohlc) {
    const epoch = toNumber(
      response.ohlc.epoch
    );

    const open = toNumber(
      response.ohlc.open
    );

    const high = toNumber(
      response.ohlc.high
    );

    const low = toNumber(
      response.ohlc.low
    );

    const close = toNumber(
      response.ohlc.close
    );

    if (
      epoch === null ||
      open === null ||
      high === null ||
      low === null ||
      close === null
    ) {
      return null;
    }

    return {
      Date: String(epoch),
      Open: open,
      High: high,
      Low: low,
      Close: close,
      DT: new Date(
        epoch * 1000
      ),
      ohlc: {
        ...response.ohlc,
        epoch,
        open,
        high,
        low,
        close,
        symbol:
          response.ohlc.symbol ||
          symbol,
        granularity,
      },
    };
  }

  return null;
}

export function createDerivSmartChartsAdapter(
  options = {}
) {
  const wsUrl =
    options.wsUrl ||
    DEFAULT_WS_URL;

  let socket = null;

  let socketPromise = null;

  let destroyed = false;

  const pendingRequests =
    new Map();

  const subscriptions =
    new Map();

  function rejectPendingRequests(
    message
  ) {
    for (
      const [, pending]
      of pendingRequests
    ) {
      clearTimeout(
        pending.timeout
      );

      pending.reject(
        new Error(message)
      );
    }

    pendingRequests.clear();
  }

  function clearSubscriptions() {
    subscriptions.clear();
  }

  function handleMessage(event) {
    let data;

    try {
      data = JSON.parse(
        event.data
      );
    } catch {
      return;
    }

    const reqId =
      data?.req_id;

    if (
      reqId &&
      pendingRequests.has(reqId)
    ) {
      const pending =
        pendingRequests.get(reqId);

      pendingRequests.delete(
        reqId
      );

      clearTimeout(
        pending.timeout
      );

      if (data?.error) {
        pending.reject(
          new Error(
            data.error.message ||
              data.error.code ||
              'Deriv request failed.'
          )
        );
      } else {
        pending.resolve(data);
      }
    }

    const subscriptionId =
      data?.subscription?.id;

    if (
      subscriptionId &&
      subscriptions.has(
        subscriptionId
      )
    ) {
      const subscription =
        subscriptions.get(
          subscriptionId
        );

      const quote =
        transformStreamMessage(
          data,
          subscription.symbol,
          subscription.granularity
        );

      if (quote) {
        subscription.callback(
          quote
        );
      }
    }
  }

  function connect() {
    if (destroyed) {
      return Promise.reject(
        new Error(
          'SmartCharts adapter has been destroyed.'
        )
      );
    }

    if (
      socket &&
      socket.readyState ===
        WebSocket.OPEN
    ) {
      return Promise.resolve(
        socket
      );
    }

    if (socketPromise) {
      return socketPromise;
    }

    socketPromise =
      new Promise(
        (resolve, reject) => {
          const nextSocket =
            new WebSocket(wsUrl);

          socket = nextSocket;

          const handleOpen =
            () => {
              socketPromise =
                null;

              resolve(
                nextSocket
              );
            };

          const handleError =
            () => {
              socketPromise =
                null;

              reject(
                new Error(
                  'Unable to connect SmartCharts to Deriv.'
                )
              );
            };

          nextSocket.addEventListener(
            'open',
            handleOpen,
            {
              once: true,
            }
          );

          nextSocket.addEventListener(
            'error',
            handleError,
            {
              once: true,
            }
          );

          nextSocket.addEventListener(
            'message',
            handleMessage
          );

          nextSocket.addEventListener(
            'close',
            () => {
              if (
                socket ===
                nextSocket
              ) {
                socket = null;
              }

              socketPromise =
                null;

              rejectPendingRequests(
                'Deriv SmartCharts connection closed.'
              );

              clearSubscriptions();
            }
          );
        }
      );

    return socketPromise;
  }

  async function send(
    request
  ) {
    const activeSocket =
      await connect();

    if (
      activeSocket.readyState !==
      WebSocket.OPEN
    ) {
      throw new Error(
        'Deriv SmartCharts connection is not ready.'
      );
    }

    const reqId =
      createRequestId();

    return new Promise(
      (resolve, reject) => {
        const timeout =
          setTimeout(
            () => {
              pendingRequests.delete(
                reqId
              );

              reject(
                new Error(
                  'Deriv SmartCharts request timed out.'
                )
              );
            },
            REQUEST_TIMEOUT
          );

        pendingRequests.set(
          reqId,
          {
            resolve,
            reject,
            timeout,
          }
        );

        try {
          activeSocket.send(
            JSON.stringify({
              ...request,
              req_id: reqId,
            })
          );
        } catch (error) {
          clearTimeout(
            timeout
          );

          pendingRequests.delete(
            reqId
          );

          reject(error);
        }
      }
    );
  }

  async function forget(
    subscriptionId
  ) {
    if (!subscriptionId) {
      return;
    }

    subscriptions.delete(
      subscriptionId
    );

    try {
      await send({
        forget:
          subscriptionId,
      });
    } catch {
      // The connection may already
      // be closed. Local cleanup
      // has still completed.
    }
  }

  async function getQuotes(
    request = {}
  ) {
    const symbol =
      request.symbol;

    const granularity =
      normalizeGranularity(
        request.granularity
      );

    if (!symbol) {
      return createEmptyResult(
        '',
        granularity
      );
    }

    const apiRequest = {
      ticks_history: symbol,
      end:
        request.end ||
        'latest',
      adjust_start_time: 1,
    };

    if (request.start) {
      apiRequest.start =
        request.start;
    } else {
      apiRequest.count =
        normalizeCount(
          request.count
        );
    }

    if (granularity === 0) {
      apiRequest.style =
        'ticks';
    } else {
      apiRequest.style =
        'candles';

      apiRequest.granularity =
        granularity;
    }

    try {
      const response =
        await send(
          apiRequest
        );

      return transformHistory(
        response,
        symbol,
        granularity
      );
    } catch (error) {
      console.error(
        '[BinarySpot SmartCharts] Historical data error:',
        error
      );

      return createEmptyResult(
        symbol,
        granularity
      );
    }
  }

  function subscribeQuotes(
    request = {},
    callback
  ) {
    const symbol =
      request.symbol;

    const granularity =
      normalizeGranularity(
        request.granularity
      );

    let cancelled = false;

    let subscriptionId =
      null;

    if (
      !symbol ||
      typeof callback !==
        'function'
    ) {
      return () => {};
    }

    const subscribe =
      async () => {
        try {
          const response =
            await send({
              ticks_history:
                symbol,
              end: 'latest',
              count: 1,
              subscribe: 1,
              style:
                granularity === 0
                  ? 'ticks'
                  : 'candles',
              ...(granularity > 0
                ? {
                    granularity,
                  }
                : {}),
            });

          if (cancelled) {
            if (
              response
                ?.subscription
                ?.id
            ) {
              await forget(
                response
                  .subscription
                  .id
              );
            }

            return;
          }

          subscriptionId =
            response
              ?.subscription
              ?.id ||
            null;

          if (
            subscriptionId
          ) {
            subscriptions.set(
              subscriptionId,
              {
                symbol,
                granularity,
                callback,
              }
            );
          }

          const initialQuote =
            transformStreamMessage(
              response,
              symbol,
              granularity
            );

          if (
            initialQuote &&
            !cancelled
          ) {
            callback(
              initialQuote
            );
          }
        } catch (error) {
          console.error(
            '[BinarySpot SmartCharts] Subscription error:',
            error
          );
        }
      };

    subscribe();

    return () => {
      cancelled = true;

      if (
        subscriptionId
      ) {
        forget(
          subscriptionId
        );
      }
    };
  }

  function unsubscribeQuotes(
    request
  ) {
    if (
      typeof request ===
      'function'
    ) {
      request();
      return;
    }

    const subscriptionId =
      request?.subscriptionId ||
      request?.subscription_id ||
      request?.id;

    if (
      subscriptionId
    ) {
      forget(
        subscriptionId
      );
    }
  }

  async function ping() {
    try {
      await send({
        ping: 1,
      });

      return true;
    } catch {
      return false;
    }
  }

  function destroy() {
    destroyed = true;

    rejectPendingRequests(
      'SmartCharts adapter destroyed.'
    );

    clearSubscriptions();

    if (
      socket &&
      socket.readyState ===
        WebSocket.OPEN
    ) {
      socket.close();
    }

    socket = null;
    socketPromise = null;
  }

  return {
    getQuotes,
    subscribeQuotes,
    unsubscribeQuotes,
    ping,
    destroy,
  };
}

export default createDerivSmartChartsAdapter;
