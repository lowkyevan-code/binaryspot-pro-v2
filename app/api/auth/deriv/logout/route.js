import { NextResponse } from 'next/server';

function clearCookie(response, name) {
  response.cookies.set({
    name,
    value: '',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: new Date(0),
    maxAge: 0,
  });
}

export async function POST() {
  try {
    const response = NextResponse.json(
      {
        success: true,
        authenticated: false,
        message:
          'Deriv session disconnected successfully.',
      },
      {
        status: 200,
        headers: {
          'Cache-Control':
            'no-store, no-cache, must-revalidate, proxy-revalidate',
          Pragma: 'no-cache',
          Expires: '0',
        },
      }
    );

    const cookiesToClear = [
      'deriv_access_token',
      'deriv_refresh_token',
      'deriv_oauth_state',
      'deriv_oauth_verifier',
      'deriv_pkce_verifier',
      'deriv_session',
      'deriv_account_id',
    ];

    cookiesToClear.forEach((cookieName) => {
      clearCookie(response, cookieName);
    });

    return response;
  } catch (error) {
    console.error(
      'Deriv logout route error:',
      error
    );

    return NextResponse.json(
      {
        success: false,
        authenticated: false,
        error:
          'Unable to disconnect Deriv session.',
      },
      {
        status: 500,
        headers: {
          'Cache-Control':
            'no-store, no-cache, must-revalidate, proxy-revalidate',
        },
      }
    );
  }
}
