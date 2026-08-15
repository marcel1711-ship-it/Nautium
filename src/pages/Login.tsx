import React, { useState } from 'react';
import { Anchor, Lock, Mail, Home } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';

interface LoginProps {
  onLogin: () => void;
  onBack?: () => void;
}

export const Login: React.FC<LoginProps> = ({ onLogin, onBack }) => {
  const { login } = useAuth();
  const { t, language, setLanguage } = useLanguage();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const success = await login(email, password);
      if (success) {
        onLogin();
      } else {
        setError(t('login.invalidCredentials'));
      }
    } catch (err) {
      setError(t('login.error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#05111e] flex items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute -top-40 -left-40 w-[700px] h-[700px] rounded-full bg-[radial-gradient(circle,rgba(14,116,144,0.07),transparent_70%)]" />
      <div className="absolute top-1/2 -right-60 w-[600px] h-[600px] rounded-full bg-[radial-gradient(circle,rgba(2,132,199,0.05),transparent_70%)]" />
      <div className="absolute bottom-0 left-1/3 w-[500px] h-[500px] rounded-full bg-[radial-gradient(circle,rgba(14,116,144,0.04),transparent_70%)]" />

      <div className="absolute top-6 right-6 z-20 flex items-center gap-3">
        <button
          onClick={() => setLanguage(language === 'en' ? 'es' : 'en')}
          className="flex items-center gap-1.5 px-3 py-2 bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.10] hover:border-white/[0.20] text-slate-300 hover:text-white rounded-xl text-sm font-medium backdrop-blur-sm transition-all duration-200"
          title={language === 'en' ? 'Cambiar a Español' : 'Switch to English'}
        >
          <span className="text-base leading-none">{language === 'en' ? '🇪🇸' : '🇬🇧'}</span>
          <span className="text-xs font-semibold tracking-wide">{language === 'en' ? 'ES' : 'EN'}</span>
        </button>
        {onBack && (
          <button
            onClick={onBack}
            className="flex items-center gap-2 px-4 py-2 bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.10] hover:border-white/[0.20] text-slate-300 hover:text-white rounded-xl text-sm font-medium backdrop-blur-sm transition-all duration-200 shadow-lg group"
          >
            <Home className="w-4 h-4 group-hover:scale-110 transition-transform duration-200" />
            <span>{language === 'en' ? 'Back to home' : 'Volver al inicio'}</span>
          </button>
        )}
      </div>

      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-sky-400 to-cyan-600 rounded-3xl mb-4 shadow-lg shadow-cyan-500/30">
            <Anchor className="w-8 h-8 text-white" strokeWidth={2.5} />
          </div>
          <h1 className="text-3xl font-bold text-white">
            Nau<span className="text-cyan-400">tium</span>
          </h1>
          <p className="text-slate-400 mt-2">{t('login.subtitle')}</p>
        </div>

        <div className="bg-white/[0.04] backdrop-blur-xl rounded-3xl shadow-2xl p-8 border border-white/[0.07]">
          <h2 className="text-2xl font-bold text-white mb-6">{t('login.welcome')}</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                {t('login.email')}
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-white/[0.05] border border-white/[0.10] rounded-xl focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all text-white placeholder-slate-500 outline-none"
                  placeholder={t('login.emailPlaceholder')}
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                {t('login.password')}
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-white/[0.05] border border-white/[0.10] rounded-xl focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all text-white placeholder-slate-500 outline-none"
                  placeholder={t('login.passwordPlaceholder')}
                  required
                />
              </div>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-400/30 rounded-xl p-3">
                <p className="text-sm text-red-300">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-sky-500 to-cyan-500 text-white py-3 rounded-xl font-medium hover:from-sky-400 hover:to-cyan-400 transition-all shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/30 disabled:opacity-50"
            >
              {loading ? t('login.signingIn') : t('login.signIn')}
            </button>
          </form>
        </div>

      </div>
    </div>
  );
};
