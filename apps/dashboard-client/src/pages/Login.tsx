import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import logoLight from '../assets/logo-full.png';
import logoDark from '../assets/logo.png';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();
  const { theme } = useTheme();
  const logo = theme === 'dark' ? logoDark : logoLight;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Login failed');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gh-bg-subtle dark:bg-gh-bg-dark px-5 font-sans">
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
              Welcome Back
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Sign in to your account to continue
            </p>
          </div>

          {error && (
            <div className="px-4 py-3 mb-6 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">

            {/* Email */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="login-email" className="text-sm font-medium text-gh-text dark:text-gh-text-dark">
                Email Address
              </label>
              <div className="relative">
                <svg
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <input
                  id="login-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 text-sm border border-gh-border dark:border-gh-border-dark rounded-xl bg-gh-bg dark:bg-gh-bg-dark text-gh-text dark:text-gh-text-dark placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-gh-accent dark:focus:ring-gh-accent-dark focus:border-transparent transition"
                  placeholder="you@example.com"
                  required
                  disabled={isLoading}
                />
              </div>
            </div>

            {/* Password */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="login-password" className="text-sm font-medium text-gh-text dark:text-gh-text-dark">
                Password
              </label>
              <div className="relative">
                <svg
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <input
                  id="login-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 text-sm border border-gh-border dark:border-gh-border-dark rounded-xl bg-gh-bg dark:bg-gh-bg-dark text-gh-text dark:text-gh-text-dark placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-gh-accent dark:focus:ring-gh-accent-dark focus:border-transparent transition"
                  placeholder="••••••••"
                  required
                  disabled={isLoading}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 py-3 px-6 text-base font-semibold text-white bg-gh-accent dark:bg-gh-accent-dark rounded-xl transition-all duration-200 hover:opacity-90 hover:-translate-y-px hover:shadow-lg disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer"
            >
              {isLoading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div className="mt-7 pt-5 border-t border-gh-border dark:border-gh-border-dark text-center">
            <span className="text-sm text-slate-500 dark:text-slate-400">
              Don&apos;t have an account?{' '}
              <a
                href="/signup"
                className="text-gh-accent dark:text-gh-accent-dark font-semibold hover:underline"
              >
                Sign up
              </a>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
