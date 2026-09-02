'use client';

import { useEffect, useState } from 'react';

export default function DerivOAuthCallback() {
  const [message, setMessage] = useState(
    'Completing Deriv authorization...'
  );

  useEffect(() => {
    const completeOAuth = async () => {
      try {
        const params = new URLSearchParams(
          window.location.search
        );

        const code = params.get('code');
        const returnedState = params.get('state');

        const oauthError = params.get('error');
        const oauthErrorDescription =
          params.get('error_description');

        if (oauthError) {
          window.location.href =
            `/?deriv_error=${encodeURIComponent(
              oauthErrorDescription || oauthError
            )}`;

          return;
        }

        if (!code) {
          window.location.href =
            '/?deriv_error=Authorization%20code%20missing.';

          return;
        }

        const savedState =
          sessionStorage.getItem(
            'deriv_oauth_state'
          );

        const codeVerifier =
          sessionStorage.getItem(
            'deriv_pkce_verifier'
          );

        if (
          !savedState ||
          !returnedState ||
          savedState !== returnedState
        ) {
          sessionStorage.removeItem(
            'deriv_oauth_state'
          );

          sessionStorage.removeItem(
            'deriv_pkce_verifier'
          );

          window.location.href =
            '/?deriv_error=OAuth%20state%20validation%20failed.';

          return;
        }

        if (!codeVerifier) {
          window.location.href =
            '/?deriv_error=PKCE%20verifier%20missing.%20Please%20connect%20again.';

          return;
        }

        setMessage(
          'Authorization approved. Connecting your account...'
        );

        const response = await fetch(
          '/api/auth/deriv/callback',
          {
            method: 'POST',

            headers: {
              'Content-Type':
                'application/json',
            },

            credentials: 'include',

            body: JSON.stringify({
              code,
              codeVerifier,
            }),
          }
        );

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(
            data.error ||
              'Deriv token exchange failed.'
          );
        }

        sessionStorage.removeItem(
          'deriv_oauth_state'
        );

        sessionStorage.removeItem(
          'deriv_pkce_verifier'
        );

        window.location.replace(
          '/?deriv_connected=1'
        );
      } catch (error) {
        console.error(
          'Deriv callback error:',
          error
        );

        setMessage(
          'Unable to complete Deriv authorization.'
        );

        setTimeout(() => {
          window.location.href =
            `/?deriv_error=${encodeURIComponent(
              error.message ||
                'Unable to complete Deriv authorization.'
            )}`;
        }, 1200);
      }
    };

    completeOAuth();
  }, []);

  return (
    <main className="min-h-screen bg-[#080b11] text-white flex items-center justify-center p-6">

      <div className="max-w-md w-full bg-[#0f1522] border border-slate-800 rounded-3xl p-8 text-center shadow-2xl">

        <div className="h-14 w-14 mx-auto bg-gradient-to-tr from-emerald-500 to-teal-400 rounded-2xl flex items-center justify-center font-black text-black text-xl">
          BS
        </div>

        <h1 className="mt-5 text-xl font-black">
          Connecting Deriv
        </h1>

        <p className="mt-3 text-sm text-slate-400">
          {message}
        </p>

        <div className="mt-6 flex justify-center">
          <div className="h-7 w-7 rounded-full border-2 border-slate-700 border-t-emerald-400 animate-spin" />
        </div>

      </div>

    </main>
  );
}
