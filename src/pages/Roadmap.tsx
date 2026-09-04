import React, { useState, useEffect } from 'react';
import { Rocket, Target, TrendingUp, Zap, Crown, ChevronRight, Check } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface RoadmapProps {
  onNavigate: (page: string, params?: any) => void;
}

const PHASES = [
  {
    year: 2026,
    name: 'Launch & Validate',
    icon: Rocket,
    color: '#3b82f6',
    gradient: 'from-blue-500 to-blue-600',
    vessels: { conservative: 10, optimistic: 18 },
    arr: { conservative: 15000, optimistic: 28000 },
    milestones: [
      'First 5 paying customers',
      'Product-market fit validation',
      'Fleet manager tier launched',
      'Onboarding under 24 hours',
    ],
  },
  {
    year: 2027,
    name: 'Growth Engine',
    icon: TrendingUp,
    color: '#8b5cf6',
    gradient: 'from-violet-500 to-purple-600',
    vessels: { conservative: 40, optimistic: 70 },
    arr: { conservative: 80000, optimistic: 150000 },
    milestones: [
      'Mediterranean expansion',
      'Captain referral program',
      'API integrations launched',
      'First enterprise fleet (10+ vessels)',
    ],
  },
  {
    year: 2028,
    name: 'Scale',
    icon: Zap,
    color: '#f59e0b',
    gradient: 'from-amber-500 to-orange-500',
    vessels: { conservative: 120, optimistic: 200 },
    arr: { conservative: 300000, optimistic: 520000 },
    milestones: [
      'US + Caribbean markets',
      'Marketplace for marine services',
      'AI-powered maintenance predictions',
      'Mobile app launch',
    ],
  },
  {
    year: 2029,
    name: 'Dominate',
    icon: Target,
    color: '#10b981',
    gradient: 'from-emerald-500 to-teal-500',
    vessels: { conservative: 300, optimistic: 500 },
    arr: { conservative: 800000, optimistic: 1400000 },
    milestones: [
      'Industry standard for yacht ops',
      'Charter management module',
      'Insurance partnerships',
      'Series A funding',
    ],
  },
  {
    year: 2030,
    name: 'Empire',
    icon: Crown,
    color: '#ec4899',
    gradient: 'from-pink-500 to-rose-500',
    vessels: { conservative: 500, optimistic: 1000 },
    arr: { conservative: 1500000, optimistic: 3000000 },
    milestones: [
      'Global presence — 15+ countries',
      'Full ecosystem: ops + finance + compliance',
      'Strategic acquisition targets',
      '$3M+ ARR (optimistic)',
    ],
  },
];

const QUOTES = [
  "Get it fucking done.",
  "Ships don't sink because of the water around them. They sink because of the water that gets in them.",
  "The best time to start was yesterday. The next best time is now.",
  "You're not building a product. You're building an empire.",
  "Every whale was once a small fish.",
  "Comfort is the enemy of growth.",
  "The ocean doesn't care about your excuses.",
  "Built different. Ship different.",
];

const fmtCurrency = (v: number) =>
  v >= 1000000
    ? `$${(v / 1000000).toFixed(1)}M`
    : v >= 1000
    ? `$${(v / 1000).toFixed(0)}K`
    : `$${v}`;

