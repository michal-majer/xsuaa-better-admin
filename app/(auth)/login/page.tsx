'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn } from '@/lib/auth-client';
import Link from 'next/link';

const errorMessages: Record<string, string> = {
  no_code: 'Authorization code not received from SAP',
  token_exchange_failed: 'Failed to exchange token with SAP',
  callback_failed: 'SAP login callback failed',
  xsuaa_not_configured: 'SAP login is only available when deployed to Cloud Foundry',
};

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/dashboard';
  const urlError = searchParams.get('error');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(urlError ? errorMessages[urlError] || urlError : '');
  const [loading, setLoading] = useState(false);
  const [sapLoading, setSapLoading] = useState(false);
  const [sapSuccess, setSapSuccess] = useState(false);

  // Fake SAP login simulation for localhost
  const handleSapLogin = () => {
    setSapLoading(true);
    setSapSuccess(false);

    // Simulate a 3-second authentication process
    setTimeout(() => {
      setSapSuccess(true);

      // Show success for 0.5 second then redirect or show error
      setTimeout(() => {
        // Check if running on localhost
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
          // For localhost, show success message instead of redirecting
          alert('🎉 SAP Login Successful!\n\nIn production, this would redirect to SAP XSUAA for authentication.\n\nFor now, you can use the email/password login above.');
          setSapLoading(false);
          setSapSuccess(false);
        } else {
          // In production, redirect to actual SAP login
          window.location.href = '/api/auth/xsuaa?action=login';
        }
      }, 500);
    }, 2500);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await signIn.email({
        email,
        password,
      });

      if (result.error) {
        setError(result.error.message || 'Login failed');
      } else {
        router.push(callbackUrl);
        router.refresh();
      }
    } catch {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {error && (
        <div className="bg-red-50 border border-red-400 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 text-gray-900 placeholder:text-gray-400"
            placeholder="you@example.com"
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700">
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 text-gray-900 placeholder:text-gray-400"
            placeholder="Your password"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Signing in...' : 'Sign In'}
        </button>
      </form>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-300" />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-2 bg-white text-gray-500">Or continue with</span>
        </div>
      </div>

      <button
        onClick={handleSapLogin}
        disabled={sapLoading}
        className={`group relative w-full flex items-center justify-center gap-3 py-3 px-4 border-2 rounded-lg shadow-sm text-sm font-medium transition-all duration-600 ease-out animate-button-enter focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:cursor-not-allowed ${
          sapLoading
            ? 'border-[#1870c5] bg-gradient-to-r from-[#00b8f1] via-[#1870c5] to-[#1d61bc] text-white'
            : 'border-gray-300 bg-white text-gray-700 hover:border-[#1870c5] hover:bg-gradient-to-r hover:from-[#00b8f1] hover:via-[#1870c5] hover:to-[#1d61bc] hover:text-white'
        }`}
      >
        {/* Progress border - only during loading */}
        {sapLoading && (
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none"
            style={{ overflow: 'visible' }}
          >
            <rect
              x="2"
              y="2"
              width="calc(100% - 4px)"
              height="calc(100% - 4px)"
              rx="7"
              fill="none"
              stroke="white"
              strokeWidth="3"
              strokeDasharray="1000"
              strokeDashoffset="1000"
              style={{
                animation: 'border-progress 3s ease-out forwards'
              }}
            />
          </svg>
        )}

        {/* Button content */}
        {sapLoading ? (
          <>
            <span className="flex items-center gap-2">
              {sapSuccess ? (
                <span className="animate-text-pulse text-lg h-7 flex items-center">✓ Authenticated!</span>
              ) : (
                <>
                  <span>Authenticating with</span>
                  <svg
                    className="h-7 w-auto flex-shrink-0 scale-125 animate-text-pulse transition-all duration-[2000ms] ease-in-out"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 120 60"
                    style={{ display: 'block' }}
                  >
                    <defs>
                      <linearGradient id="A" x1="42.046" y1="18.109" x2="42.046" y2="60.523" gradientUnits="userSpaceOnUse">
                        <stop offset="0" stopColor="#00b8f1"/>
                        <stop offset=".22" stopColor="#06a5e5"/>
                        <stop offset=".79" stopColor="#1870c5"/>
                        <stop offset="1" stopColor="#1d61bc"/>
                      </linearGradient>
                    </defs>
                    <path
                      d="M0 17.975V60h42.928l42.017-42.02H0z"
                      fill="url(#A)"
                      transform="matrix(1.12162 0 0 1.12162 16.361645 -13.729055)"
                    />
                    <path
                      d="M74.48 28.368h-2.008v-7.342h2.01c2.683 0 4.818.883 4.818 3.626 0 2.833-2.136 3.72-4.818 3.72m-21.63 5.255c-.997.004-1.987-.17-2.923-.515l2.894-9.127h.06l2.836 9.153a8.52 8.52 0 0 1-2.865.492M73.95 15.056h-9.13V36.76l-7.973-21.704h-7.9l-6.81 18.142c-.72-4.567-5.455-6.152-9.18-7.336-2.454-.8-5.067-1.95-5.044-3.235.02-1.05 1.404-2.026 4.13-1.88 1.838.093 3.473.24 6.676 1.797l3.183-5.522c-2.937-1.5-7.006-2.442-10.337-2.448h-.032c-3.884 0-7.12 1.265-9.127 3.34a7.72 7.72 0 0 0-2.185 5.325c-.052 2.796.978 4.78 3.134 6.367 1.823 1.337 4.15 2.196 6.205 2.842 2.535.778 4.604 1.464 4.58 2.923-.015.532-.23 1.038-.602 1.418-.63.65-1.6.9-2.943.932-2.587.052-4.503-.35-7.56-2.156l-2.82 5.594c3.148 1.788 6.703 2.733 10.323 2.746h.477c3.2-.06 5.788-.975 7.854-2.636l.336-.29-.903 2.44h8.285l1.392-4.234c3.127 1.012 6.492 1.026 9.628.04l1.34 4.196H72.47v-8.75h2.952c7.125 0 11.344-3.626 11.344-9.712 0-6.775-4.1-9.883-12.82-9.883"
                      fill="#fff"
                    />
                  </svg>
                </>
              )}
            </span>
          </>
        ) : (
          <>
            <span className="leading-none transition-colors duration-600 group-hover:text-white">Sign in with</span>
            {/* Official SAP Logo - Blue expands on hover */}
            <svg
              className="h-7 w-auto flex-shrink-0 relative z-10 transition-all duration-600 ease-out group-hover:scale-150"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 120 60"
              style={{ display: 'block' }}
            >
              <defs>
                <linearGradient id="A" x1="42.046" y1="18.109" x2="42.046" y2="60.523" gradientUnits="userSpaceOnUse">
                  <stop offset="0" stopColor="#00b8f1"/>
                  <stop offset=".22" stopColor="#06a5e5"/>
                  <stop offset=".79" stopColor="#1870c5"/>
                  <stop offset="1" stopColor="#1d61bc"/>
                </linearGradient>
              </defs>
              {/* Blue background shape - hides on hover since button becomes blue */}
              <path
                className="transition-all duration-600 ease-out group-hover:opacity-0"
                d="M0 17.975V60h42.928l42.017-42.02H0z"
                fill="url(#A)"
                transform="matrix(1.12162 0 0 1.12162 16.361645 -13.729055)"
              />
              {/* White SAP text - stays on top */}
              <path
                className="transition-all duration-600"
                d="M74.48 28.368h-2.008v-7.342h2.01c2.683 0 4.818.883 4.818 3.626 0 2.833-2.136 3.72-4.818 3.72m-21.63 5.255c-.997.004-1.987-.17-2.923-.515l2.894-9.127h.06l2.836 9.153a8.52 8.52 0 0 1-2.865.492M73.95 15.056h-9.13V36.76l-7.973-21.704h-7.9l-6.81 18.142c-.72-4.567-5.455-6.152-9.18-7.336-2.454-.8-5.067-1.95-5.044-3.235.02-1.05 1.404-2.026 4.13-1.88 1.838.093 3.473.24 6.676 1.797l3.183-5.522c-2.937-1.5-7.006-2.442-10.337-2.448h-.032c-3.884 0-7.12 1.265-9.127 3.34a7.72 7.72 0 0 0-2.185 5.325c-.052 2.796.978 4.78 3.134 6.367 1.823 1.337 4.15 2.196 6.205 2.842 2.535.778 4.604 1.464 4.58 2.923-.015.532-.23 1.038-.602 1.418-.63.65-1.6.9-2.943.932-2.587.052-4.503-.35-7.56-2.156l-2.82 5.594c3.148 1.788 6.703 2.733 10.323 2.746h.477c3.2-.06 5.788-.975 7.854-2.636l.336-.29-.903 2.44h8.285l1.392-4.234c3.127 1.012 6.492 1.026 9.628.04l1.34 4.196H72.47v-8.75h2.952c7.125 0 11.344-3.626 11.344-9.712 0-6.775-4.1-9.883-12.82-9.883"
                fill="#fff"
              />
            </svg>
          </>
        )}
      </button>
    </>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow">
        <div>
          <h2 className="text-3xl font-bold text-center text-gray-900">Sign In</h2>
          <p className="mt-2 text-center text-sm text-gray-600">Access your account</p>
        </div>

        <Suspense fallback={<div className="text-center text-gray-500">Loading...</div>}>
          <LoginForm />
        </Suspense>

        <p className="text-center text-sm text-gray-600">
          Don&apos;t have an account?{' '}
          <Link href="/signup" className="text-blue-600 hover:underline font-medium">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
