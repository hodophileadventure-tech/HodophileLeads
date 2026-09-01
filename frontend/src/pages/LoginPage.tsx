import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/common';
import hodophileLogo from '../assets/hodophile-logo-black.png';

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await login(email, password);
      window.location.href = '/';
    } catch (err) {
      setError('Login failed. Please check your credentials.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page flex min-h-screen items-center justify-center p-5 sm:p-8">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-xl border border-white/10 bg-white shadow-2xl lg:grid-cols-[1.05fr_.95fr]">
        <div className="login-intro hidden flex-col justify-between bg-[#17232d] p-10 text-white lg:flex">
          <div>
            <img src={hodophileLogo} alt="Hodophile logo" className="h-auto w-full max-w-[520px] object-contain" />
            <p className="mt-20 max-w-sm font-display text-4xl font-bold leading-tight text-white">Every journey starts with a better conversation.</p>
            <p className="mt-5 max-w-sm text-sm leading-6 text-slate-300">A focused workspace for turning travel enquiries into memorable experiences.</p>
          </div>
          <p className="text-xs font-semibold uppercase tracking-[.16em] text-slate-400">Travel operations platform</p>
        </div>
        <div className="p-7 sm:p-10">
          <div className="mb-9 lg:hidden">
            <img src={hodophileLogo} alt="Hodophile logo" className="h-auto w-full max-w-[360px] object-contain" />
            <p className="mt-2 text-sm text-slate-500">Travel operations platform</p>
          </div>
          <div className="mb-8">
            <p className="text-xs font-bold uppercase tracking-[.16em] text-amber-600">Welcome back</p>
            <h1 className="mt-2 text-3xl font-bold text-slate-900">Sign in to your workspace</h1>
            <p className="mt-2 text-sm text-slate-500">Manage leads, follow-ups, and bookings in one place.</p>
          </div>

          {error && (
            <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">Email address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@hodophile.com"
                className="input-field"
                required
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="input-field"
                required
              />
            </div>

            <Button
              type="submit"
              variant="primary"
              loading={loading}
              className="w-full"
            >
              {loading ? 'Logging in...' : 'Login'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
