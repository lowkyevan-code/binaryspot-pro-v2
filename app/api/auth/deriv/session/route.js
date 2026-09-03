import { NextResponse } from 'next/server';

const CLIENT_ID =
  '34hh45FQkPfMgbgj20uoR';

const API_BASE =
  'https://api.derivws.com';

const ACCOUNTS_ENDPOINT =
  `${API_BASE}/trading/v1/options/accounts`;

function createJsonResponse(
  body,
  status = 200
) {
  return NextResponse.json(
    body,
    {
      status,

      headers: {
        'Cache-Control':
          'no-store, no-cache, must-revalidate, proxy-revalidate',

        Pragma:
          'no-cache',

        Expires:
          '0',
      },
    }
  );
}

function normalizeAccountType(
  value
) {
  const type =
    String(
      value || ''
    )
      .trim()
      .toLowerCase();

  if (
    type === 'demo' ||
    type === 'virtual'
  ) {
    return 'demo';
  }

  if (
    type === 'real' ||
    type === 'real_money'
  ) {
    return 'real';
  }

  return type;
}

function normalizeAccount(
  account
) {
  if (
    !account ||
    typeof account !== 'object'
  ) {
    return null;
  }

  const id =
    String(
      account.account_id ||
      account.id ||
      ''
    ).trim();

  if (!id) {
    return null;
  }

  return {
    id,

    balance:
      typeof account.balance ===
      'number'
        ? account.balance
        : Number(
            account.balance ?? 0
          ),

    currency:
      String(
        account.currency ||
        'USD'
      ).toUpperCase(),

    type:
      normalizeAccountType(
        account.account_type ||
        account.type
      ),

    status:
      String(
        account.status || ''
      ).toLowerCase(),

    group:
      String(
        account.group || ''
      ),

    isDemo:
      normalizeAccountType(
        account.account_type ||
        account.type
      ) === 'demo',

    isReal:
      normalizeAccountType(
        account.account_type ||
        account.type
      ) === 'real',
  };
}

async function readJsonSafe(
  response
) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function getDerivErrorMessage(
  payload,
  fallback
) {
  if (!payload) {
    return fallback;
  }

  const errors =
    payload.errors;

  if (
    Array.isArray(errors) &&
    errors.length > 0
  ) {
    return (
      errors[0]?.message ||
      errors[0]?.code ||
      fallback
    );
  }

  if (
    typeof payload.error ===
    'string'
  ) {
    return payload.error;
  }

  if (
    typeof payload.message ===
    'string'
  ) {
    return payload.message;
  }

  return fallback;
}

function getDerivErrorCode(
  payload
) {
  if (
    Array.isArray(
      payload?.errors
    )
  ) {
    return (
      payload.errors[0]?.code ||
      null
    );
  }

  return null;
}

async function loadAccounts(
  accessToken
) {
  const response =
    await fetch(
      ACCOUNTS_ENDPOINT,
      {
        method: 'GET',

        headers: {
          Authorization:
            `Bearer ${accessToken}`,

          'Deriv-App-ID':
            CLIENT_ID,

          Accept:
            'application/json',
        },

        cache:
          'no-store',
      }
    );

  const payload =
    await readJsonSafe(
      response
    );

  return {
    response,
    payload,
  };
}

async function createFreshOtp(
  accessToken,
  accountId
) {
  const endpoint =
    `${API_BASE}/trading/v1/options/accounts/${encodeURIComponent(
      accountId
    )}/otp`;

  const response =
    await fetch(
      endpoint,
      {
        method: 'POST',

        headers: {
          Authorization:
            `Bearer ${accessToken}`,

          'Deriv-App-ID':
            CLIENT_ID,

          Accept:
            'application/json',
        },

        cache:
          'no-store',
      }
    );

  const payload =
    await readJsonSafe(
      response
    );

  return {
    response,
    payload,
  };
}

function chooseAccount({
  accounts,
  requestedAccountId,
  requestedType,
}) {
  if (
    !Array.isArray(
      accounts
    ) ||
    accounts.length === 0
  ) {
    return null;
  }

  if (
    requestedAccountId
  ) {
    const byId =
      accounts.find(
        (account) =>
          account.id ===
          requestedAccountId
      );

    if (byId) {
      return byId;
    }
  }

  if (
    requestedType
  ) {
    const normalizedType =
      normalizeAccountType(
        requestedType
      );

    const byType =
      accounts.find(
        (account) =>
          account.type ===
          normalizedType
      );

    if (byType) {
      return byType;
    }
  }

  const activeDemo =
    accounts.find(
      (account) =>
        account.type ===
          'demo' &&
        account.status !==
          'disabled'
    );

  if (activeDemo) {
    return activeDemo;
  }

  const demo =
    accounts.find(
      (account) =>
        account.type ===
        'demo'
    );

  if (demo) {
    return demo;
  }

  const activeReal =
    accounts.find(
      (account) =>
        account.type ===
          'real' &&
        account.status !==
          'disabled'
    );

  if (activeReal) {
    return activeReal;
  }

  const real =
    accounts.find(
      (account) =>
        account.type ===
        'real'
    );

  return (
    real ||
    accounts[0]
  );
}

