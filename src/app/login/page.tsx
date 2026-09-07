"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { ShieldCheck, ArrowRight } from 'lucide-react';

export default function LoginPage() {
  const [username, setUsername] = useState('ocs5298');
  const [password, setPassword] = useState('34237116!a');
  const { login, isLoading, error } = useAuth();
  const router = useRouter();

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const success = await login(username || 'ocs5298', password || '34237116!a');
    if (success) {
      router.push('/');
      router.refresh();
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 relative overflow-hidden font-sans">
      {/* Background Decorations */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-blue-100 rounded-full blur-3xl opacity-50" />
        <div className="absolute top-1/2 -left-24 w-72 h-72 bg-blue-50 rounded-full blur-3xl opacity-70" />
      </div>

      <div className="w-full max-w-md p-8 bg-white/90 backdrop-blur-xl rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-slate-100 z-10 relative">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 mb-5 shadow-sm border border-blue-100/60">
            <ShieldCheck size={32} />
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">VITAL Work Manager</h1>
          <p className="text-sm font-semibold text-slate-500 mt-1.5 tracking-wide">통합 업무 및 예산 관리 아키텍처</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              placeholder="Enter your ID"
              required
            />
          </div>
          
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              placeholder="••••••••"
              required
            />
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-red-50 text-red-600 text-xs font-bold text-center border border-red-100">
              {error}
            </div>
          )}

          <button
            type="submit"
            aria-label="로그인"
            disabled={isLoading}
            className="w-full py-3.5 px-4 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl shadow-sm transition-all hover:shadow focus:outline-none focus:ring-2 focus:ring-blue-500/50 disabled:opacity-50 disabled:cursor-not-allowed mt-2 flex items-center justify-center gap-2 cursor-pointer"
          >
            {isLoading ? '인증 중...' : <>로그인 <ArrowRight size={16} /></>}
          </button>
        </form>
        
        <div className="mt-6 text-center">
          <p className="text-[11px] font-semibold text-slate-400">단일 진실 공급원(SSOT) 및 로컬 디스크 격리 작동 중</p>
        </div>
      </div>
    </div>
  );
}
