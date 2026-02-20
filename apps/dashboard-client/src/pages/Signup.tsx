import React, { useReducer, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import axios from 'axios';
import logoLight from '../assets/logo-full.png';
import logoDark from '../assets/logo.png';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const INPUT_CLASS =
  'w-full pl-11 pr-4 py-3 text-sm border border-gh-border dark:border-gh-border-dark rounded-xl ' +
  'bg-gh-bg dark:bg-gh-bg-dark text-gh-text dark:text-gh-text-dark placeholder-slate-400 ' +
  'focus:outline-none focus:ring-2 focus:ring-gh-accent dark:focus:ring-gh-accent-dark focus:border-transparent transition';

// ── Reducer ───────────────────────────────────────────────────────────────────

interface SignupState {
  email: string;
  password: string;
  name: string;
  organizationName: string;
  error: string;
  isLoading: boolean;
}

type SignupAction =
  | { type: 'SET_EMAIL'; value: string }
  | { type: 'SET_PASSWORD'; value: string }
  | { type: 'SET_NAME'; value: string }
  | { type: 'SET_ORG'; value: string }
  | { type: 'SET_ERROR'; value: string }
  | { type: 'SET_LOADING'; value: boolean }
  | { type: 'PREFILL_EMAIL'; value: string };

const SIGNUP_INITIAL_STATE: SignupState = {
  email: '',
  password: '',
  name: '',
  organizationName: '',
  error: '',
  isLoading: false,
};

function signupReducer(state: SignupState, action: SignupAction): SignupState {
  switch (action.type) {
    case 'SET_EMAIL':    return { ...state, email: action.value };
    case 'SET_PASSWORD': return { ...state, password: action.value };
    case 'SET_NAME':     return { ...state, name: action.value };
    case 'SET_ORG':      return { ...state, organizationName: action.value };
    case 'SET_ERROR':    return { ...state, error: action.value };
    case 'SET_LOADING':  return { ...state, isLoading: action.value };
    case 'PREFILL_EMAIL': return { ...state, email: action.value };
    default:             return state;
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export function Signup() {
  const [state, dispatch] = useReducer(signupReducer, SIGNUP_INITIAL_STATE);
  const { email, password, name, organizationName, error, isLoading } = state;

  const [searchParams] = useSearchParams();
  const invitationToken = searchParams.get('token');

  const { signup } = useAuth();
  const navigate = useNavigate();
  const { theme } = useTheme();
  const logo = theme === 'dark' ? logoDark : logoLight;

  // ── Validate invitation token via useQuery ───────────────────────────────────
  const { data: inviteData, isLoading: isValidatingInvite } = useQuery({
    queryKey: ['invitation-validate', invitationToken],
    queryFn: async () => {
      const response = await axios.get(`${API_URL}/api/invitations/validate/${invitationToken}`);
      return response.data as { valid: boolean; organizationName?: string; email?: string };
    },
    enabled: !!invitationToken,
    retry: false,
    staleTime: Infinity,
  });

  const inviteValid = inviteData?.valid === true;
  const invitedOrgName = inviteValid ? (inviteData.organizationName ?? null) : null;

  // Pre-fill email once invitation data resolves
  useEffect(() => {
    if (inviteData?.valid && inviteData.email) {
      dispatch({ type: 'PREFILL_EMAIL', value: inviteData.email });
    }
  }, [inviteData]);

  // Surface invite validation errors in the form error state
  useEffect(() => {
    if (inviteData?.valid === false) {
      dispatch({ type: 'SET_ERROR', value: 'This invitation link is invalid or has expired.' });
    }
  }, [inviteData]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    dispatch({ type: 'SET_ERROR', value: '' });
    dispatch({ type: 'SET_LOADING', value: true });

    try {
      await signup(email, password, name, invitationToken ? '' : organizationName, invitationToken || undefined);
      navigate('/dashboard');
    } catch (err: any) {
      dispatch({ type: 'SET_ERROR', value: err.response?.data?.message || err.message || 'Signup failed' });
    } finally {
      dispatch({ type: 'SET_LOADING', value: false });
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gh-bg-subtle dark:bg-gh-bg-dark px-5 py-10 font-sans">
      <div className="w-full max-w-md">

        {/* Logo — switches between black (light) and white (dark) variants; fades in on mount */}
        <div className="flex justify-center mb-6 animate-fade-in-slow">
          <img
            src={logo}
            alt="Agnostic Automation Center"
            className="h-[10.5rem] w-auto object-contain"
          />
        </div>

        {/* Card */}
        <div className="bg-gh-bg dark:bg-gh-bg-subtle-dark border border-gh-border dark:border-gh-border-dark rounded-2xl shadow-xl p-10">

          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gh-text dark:text-gh-text-dark mb-2">
              {invitedOrgName ? 'Join Organization' : 'Create Account'}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {invitedOrgName
                ? `You're invited to join ${invitedOrgName}`
                : 'Start automating your tests today'}
            </p>
          </div>

          {/* Validating invitation banner */}
          {isValidatingInvite && (
            <div role="status" className="flex items-center gap-2 px-4 py-3 mb-6 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-xl text-blue-700 dark:text-blue-400 text-sm">
              <span aria-hidden="true">⏳</span> Validating invitation...
            </div>
          )}

          {/* Invitation success banner */}
          {invitedOrgName && !isValidatingInvite && (
            <div className="flex items-center gap-2 px-4 py-3 mb-6 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl text-emerald-700 dark:text-emerald-400 text-sm">
              <span aria-hidden="true">🎉</span>
              You&apos;re joining <strong className="ml-1">{invitedOrgName}</strong>
            </div>
          )}

          {error && (
            <div role="alert" className="px-4 py-3 mb-6 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">

            {/* Full Name */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="signup-name" className="text-sm font-medium text-gh-text dark:text-gh-text-dark">
                Full Name
              </label>
              <div className="relative">
                <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <input
                  id="signup-name"
                  type="text"
                  value={name}
                  onChange={(e) => dispatch({ type: 'SET_NAME', value: e.target.value })}
                  className={INPUT_CLASS}
                  placeholder="John Doe"
                  required
                  disabled={isLoading}
                />
              </div>
            </div>

            {/* Email */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="signup-email" className="text-sm font-medium text-gh-text dark:text-gh-text-dark">
                Email Address
              </label>
              <div className="relative">
                <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <input
                  id="signup-email"
                  type="email"
                  value={email}
                  onChange={(e) => dispatch({ type: 'SET_EMAIL', value: e.target.value })}
                  className={INPUT_CLASS}
                  placeholder="you@example.com"
                  required
                  disabled={isLoading}
                />
              </div>
            </div>

            {/* Password */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="signup-password" className="text-sm font-medium text-gh-text dark:text-gh-text-dark">
                Password
              </label>
              <div className="relative">
                <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <input
                  id="signup-password"
                  type="password"
                  value={password}
                  onChange={(e) => dispatch({ type: 'SET_PASSWORD', value: e.target.value })}
                  className={INPUT_CLASS}
                  placeholder="••••••••"
                  required
                  disabled={isLoading}
                  minLength={8}
                />
              </div>
              <span className="text-xs text-slate-400">
                Min 8 characters with uppercase, lowercase, number &amp; special character
              </span>
            </div>

            {/* Organization Name — hidden when using an invitation */}
            {!invitationToken && (
              <div className="flex flex-col gap-1.5">
                <label htmlFor="signup-org" className="text-sm font-medium text-gh-text dark:text-gh-text-dark">
                  Organization Name
                </label>
                <div className="relative">
                  <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  <input
                    id="signup-org"
                    type="text"
                    value={organizationName}
                    onChange={(e) => dispatch({ type: 'SET_ORG', value: e.target.value })}
                    className={INPUT_CLASS}
                    placeholder="Your Company"
                    required
                    disabled={isLoading}
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 py-3 px-6 text-base font-semibold text-white bg-gh-accent dark:bg-gh-accent-dark rounded-xl transition-all duration-200 hover:opacity-90 hover:-translate-y-px hover:shadow-lg disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer"
            >
              {isLoading ? 'Creating account...' : 'Create Account'}
            </button>
          </form>

          <div className="mt-7 pt-5 border-t border-gh-border dark:border-gh-border-dark text-center">
            <span className="text-sm text-slate-500 dark:text-slate-400">
              Already have an account?{' '}
              <a
                href="/login"
                className="text-gh-accent dark:text-gh-accent-dark font-semibold hover:underline"
              >
                Sign in
              </a>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
