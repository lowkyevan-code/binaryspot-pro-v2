const DEFAULT_WS_URL =
  'wss://api.derivws.com/trading/v1/options/ws/public';

const DEFAULT_HISTORY_COUNT = 1000;
const REQUEST_TIMEOUT_MS = 15000;

function createId() {
  return (
    Date.now() * 1000 +
    Math.floor(Math.random() * 1000)
  );
}

function toFiniteNumber(value) {
  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : null;
}

function normalizeGranularity(value) {
  const granularity =
    Number(value);

  if (
    !Number.isFinite(granularity) ||
    granularity < 0
  ) {
    return 0;
  }

  return Math.floor(
    granularity
  );
}

function normalizeCount(value) {
  const count =
    Number(value);

  if (
    !Number.isFinite(count) ||
    count <= 0
  ) {
    return DEFAULT_HISTORY_COUNT;
  }

  return Math.min(
    Math.max(
      Math.floor(count),
      1
    ),
    5000
  );
}

function emptyHistory(
  symbol,
  granularity
) {
  return {
    quotes: [],
    meta: {
      symbol:
        symbol || '',
      granularity:
        normalizeGranularity(
          granularity
        ),
      delay_amount: 0,
    },
  };
}

function transformTickHistory(
  response,
  symbol
) {
  const history =
    response?.history;

  if (!history) {
    return emptyHistory(
      symbol,
      0
    );
  }

  const prices =
    Array.isArray(
      history.prices
    )
      ? history.prices
      : [];

  const times =
    Array.isArray(
      history.times
    )
      ? history.times
      : [];

  const length =
    Math.min(
      prices.length,
      times.length
    );

  const quotes = [];

  for (
    let index = 0;
    index < length;
    index += 1
  ) {
    const close =
      toFiniteNumber(
        prices[index]
      );

    const epoch =
      toFiniteNumber(
        times[index]
      );

    if (
      close === null ||
      epoch === null
    ) {
      continue;
    }

    quotes.push({
      Date:
        String(epoch),
      Close:
        close,
      DT:
        new Date(
          epoch * 1000
        ),
    });
  }

  return {
    quotes,
    meta: {
      symbol,
      granularity: 0,
      delay_amount:
        toFiniteNumber(
          response?.pip_size
        ) ?? 0,
    },
  };
}

function transformCandleHistory(
  response,
  symbol,
  granularity
) {
  const candles =
    Array.isArray(
      response?.candles
    )
      ? response.candles
      : [];

  const quotes = [];

  for (
    const candle
    of candles
  ) {
    const epoch =
      toFiniteNumber(
        candle?.epoch
      );

    const open =
      toFiniteNumber(
        candle?.open
      );

    const high =
      toFiniteNumber(
        candle?.high
      );

    const low =
      toFiniteNumber(
        candle?.low
      );

    const close =
      toFiniteNumber(
        candle?.close
      );

    if (
      epoch === null ||
      open === null ||
      high === null ||
      low === null ||
      close === null
    ) {
      continue;
    }

    quotes.push({
      Date:
        String(epoch),
      Open:
        open,
      High:
        high,
      Low:
        low,
      Close:
        close,
      DT:
        new Date(
          epoch * 1000
        ),
    });
  }

  return {
    quotes,
    meta: {
      symbol,
      granularity,
      delay_amount:
        toFiniteNumber(
          response?.pip_size
        ) ?? 0,
    },
  };
}

function transformHistory(
  response,
  symbol,
  granularity
) {
  if (
    granularity === 0
  ) {
    return transformTickHistory(
      response,
      symbol
    );
  }

  return transformCandleHistory(
    response,
    symbol,
    granularity
  );
}

function transformTickStream(
  tick
) {
  const epoch =
    toFiniteNumber(
      tick?.epoch
    );

  const close =
    toFiniteNumber(
      tick?.quote
    );

  if (
    epoch === null ||
    close === null
  ) {
    return null;
  }

  return {
    Date:
      String(epoch),
    Close:
      close,
    DT:
      new Date(
        epoch * 1000
      ),
    tick: {
      ...tick,
      epoch,
      quote:
        close,
    },
  };
}