export async function GET(
  request
) {
  try {
    const accessToken =
      request.cookies.get(
        'deriv_access_token'
      )?.value;

    if (!accessToken) {
      return createJsonResponse(
        {
          authenticated:
            false,

          accounts: [],

          account:
            null,

          wsUrl:
            null,

          error:
            null,
        },
        401
      );
    }

    const requestUrl =
      new URL(
        request.url
      );

    const requestedAccountId =
      String(
        requestUrl
          .searchParams
          .get(
            'account_id'
          ) || ''
      ).trim();

    const requestedType =
      normalizeAccountType(
        requestUrl
          .searchParams
          .get(
            'account_type'
          )
      );

    const {
      response:
        accountsResponse,

      payload:
        accountsData,
    } =
      await loadAccounts(
        accessToken
      );

    if (
      !accountsResponse.ok
    ) {
      const message =
        getDerivErrorMessage(
          accountsData,
          'Unable to retrieve Deriv accounts.'
        );

      const code =
        getDerivErrorCode(
          accountsData
        );

      console.error(
        'Deriv account lookup failed:',
        {
          status:
            accountsResponse.status,

          code,

          message,
        }
      );

      const unauthorized =
        accountsResponse.status ===
          401 ||
        accountsResponse.status ===
          403;

      return createJsonResponse(
        {
          authenticated:
            !unauthorized,

          accounts: [],

          account:
            null,

          wsUrl:
            null,

          error:
            message,

          errorCode:
            code,
        },
        accountsResponse.status
      );
    }

    let rawAccounts =
      accountsData?.data;

    if (
      !Array.isArray(
        rawAccounts
      )
    ) {
      rawAccounts =
        rawAccounts
          ? [
              rawAccounts,
            ]
          : [];
    }

    const accounts =
      rawAccounts
        .map(
          normalizeAccount
        )
        .filter(Boolean);

    if (
      accounts.length ===
      0
    ) {
      return createJsonResponse({
        authenticated:
          true,

        accounts: [],

        account:
          null,

        wsUrl:
          null,

        error:
          'No Deriv Options accounts are available for this login.',
      });
    }

    if (
      requestedAccountId
    ) {
      const exists =
        accounts.some(
          (account) =>
            account.id ===
            requestedAccountId
        );

      if (!exists) {
        return createJsonResponse(
          {
            authenticated:
              true,

            accounts,

            account:
              null,

            wsUrl:
              null,

            error:
              'The requested Deriv account is not available for this session.',
          },
          400
        );
      }
    }

    const selectedAccount =
      chooseAccount({
        accounts,

        requestedAccountId,

        requestedType,
      });

    if (!selectedAccount) {
      return createJsonResponse(
        {
          authenticated:
            true,

          accounts,

          account:
            null,

          wsUrl:
            null,

          error:
            'Unable to select a Deriv trading account.',
        },
        400
      );
    }

    if (
      selectedAccount.status ===
      'disabled'
    ) {
      return createJsonResponse(
        {
          authenticated:
            true,

          accounts,

          account:
            selectedAccount,

          wsUrl:
            null,

          error:
            'The selected Deriv account is currently disabled.',
        },
        403
      );
    }

    /*
     * Deriv authenticated Options
     * WebSocket URLs use a
     * short-lived, single-use OTP.
     *
     * Always request a fresh one.
     * Never cache or persist wsUrl.
     */

    const {
      response:
        otpResponse,

      payload:
        otpData,
    } =
      await createFreshOtp(
        accessToken,
        selectedAccount.id
      );

    if (
      !otpResponse.ok
    ) {
      const message =
        getDerivErrorMessage(
          otpData,
          'Unable to create authenticated trading connection.'
        );

      const code =
        getDerivErrorCode(
          otpData
        );

      console.error(
        'Deriv OTP request failed:',
        {
          accountId:
            selectedAccount.id,

          status:
            otpResponse.status,

          code,

          message,
        }
      );

      return createJsonResponse(
        {
          authenticated:
            true,

          accounts,

          account:
            selectedAccount,

          wsUrl:
            null,

          error:
            message,

          errorCode:
            code,
        },
        otpResponse.status
      );
    }

    const wsUrl =
      typeof otpData
        ?.data?.url ===
        'string'
        ? otpData.data.url.trim()
        : '';

    if (!wsUrl) {
      console.error(
        'Deriv OTP response did not contain a WebSocket URL:',
        {
          accountId:
            selectedAccount.id,

          payload:
            otpData,
        }
      );

      return createJsonResponse(
        {
          authenticated:
            true,

          accounts,

          account:
            selectedAccount,

          wsUrl:
            null,

          error:
            'Deriv did not return an authenticated trading WebSocket URL.',
        },
        502
      );
    }

    if (
      !wsUrl.startsWith(
        'wss://'
      )
    ) {
      console.error(
        'Invalid Deriv WebSocket URL:',
        wsUrl
      );

      return createJsonResponse(
        {
          authenticated:
            true,

          accounts,

          account:
            selectedAccount,

          wsUrl:
            null,

          error:
            'Deriv returned an invalid trading connection URL.',
        },
        502
      );
    }

    return createJsonResponse({
      authenticated:
        true,

      accounts,

      account:
        selectedAccount,

      wsUrl,

      connection: {
        accountId:
          selectedAccount.id,

        accountType:
          selectedAccount.type,

        currency:
          selectedAccount.currency,

        otpGenerated:
          true,

        reusable:
          false,
      },

      error:
        null,
    });
  } catch (error) {
    console.error(
      'Deriv session route error:',
      error
    );

    return createJsonResponse(
      {
        authenticated:
          false,

        accounts: [],

        account:
          null,

        wsUrl:
          null,

        error:
          'Unable to load Deriv session.',
      },
      500
    );
  }
}