export const Roadmap: React.FC<RoadmapProps> = ({ onNavigate }) => {
  const [totalVessels, setTotalVessels] = useState(0);
  const [totalCompanies, setTotalCompanies] = useState(0);
  const [viewMode, setViewMode] = useState<'conservative' | 'optimistic'>('optimistic');

  const quote = QUOTES[Math.floor(new Date().getDate() % QUOTES.length)];
  const currentYear = new Date().getFullYear();

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    const { count: vesselCount } = await supabase.from('vessels').select('id', { count: 'exact', head: true });
    const { count: companyCount } = await supabase.from('companies').select('id', { count: 'exact', head: true });
    setTotalVessels(vesselCount || 0);
    setTotalCompanies(companyCount || 0);
  };

  const projectedARR4Years = viewMode === 'optimistic' ? PHASES[4].arr.optimistic : PHASES[4].arr.conservative;

  return (
    <div className="min-h-screen -m-4 sm:-m-6 lg:-m-8">
      {/* Hero */}
      <div className="relative overflow-hidden bg-gradient-to-br from-gray-900 via-slate-900 to-gray-950 px-6 py-12 sm:px-10 sm:py-16">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, #3b82f6 0%, transparent 50%), radial-gradient(circle at 80% 20%, #8b5cf6 0%, transparent 50%), radial-gradient(circle at 60% 80%, #ec4899 0%, transparent 50%)' }} />
        <div className="relative max-w-5xl mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
              <Rocket className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">Nautium Roadmap</h1>
              <p className="text-sm text-slate-400 mt-0.5">2026 — 2030 · The five-year plan</p>
            </div>
          </div>

          {/* Motivational quote */}
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl px-6 py-5 mb-8">
            <p className="text-xl sm:text-2xl font-bold text-white italic">"{quote}"</p>
            <div className="flex items-center gap-4 mt-4">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-sm text-emerald-400 font-semibold">In {4} years →</span>
              </div>
              <span className="text-2xl sm:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">
                {fmtCurrency(projectedARR4Years)} ARR
              </span>
            </div>
          </div>

          {/* Live stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-3">
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Vessels Today</p>
              <p className="text-2xl font-black text-white mt-1 tabular-nums">{totalVessels}</p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-3">
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Companies</p>
              <p className="text-2xl font-black text-white mt-1 tabular-nums">{totalCompanies}</p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-3">
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Target 2030</p>
              <p className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-rose-400 mt-1">{viewMode === 'optimistic' ? '1,000' : '500'}</p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-3">
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Progress</p>
              <p className="text-2xl font-black text-white mt-1 tabular-nums">{totalVessels > 0 ? ((totalVessels / (viewMode === 'optimistic' ? 1000 : 500)) * 100).toFixed(1) : '0'}%</p>
            </div>
          </div>
        </div>
      </div>

      {/* Toggle */}
      <div className="max-w-5xl mx-auto px-6 sm:px-10 py-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">Growth Phases</h2>
          <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
            <button onClick={() => setViewMode('conservative')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${viewMode === 'conservative' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>
              Conservative
            </button>
            <button onClick={() => setViewMode('optimistic')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${viewMode === 'optimistic' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>
              Optimistic
            </button>
          </div>
        </div>
      </div>

      {/* Phases */}
      <div className="max-w-5xl mx-auto px-6 sm:px-10 pb-12 space-y-4">
        {PHASES.map((phase, idx) => {
          const Icon = phase.icon;
          const isCurrentYear = phase.year === currentYear;
          const isPast = phase.year < currentYear;
          const vessels = viewMode === 'optimistic' ? phase.vessels.optimistic : phase.vessels.conservative;
          const arr = viewMode === 'optimistic' ? phase.arr.optimistic : phase.arr.conservative;
          const prevArr = idx > 0 ? (viewMode === 'optimistic' ? PHASES[idx - 1].arr.optimistic : PHASES[idx - 1].arr.conservative) : 0;
          const growth = prevArr > 0 ? Math.round(((arr - prevArr) / prevArr) * 100) : 0;

          return (
            <div key={phase.year} className={`bg-white rounded-2xl border ${isCurrentYear ? 'border-blue-300 ring-2 ring-blue-100' : 'border-gray-200'} overflow-hidden transition-all`}>
              <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-5 sm:p-6">
                {/* Phase icon */}
                <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${phase.gradient} flex items-center justify-center shrink-0 shadow-lg`} style={{ boxShadow: `0 8px 24px ${phase.color}25` }}>
                  <Icon className="w-7 h-7 text-white" />
                </div>

                {/* Phase info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="text-lg font-black text-gray-900">{phase.year}</h3>
                    <span className="text-sm font-bold" style={{ color: phase.color }}>{phase.name}</span>
                    {isCurrentYear && <span className="text-[10px] font-black uppercase tracking-widest bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Now</span>}
                    {isPast && <span className="text-[10px] font-black uppercase tracking-widest bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full flex items-center gap-1"><Check className="w-3 h-3" />Done</span>}
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {phase.milestones.map((m, i) => (
                      <span key={i} className="text-[11px] font-medium text-gray-500 bg-gray-100 px-2.5 py-1 rounded-lg">{m}</span>
                    ))}
                  </div>
                </div>

                {/* KPIs */}
                <div className="flex gap-4 sm:gap-6 shrink-0">
                  <div className="text-center">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Vessels</p>
                    <p className="text-xl font-black text-gray-900 tabular-nums mt-0.5">{vessels}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">ARR</p>
                    <p className="text-xl font-black tabular-nums mt-0.5" style={{ color: phase.color }}>{fmtCurrency(arr)}</p>
                  </div>
                  {growth > 0 && (
                    <div className="text-center">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Growth</p>
                      <p className="text-xl font-black text-emerald-500 tabular-nums mt-0.5">+{growth}%</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Progress bar for current year */}
              {isCurrentYear && (
                <div className="px-6 pb-5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-gray-500">Year progress</span>
                    <span className="text-xs font-bold text-blue-600 tabular-nums">{Math.round(((new Date().getMonth()) / 12) * 100)}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                    <div className={`h-full rounded-full bg-gradient-to-r ${phase.gradient}`} style={{ width: `${((new Date().getMonth()) / 12) * 100}%` }} />
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* Bottom motivational */}
        <div className="bg-gradient-to-r from-gray-900 via-slate-900 to-gray-900 rounded-2xl p-6 sm:p-8 text-center">
          <p className="text-3xl sm:text-4xl font-black text-white mb-2">
            {fmtCurrency(projectedARR4Years)}
          </p>
          <p className="text-sm text-slate-400 mb-4">projected ARR by 2030 ({viewMode})</p>
          <p className="text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-violet-400 to-pink-400">
            Every vessel you onboard gets you closer. Keep building.
          </p>
        </div>
      </div>
    </div>
  );
};
