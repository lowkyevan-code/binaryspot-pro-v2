import { NextResponse } from 'next/server';

const CLIENT_ID = '34hh45FQkPfMgbgj20uoR';

const API_BASE = 'https://api.derivws.com';

export async function GET(request) {
  try {
    const accessToken =
      request.cookies.get('deriv_access_token')?.value;

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

    const accountsResponse = await fetch(
      `${API_BASE}/trading/v1/options/accounts`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Deriv-App-ID': CLIENT_ID,
        },
        cache: 'no-store',
      }
    );

    const accountsData = await accountsResponse.json();

    if (!accountsResponse.ok) {
      console.error(
        'Deriv account lookup failed:',
        accountsData
      );

      return NextResponse.json(
        {
          authenticated: false,
          error:
            accountsData?.errors?.[0]?.message ||
            'Unable to retrieve Deriv accounts.',
        },
        {
          status: accountsResponse.status,
        }
      );
    }

    let accounts = accountsData?.data || [];

    if (!Array.isArray(accounts)) {
      accounts = [accounts].filter(Boolean);
    }

    if (accounts.length === 0) {
      return NextResponse.json({
        authenticated: true,
        account: null,
        wsUrl: null,
      });
    }

    const realAccount = accounts.find(
      (account) => account.account_type === 'real'
    );

    const demoAccount = accounts.find(
      (account) => account.account_type === 'demo'
    );

    const selectedAccount =
      realAccount || demoAccount || accounts[0];

    const accountId = selectedAccount.account_id;

    const otpResponse = await fetch(
      `${API_BASE}/trading/v1/options/accounts/${encodeURIComponent(
        accountId
      )}/otp`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Deriv-App-ID': CLIENT_ID,
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      }
    );

    const otpData = await otpResponse.json();

    if (!otpResponse.ok) {
      console.error(
        'Deriv OTP request failed:',
        otpData
      );

      return NextResponse.json(
        {
          authenticated: true,
          account: {
            id: accountId,
            balance: selectedAccount.balance ?? 0,
            currency: selectedAccount.currency || 'USD',
            type: selectedAccount.account_type || null,
          },
          wsUrl: null,
          error:
            otpData?.errors?.[0]?.message ||
            'Unable to create authenticated trading connection.',
        },
        {
          status: otpResponse.status,
        }
      );
    }

    return NextResponse.json({
      authenticated: true,

      account: {
        id: accountId,
        balance: selectedAccount.balance ?? 0,
        currency: selectedAccount.currency || 'USD',
        type: selectedAccount.account_type || null,
      },

      wsUrl: otpData?.data?.url || null,
    });
  } catch (error) {
    console.error(
      'Deriv session route error:',
      error
    );

    return NextResponse.json(
      {
        authenticated: false,
        error: 'Unable to load Deriv session.',
      },
      {
        status: 500,
      }
    );
  }
}
