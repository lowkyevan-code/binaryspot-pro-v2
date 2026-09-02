import { NextResponse } from 'next/server';

const CLIENT_ID = '34hh45FQkPfMgbgj20uoR';

const API_BASE =
  'https://api.derivws.com';

export async function GET(request) {
  try {
    const accessToken =
      request.cookies.get(
        'deriv_access_token'
      )?.value;

    if (!accessToken) {
      return NextResponse.json(
        {
          authenticated: false,
        },
        {
          status: 401,
        }
      );
    }

    const requestUrl =
      new URL(request.url);

    const requestedAccountId =
      requestUrl.searchParams.get(
        'account_id'
      );

    const requestedType =
      requestUrl.searchParams.get(
        'account_type'
      );

    const accountsResponse =
      await fetch(
        `${API_BASE}/trading/v1/options/accounts`,
        {
          method: 'GET',

          headers: {
            Authorization:
              `Bearer ${accessToken}`,

            'Deriv-App-ID':
              CLIENT_ID,
          },

          cache: 'no-store',
        }
      );

    const accountsData =
      await accountsResponse.json();

    if (!accountsResponse.ok) {
      console.error(
        'Deriv account lookup failed:',
        accountsData
      );

      return NextResponse.json(
        {
          authenticated: false,

          error:
            accountsData
              ?.errors?.[0]
              ?.message ||
            'Unable to retrieve Deriv accounts.',
        },
        {
          status:
            accountsResponse.status,
        }
      );
    }

    let rawAccounts =
      accountsData?.data || [];

    if (!Array.isArray(rawAccounts)) {
      rawAccounts = [
        rawAccounts,
      ].filter(Boolean);
    }

    const accounts =
      rawAccounts.map(
        (account) => ({
          id:
            account.account_id,

          balance:
            account.balance ?? 0,

          currency:
            account.currency ||
            'USD',

          type:
            account.account_type ||
            '',

          status:
            account.status ||
            '',

          group:
            account.group ||
            '',
        })
      );

    if (
      accounts.length === 0
    ) {
      return NextResponse.json({
        authenticated: true,
        accounts: [],
        account: null,
        wsUrl: null,
      });
    }

    let selectedAccount =
      null;

    if (requestedAccountId) {
      selectedAccount =
        accounts.find(
          (account) =>
            account.id ===
            requestedAccountId
        );
    }

    if (
      !selectedAccount &&
      requestedType
    ) {
      selectedAccount =
        accounts.find(
          (account) =>
            account.type ===
            requestedType
        );
    }

    if (!selectedAccount) {
      const demoAccount =
        accounts.find(
          (account) =>
            account.type ===
            'demo'
        );

      const realAccount =
        accounts.find(
          (account) =>
            account.type ===
            'real'
        );

      // Safer default for development:
      selectedAccount =
        demoAccount ||
        realAccount ||
        accounts[0];
    }

    const otpResponse =
      await fetch(
        `${API_BASE}/trading/v1/options/accounts/${encodeURIComponent(
          selectedAccount.id
        )}/otp`,
        {
          method: 'POST',

          headers: {
            Authorization:
              `Bearer ${accessToken}`,

            'Deriv-App-ID':
              CLIENT_ID,
          },

          cache: 'no-store',
        }
      );

    const otpData =
      await otpResponse.json();

    if (!otpResponse.ok) {
      console.error(
        'Deriv OTP request failed:',
        otpData
      );

      return NextResponse.json(
        {
          authenticated: true,

          accounts,

          account:
            selectedAccount,

          wsUrl: null,

          error:
            otpData
              ?.errors?.[0]
              ?.message ||
            'Unable to create authenticated trading connection.',
        },
        {
          status:
            otpResponse.status,
        }
      );
    }

    const wsUrl =
      otpData?.data?.url ||
      null;

    if (!wsUrl) {
      return NextResponse.json(
        {
          authenticated: true,

          accounts,

          account:
            selectedAccount,

          wsUrl: null,

          error:
            'Deriv did not return a trading WebSocket URL.',
        },
        {
          status: 500,
        }
      );
    }

    return NextResponse.json({
      authenticated: true,

      accounts,

      account:
        selectedAccount,

      wsUrl,
    });
  } catch (error) {
    console.error(
      'Deriv session route error:',
      error
    );

    return NextResponse.json(
      {
        authenticated: false,

        error:
          'Unable to load Deriv session.',
      },
      {
        status: 500,
      }
    );
  }
}
