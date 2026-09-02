import { NextResponse } from 'next/server';
import crypto from 'crypto';

const CLIENT_ID = '34hh45FQkPfMgbgj20uoR';

const REDIRECT_URI =
  'https://binaryspot-pro-v2.vercel.app/api/auth/deriv/callback';

function base64Url(buffer) {
  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export async function GET() {
  try {
    // PKCE code verifier
    const codeVerifier = base64Url(
      crypto.randomBytes(64)
    );

    // SHA-256 code challenge
    const codeChallenge = base64Url(
      crypto
        .createHash('sha256')
        .update(codeVerifier)
        .digest()
    );

    // CSRF protection
    const state = crypto
      .randomBytes(32)
      .toString('hex');

    const authUrl = new URL(
      'https://auth.deriv.com/oauth2/auth'
    );

    authUrl.searchParams.set(
      'response_type',
      'code'
    );

    authUrl.searchParams.set(
      'client_id',
      CLIENT_ID
    );

    authUrl.searchParams.set(
      'redirect_uri',
      REDIRECT_URI
    );

    authUrl.searchParams.set(
      'scope',
      'trade account_manage'
    );

    authUrl.searchParams.set(
      'state',
      state
    );

    authUrl.searchParams.set(
      'code_challenge',
      codeChallenge
    );

    authUrl.searchParams.set(
      'code_challenge_method',
      'S256'
    );

    const response = NextResponse.redirect(
      authUrl.toString()
    );

    // Store PKCE verifier securely for callback
    response.cookies.set(
      'deriv_pkce_verifier',
      codeVerifier,
      {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        path: '/',
        maxAge: 600,
      }
    );

    // Store state securely for validation
    response.cookies.set(
      'deriv_oauth_state',
      state,
      {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        path: '/',
        maxAge: 600,
      }
    );

    return response;
  } catch (error) {
    console.error(
      'Deriv OAuth start error:',
      error
    );

    return NextResponse.redirect(
      new URL(
        '/?deriv_error=oauth_start_failed',
        'https://binaryspot-pro-v2.vercel.app'
      )
    );
  }
}
