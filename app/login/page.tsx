'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { FaUserAstronaut, FaLock, FaTicketAlt, FaSignInAlt, FaArrowLeft } from 'react-icons/fa';

// Mantendo suas importações originais
import { supabase } from '../lib/supabase'; 
import { signUpWithInviteCode } from '../actions/signup'; 

export default function LoginPage() {
  const router = useRouter();
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  // Estados dos inputs
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');

  // --- LÓGICA DE LOGIN ---
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setMessage('Erro: ' + error.message);
        setLoading(false);
      } else {
        // Redirecionamento alterado para a nova página inicial
        router.push('/dashboard/manager'); 
        router.refresh();
      }
    } catch (err) {
      setMessage('Ocorreu um erro inesperado ao tentar fazer login.');
      setLoading(false);
    }
  };

  // --- LÓGICA DE CADASTRO ---
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    if (!inviteCode) {
      setMessage('O código de convite é obrigatório.');
      setLoading(false);
      return;
    }

    const formData = new FormData();
    formData.append('email', email);
    formData.append('password', password);
    formData.append('inviteCode', inviteCode);

    try {
      const result = await signUpWithInviteCode(formData);

      if (result.success) {
        const { error: loginError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        
        if (!loginError) {
          // Redirecionamento alterado para a nova página inicial após cadastro
          router.push('/dashboard/manager');
        } else {
          setMessage('Conta criada! Faça login manualmente.');
          setIsLoginMode(true);
        }
      } else {
        setMessage(result.message || 'Erro ao criar conta.');
      }
    } catch (error) {
      setMessage('Erro de conexão ao tentar cadastrar.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-gray-950 via-gray-900 to-blue-950 flex flex-col items-center justify-center p-4 sm:p-6 font-sans text-white overflow-y-auto">
      
      <div className="w-full max-w-md animate-fade-in-down">
        
        {/* Card Principal */}
        <div className="bg-gray-900/60 backdrop-blur-xl p-6 sm:p-8 rounded-2xl shadow-2xl border border-white/10 relative overflow-hidden">
          
          {/* Efeito de brilho no topo do card */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-1 bg-gradient-to-r from-transparent via-yellow-500/50 to-transparent"></div>

          {/* Cabeçalho */}
          <header className="text-center mb-8">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              ALFA RACING <span className="text-yellow-500">BRASIL</span>
            </h1>
            <p className="text-gray-400 text-xs sm:text-sm mt-2 font-mono uppercase tracking-widest">
              {isLoginMode ? 'Terminal de Acesso' : 'Credenciamento VIP'}
            </p>
          </header>

          {/* Abas de Navegação (Login / Cadastro) */}
          <nav className="flex mb-8 bg-black/30 rounded-lg p-1 border border-white/5">
            <button
              type="button"
              onClick={() => { setIsLoginMode(true); setMessage(''); }}
              className={`flex-1 py-2.5 rounded-md text-xs font-bold uppercase tracking-wider transition-all duration-300 ${
                isLoginMode 
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' 
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              Login
            </button>
            <button
              type="button"
              onClick={() => { setIsLoginMode(false); setMessage(''); }}
              className={`flex-1 py-2.5 rounded-md text-xs font-bold uppercase tracking-wider transition-all duration-300 ${
                !isLoginMode 
                  ? 'bg-yellow-500 text-gray-900 shadow-lg shadow-yellow-500/20' 
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              Cadastro
            </button>
          </nav>

          {/* Mensagens de Feedback */}
          {message && (
            <div 
              role="alert" 
              className={`mb-6 p-3 rounded-lg text-xs sm:text-sm font-medium text-center border animate-pulse ${
                message.toLowerCase().includes('sucesso') || message.includes('criada')
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                  : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
              }`}
            >
              {message}
            </div>
          )}

          {/* Formulário */}
          <form onSubmit={isLoginMode ? handleLogin : handleSignUp} className="space-y-5">
            
            {/* Campo E-mail */}
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">
                E-mail
              </label>
              <div className="relative group">
                <FaUserAstronaut className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-indigo-400 transition-colors text-lg" />
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  className="w-full bg-black/40 border border-white/10 rounded-xl h-12 pl-12 pr-4 text-base text-white focus:border-indigo-500 focus:bg-white/5 focus:ring-1 focus:ring-indigo-500 outline-none transition-all placeholder-gray-600"
                  placeholder="piloto@alfaracing.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            {/* Campo Senha */}
            <div className="space-y-1.5">
              <label htmlFor="password" className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">
                Senha
              </label>
              <div className="relative group">
                <FaLock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-indigo-400 transition-colors text-lg" />
                <input
                  id="password"
                  type="password"
                  required
                  autoComplete={isLoginMode ? "current-password" : "new-password"}
                  className="w-full bg-black/40 border border-white/10 rounded-xl h-12 pl-12 pr-4 text-base text-white focus:border-indigo-500 focus:bg-white/5 focus:ring-1 focus:ring-indigo-500 outline-none transition-all placeholder-gray-600"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            {/* Campo Código de Convite (Condicional) */}
            {!isLoginMode && (
              <div className="space-y-1.5 animate-fade-in-up">
                <label htmlFor="inviteCode" className="text-xs font-bold text-yellow-500 uppercase tracking-wider ml-1 flex items-center gap-1.5">
                  <FaTicketAlt /> Código VIP
                </label>
                <input
                  id="inviteCode"
                  type="text"
                  required={!isLoginMode}
                  className="w-full bg-yellow-900/10 border border-yellow-500/30 rounded-xl h-12 px-4 text-base text-yellow-100 focus:border-yellow-500 focus:bg-yellow-900/20 focus:ring-1 focus:ring-yellow-500 outline-none transition-all uppercase placeholder-yellow-700/40 font-mono tracking-wider text-center"
                  placeholder="ALFA-VIP-XXXX"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                />
              </div>
            )}

            {/* Botão de Ação */}
            <button
              type="submit"
              disabled={loading}
              className={`w-full h-12 mt-6 rounded-xl font-bold text-sm uppercase tracking-widest shadow-lg flex items-center justify-center gap-3 transition-all transform active:scale-[0.98] hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed ${
                isLoginMode 
                  ? 'bg-indigo-600 hover:bg-indigo-500 text-white' 
                  : 'bg-yellow-500 hover:bg-yellow-400 text-gray-900'
              }`}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" aria-hidden="true" />
                  Processando
                </span>
              ) : (
                <>
                  {isLoginMode ? 'Acessar Paddock' : 'Validar Credencial'} 
                  <FaSignInAlt className="text-lg" aria-hidden="true" />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Botão Voltar para Página Inicial */}
        <div className="mt-8 text-center">
          <button 
            onClick={() => router.push('/')}
            className="text-xs font-bold text-gray-500 hover:text-white transition-colors flex items-center justify-center gap-2 mx-auto group py-2 px-4"
          >
            <FaArrowLeft className="group-hover:-translate-x-1 transition-transform" aria-hidden="true" />
            Voltar para Página Inicial
          </button>
        </div>

      </div>
    </div>
  );
}