function transformCandleStream(
  ohlc
) {
  /*
   * Deriv's OHLC stream can identify
   * the candle using either epoch or
   * open_time depending on transport.
   */
  const epoch =
    toFiniteNumber(
      ohlc?.open_time ??
        ohlc?.epoch
    );

  const open =
    toFiniteNumber(
      ohlc?.open
    );

  const high =
    toFiniteNumber(
      ohlc?.high
    );

  const low =
    toFiniteNumber(
      ohlc?.low
    );

  const close =
    toFiniteNumber(
      ohlc?.close
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
    Date:
      String(epoch),
    Open:
      open,
    High:
      high,
    Low:
      low,
    Close:
      close,
    DT:
      new Date(
        epoch * 1000
      ),
    ohlc: {
      ...ohlc,
      epoch,
      open,
      high,
      low,
      close,
    },
  };
}

function transformStream(
  response
) {
  if (
    response?.tick
  ) {
    return transformTickStream(
      response.tick
    );
  }

  if (
    response?.ohlc
  ) {
    return transformCandleStream(
      response.ohlc
    );
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
  let connectionPromise =
    null;
  let destroyed = false;

  const requests =
    new Map();

  /*
   * Local subscription records are
   * created BEFORE sending the request.
   *
   * This prevents the first stream
   * message from racing ahead of
   * subscription registration.
   */
  const subscriptions =
    new Map();

  const subscriptionByServerId =
    new Map();

  function clearRequest(
    reqId
  ) {
    const pending =
      requests.get(reqId);

    if (!pending) {
      return;
    }

    clearTimeout(
      pending.timeout
    );

    requests.delete(
      reqId
    );
  }

  function rejectAllRequests(
    message
  ) {
    for (
      const [
        reqId,
        pending,
      ]
      of requests
    ) {
      clearTimeout(
        pending.timeout
      );

      pending.reject(
        new Error(message)
      );

      requests.delete(
        reqId
      );
    }
  }

  function handleResponseError(
    response
  ) {
    const apiError =
      response?.error;

    if (!apiError) {
      return null;
    }

    return new Error(
      apiError.message ||
        apiError.code ||
        'Deriv market-data request failed.'
    );
  }

  function routeSubscriptionMessage(
    response
  ) {
    const reqId =
      response?.req_id;

    const serverId =
      response
        ?.subscription
        ?.id;

    let localId = null;

    /*
     * First response is routed using
     * req_id because we intentionally
     * register locally before Deriv has
     * given us a server subscription ID.
     */
    if (reqId) {
      for (
        const [
          id,
          subscription,
        ]
        of subscriptions
      ) {
        if (
          subscription.reqId ===
          reqId
        ) {
          localId = id;
          break;
        }
      }
    }

    /*
     * Subsequent messages can be routed
     * directly using Deriv's real
     * subscription ID.
     */
    if (
      !localId &&
      serverId
    ) {
      localId =
        subscriptionByServerId.get(
          serverId
        ) || null;
    }

    if (!localId) {
      return;
    }

    const subscription =
      subscriptions.get(
        localId
      );

    if (
      !subscription ||
      subscription.cancelled
    ) {
      return;
    }

    if (
      serverId &&
      !subscription.serverId
    ) {
      subscription.serverId =
        serverId;

      subscriptionByServerId.set(
        serverId,
        localId
      );
    }

    const error =
      handleResponseError(
        response
      );

    if (error) {
      console.error(
        '[BinarySpot SmartCharts] Stream error:',
        error
      );

      return;
    }

    const quote =
      transformStream(
        response
      );

    if (
      quote &&
      typeof subscription.callback ===
        'function'
    ) {
      try {
        subscription.callback(
          quote
        );
      } catch (callbackError) {
        console.error(
          '[BinarySpot SmartCharts] Chart callback error:',
          callbackError
        );
      }
    }
  }

  function handleMessage(
    event
  ) {
    let response;

    try {
      response =
        JSON.parse(
          event.data
        );
    } catch {
      return;
    }

    /*
     * Route subscriptions first.
     * A subscription's initial response
     * can also have a req_id.
     */
    routeSubscriptionMessage(
      response
    );

    const reqId =
      response?.req_id;

    if (
      !reqId ||
      !requests.has(reqId)
    ) {
      return;
    }

    const pending =
      requests.get(reqId);

    clearRequest(
      reqId
    );

    const error =
      handleResponseError(
        response
      );

    if (error) {
      pending.reject(
        error
      );

      return;
    }

    pending.resolve(
      response
    );
  }

  function connect() {
    if (destroyed) {
      return Promise.reject(
        new Error(
          'Deriv SmartCharts adapter has been destroyed.'
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

    if (
      connectionPromise
    ) {
      return connectionPromise;
    }

    connectionPromise =
      new Promise(
        (
          resolve,
          reject
        ) => {
          const nextSocket =
            new WebSocket(
              wsUrl
            );

          socket =
            nextSocket;

          let settled =
            false;

          function rejectConnection(
            message
          ) {
            if (settled) {
              return;
            }

            settled = true;
            connectionPromise =
              null;

            reject(
              new Error(
                message
              )
            );
          }

          nextSocket.addEventListener(
            'message',
            handleMessage
          );

          nextSocket.addEventListener(
            'open',
            () => {
              if (settled) {
                return;
              }

              settled = true;
              connectionPromise =
                null;

              resolve(
                nextSocket
              );
            },
            {
              once: true,
            }
          );

          nextSocket.addEventListener(
            'error',
            () => {
              rejectConnection(
                'Unable to connect to Deriv market data.'
              );
            },
            {
              once: true,
            }
          );

          nextSocket.addEventListener(
            'close',
            () => {
              if (
                socket ===
                nextSocket
              ) {
                socket =
                  null;
              }

              connectionPromise =
                null;

              rejectAllRequests(
                'Deriv market-data connection closed.'
              );

              subscriptionByServerId.clear();

              for (
                const subscription
                of subscriptions.values()
              ) {
                subscription.serverId =
                  null;
              }
            }
          );
        }
      );

    return connectionPromise;
  }

  async function send(
    payload
  ) {
    const activeSocket =
      await connect();

    if (
      activeSocket.readyState !==
        WebSocket.OPEN
    ) {
      throw new Error(
        'Deriv market-data socket is not open.'
      );
    }

    const reqId =
      createId();

    return new Promise(
      (
        resolve,
        reject
      ) => {
        const timeout =
          setTimeout(
            () => {
              requests.delete(
                reqId
              );

              reject(
                new Error(
                  'Deriv market-data request timed out.'
                )
              );
            },
            REQUEST_TIMEOUT_MS
          );

        requests.set(
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
              ...payload,
              req_id:
                reqId,
            })
          );
        } catch (error) {
          clearRequest(
            reqId
          );

          reject(
            error
          );
        }
      }
    );
  }

  async function sendSubscription(
    localId,
    payload
  ) {
    const activeSocket =
      await connect();

    const subscription =
      subscriptions.get(
        localId
      );

    if (
      !subscription ||
      subscription.cancelled
    ) {
      return;
    }

    if (
      activeSocket.readyState !==
        WebSocket.OPEN
    ) {
      throw new Error(
        'Deriv market-data socket is not open.'
      );
    }

    const reqId =
      createId();

    subscription.reqId =
      reqId;

    activeSocket.send(
      JSON.stringify({
        ...payload,
        req_id:
          reqId,
      })
    );
  }

  async function forgetServerSubscription(
    serverId
  ) {
    if (!serverId) {
      return;
    }

    subscriptionByServerId.delete(
      serverId
    );

    try {
      await send({
        forget:
          serverId,
      });
    } catch {
      /*
       * Local cleanup is enough if
       * the socket has already closed.
       */
    }
  }

  async function getQuotes(
    request = {}
  ) {
    const symbol =
      request?.symbol;

    const granularity =
      normalizeGranularity(
        request?.granularity
      );

    if (!symbol) {
      return emptyHistory(
        '',
        granularity
      );
    }

    const payload = {
      ticks_history:
        symbol,

      end:
        request?.end ??
        'latest',

      adjust_start_time:
        1,

      subscribe:
        0,
    };

    if (
      request?.start !==
        undefined &&
      request?.start !==
        null
    ) {
      payload.start =
        request.start;
    } else {
      payload.count =
        normalizeCount(
          request?.count
        );
    }

    if (
      granularity === 0
    ) {
      payload.style =
        'ticks';
    } else {
      payload.style =
        'candles';

      payload.granularity =
        granularity;
    }

    try {
      const response =
        await send(
          payload
        );

      return transformHistory(
        response,
        symbol,
        granularity
      );
    } catch (error) {
      console.error(
        '[BinarySpot SmartCharts] History request failed:',
        error
      );

      return emptyHistory(
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
      request?.symbol;

    const granularity =
      normalizeGranularity(
        request?.granularity
      );

    if (
      !symbol ||
      typeof callback !==
        'function'
    ) {
      return () => {};
    }

    const localId =
      `chart-${createId()}`;

    /*
     * Register BEFORE connecting/sending.
     */
    subscriptions.set(
      localId,
      {
        localId,
        symbol,
        granularity,
        callback,
        reqId: null,
        serverId: null,
        cancelled: false,
      }
    );

    const payload = {
      ticks_history:
        symbol,

      end:
        'latest',

      count:
        1,

      subscribe:
        1,

      adjust_start_time:
        1,
    };

    if (
      granularity === 0
    ) {
      payload.style =
        'ticks';
    } else {
      payload.style =
        'candles';

      payload.granularity =
        granularity;
    }

    sendSubscription(
      localId,
      payload
    ).catch(
      (error) => {
        const subscription =
          subscriptions.get(
            localId
          );

        if (
          subscription &&
          !subscription.cancelled
        ) {
          console.error(
            '[BinarySpot SmartCharts] Subscription request failed:',
            error
          );
        }
      }
    );

    return () => {
      const subscription =
        subscriptions.get(
          localId
        );

      if (!subscription) {
        return;
      }

      subscription.cancelled =
        true;

      const serverId =
        subscription.serverId;

      subscriptions.delete(
        localId
      );

      if (serverId) {
        forgetServerSubscription(
          serverId
        );
      }
    };
  }

  function unsubscribeQuotes(
    request
  ) {
    /*
     * SmartCharts normally uses the
     * unsubscribe function returned by
     * subscribeQuotes.
     */
    if (
      typeof request ===
      'function'
    ) {
      request();
      return;
    }

    const localId =
      request?.localId ||
      request?.local_id;

    if (
      localId &&
      subscriptions.has(
        localId
      )
    ) {
      const subscription =
        subscriptions.get(
          localId
        );

      subscriptions.delete(
        localId
      );

      if (
        subscription?.serverId
      ) {
        forgetServerSubscription(
          subscription.serverId
        );
      }

      return;
    }

    const serverId =
      request?.subscriptionId ||
      request?.subscription_id ||
      request?.id;

    if (serverId) {
      const mappedLocalId =
        subscriptionByServerId.get(
          serverId
        );

      if (mappedLocalId) {
        subscriptions.delete(
          mappedLocalId
        );
      }

      forgetServerSubscription(
        serverId
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
    if (destroyed) {
      return;
    }

    destroyed = true;

    const serverIds =
      [];

    for (
      const subscription
      of subscriptions.values()
    ) {
      subscription.cancelled =
        true;

      if (
        subscription.serverId
      ) {
        serverIds.push(
          subscription.serverId
        );
      }
    }

    subscriptions.clear();
    subscriptionByServerId.clear();

    rejectAllRequests(
      'Deriv SmartCharts adapter destroyed.'
    );

    /*
     * Closing the dedicated chart socket
     * automatically terminates its market
     * subscriptions, so we do not need to
     * wait for individual forget calls.
     */
    if (
      socket &&
      (
        socket.readyState ===
          WebSocket.OPEN ||
        socket.readyState ===
          WebSocket.CONNECTING
      )
    ) {
      socket.close();
    }

    socket = null;
    connectionPromise =
      null;
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
