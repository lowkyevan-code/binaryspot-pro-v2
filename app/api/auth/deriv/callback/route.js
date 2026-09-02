import { NextResponse } from 'next/server';

const CLIENT_ID = '34hh45FQkPfMgbgj20uoR';

const REDIRECT_URI =
  'https://binaryspot-pro-v2.vercel.app/auth/deriv/callback';

const TOKEN_URL =
  'https://auth.deriv.com/oauth2/token';

export async function POST(request) {
  try {
    const body = await request.json();

    const code = body?.code;
    const codeVerifier = body?.codeVerifier;

    if (!code || !codeVerifier) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing OAuth code or PKCE verifier.',
        },
        {
          status: 400,
        }
      );
    }

    const tokenBody = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: CLIENT_ID,
      code,
      code_verifier: codeVerifier,
      redirect_uri: REDIRECT_URI,
    });

    const tokenResponse = await fetch(
      TOKEN_URL,
      {
        method: 'POST',
        headers: {
          'Content-Type':
            'application/x-www-form-urlencoded',
        },
        body: tokenBody.toString(),
        cache: 'no-store',
      }
    );

    const tokenData =
      await tokenResponse.json();

    if (
      !tokenResponse.ok ||
      !tokenData.access_token
    ) {
      console.error(
        'Deriv token exchange failed:',
        tokenData
      );

      return NextResponse.json(
        {
          success: false,
          error:
            tokenData?.error_description ||
            tokenData?.error ||
            'Deriv token exchange failed.',
        },
        {
          status: tokenResponse.status || 400,
        }
      );
    }

    const response =
      NextResponse.json({
        success: true,
      });

    response.cookies.set(
      'deriv_access_token',
      tokenData.access_token,
      {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        path: '/',
        maxAge:
          Number(tokenData.expires_in) ||
          3600,
      }
    );

    return response;
  } catch (error) {
    console.error(
      'Deriv OAuth callback API error:',
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          'Unable to complete Deriv authorization.',
      },
      {
        status: 500,
      }
    );
  }
}
