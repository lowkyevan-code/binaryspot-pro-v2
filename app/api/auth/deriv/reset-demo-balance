import { NextResponse } from 'next/server';

const API_BASE =
  'https://api.derivws.com';

const APP_ID =
  process.env.DERIV_APP_ID ||
  '34hh45FQkPfMgbgj20uoR';

function jsonResponse(
  body,
  status = 200
) {
  return NextResponse.json(body, {
    status,
    headers: {
      'Cache-Control':
        'no-store, no-cache, must-revalidate',
      Pragma: 'no-cache',
    },
  });
}

async function safeJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function getDerivError(
  payload,
  fallback
) {
  return (
    payload?.error?.message ||
    payload?.message ||
    fallback
  );
}

function getAccounts(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (
    Array.isArray(payload?.accounts)
  ) {
    return payload.accounts;
  }

  if (
    Array.isArray(payload?.data)
  ) {
    return payload.data;
  }

  return [];
}

function getAccountId(account) {
  return String(
    account?.account_id ||
      account?.id ||
      account?.loginid ||
      ''
  );
}

function isDemoAccount(account) {
  const type = String(
    account?.account_type ||
      account?.type ||
      ''
  ).toLowerCase();

  return (
    type === 'demo' ||
    type === 'virtual'
  );
}

export async function POST(request) {
  try {
    const accessToken =
      request.cookies.get(
        'deriv_access_token'
      )?.value;

    if (!accessToken) {
      return jsonResponse(
        {
          success: false,
          error:
            'Deriv session is not authenticated.',
        },
        401
      );
    }

    let requestBody;

    try {
      requestBody =
        await request.json();
    } catch {
      return jsonResponse(
        {
          success: false,
          error:
            'Invalid request body.',
        },
        400
      );
    }

    const accountId = String(
      requestBody?.accountId || ''
    ).trim();

    if (!accountId) {
      return jsonResponse(
        {
          success: false,
          error:
            'Demo account ID is required.',
        },
        400
      );
    }

    /*
     * First verify that the requested
     * account actually belongs to the
     * current Deriv OAuth session.
     */
    const accountsResponse =
      await fetch(
        `${API_BASE}/trading/v1/options/accounts`,
        {
          method: 'GET',

          headers: {
            Authorization:
              `Bearer ${accessToken}`,

            'Deriv-App-ID':
              APP_ID,
          },

          cache: 'no-store',
        }
      );

    const accountsPayload =
      await safeJson(
        accountsResponse
      );

    if (!accountsResponse.ok) {
      return jsonResponse(
        {
          success: false,

          error: getDerivError(
            accountsPayload,
            'Unable to verify Deriv accounts.'
          ),
        },
        accountsResponse.status ||
          502
      );
    }

    const accounts =
      getAccounts(
        accountsPayload
      );

    const requestedAccount =
      accounts.find(
        (account) =>
          getAccountId(
            account
          ) === accountId
      );

    if (!requestedAccount) {
      return jsonResponse(
        {
          success: false,

          error:
            'The requested account does not belong to the current Deriv session.',
        },
        403
      );
    }

    /*
     * Real accounts must never reach
     * the reset endpoint.
     */
    if (
      !isDemoAccount(
        requestedAccount
      )
    ) {
      return jsonResponse(
        {
          success: false,

          error:
            'Only Demo Options accounts can have their balance reset.',
        },
        400
      );
    }

    /*
     * Reset the verified Demo Options
     * account through Deriv.
     *
     * The OAuth access token remains
     * on the server and is never sent
     * to the BinarySpot browser.
     */
    const resetResponse =
      await fetch(
        `${API_BASE}/trading/v1/options/accounts/${encodeURIComponent(
          accountId
        )}/reset-demo-balance`,
        {
          method: 'POST',

          headers: {
            Authorization:
              `Bearer ${accessToken}`,

            'Deriv-App-ID':
              APP_ID,

            'Content-Type':
              'application/json',
          },

          cache: 'no-store',
        }
      );

    const resetPayload =
      await safeJson(
        resetResponse
      );

    if (!resetResponse.ok) {
      return jsonResponse(
        {
          success: false,

          error: getDerivError(
            resetPayload,
            'Deriv could not reset the demo balance.'
          ),
        },
        resetResponse.status ||
          502
      );
    }

    return jsonResponse({
      success: true,

      accountId,

      account:
        resetPayload?.account ||
        null,

      balance:
        resetPayload?.balance ??
        resetPayload?.account
          ?.balance ??
        null,

      message:
        'Demo balance reset successfully.',
    });
  } catch (error) {
    console.error(
      'Deriv demo balance reset error:',
      error
    );

    return jsonResponse(
      {
        success: false,

        error:
          'Unable to reset the demo balance right now.',
      },
      500
    );
  }
}
