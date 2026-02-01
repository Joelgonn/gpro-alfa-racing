'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { FaUserAstronaut, FaLock, FaTicketAlt, FaSignInAlt, FaArrowLeft } from 'react-icons/fa';

// --- CORREÇÃO DAS IMPORTAÇÕES ---
// Como 'lib' está dentro de 'app', usamos '../' para voltar de 'login' para 'app'
import { supabase } from '../lib/supabase'; 

// Importa a Server Action para criar conta (Certifique-se que o arquivo existe em app/actions/signup.ts)
import { signUpWithInviteCode } from '../actions/signup'; 

export default function LoginPage() {
  const router = useRouter();
  const [isLoginMode, setIsLoginMode] = useState(true); // Alterna entre Login e Cadastro
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  // Estados dos inputs
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');

  // --- LÓGICA DE LOGIN (CLIENT-SIDE) ---
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    // Tenta fazer login direto com o Supabase
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setMessage('Erro: ' + error.message);
      setLoading(false);
    } else {
      // Login com sucesso
      router.push('/dashboard'); 
      router.refresh();
    }
  };

  // --- LÓGICA DE CADASTRO (SERVER-SIDE ACTION) ---
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
      // Chama a Server Action (Backend)
      const result = await signUpWithInviteCode(formData);

      if (result.success) {
        // Se criou a conta, tenta logar automaticamente
        const { error: loginError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        
        if (!loginError) {
          router.push('/dashboard');
        } else {
          setMessage('Conta criada! Faça login manualmente.');
          setIsLoginMode(true);
        }
      } else {
        setMessage(result.message || 'Erro ao criar conta.');
      }
    } catch (error) {
      setMessage('Erro de conexão ao tentar cadastrar.');
    }
    
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 to-blue-950 flex items-center justify-center p-4 font-sans text-white">
      <div className="bg-gray-900/80 backdrop-blur-md p-8 rounded-2xl shadow-2xl w-full max-w-md border border-white/10 animate-fade-in-down">
        
        {/* Cabeçalho */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-extrabold text-white">
            ALFA RACING <span className="text-yellow-500">BRASIL</span>
          </h1>
          <p className="text-gray-400 text-sm mt-2 font-mono">
            {isLoginMode ? 'Acesso ao Paddock' : 'Credenciamento VIP'}
          </p>
        </div>

        {/* Abas de Navegação (Login vs Cadastro) */}
        <div className="flex mb-6 bg-black/40 rounded-lg p-1 border border-white/5">
          <button
            onClick={() => { setIsLoginMode(true); setMessage(''); }}
            className={`flex-1 py-2 rounded-md text-xs font-black uppercase tracking-wider transition-all ${
              isLoginMode 
                ? 'bg-indigo-600 text-white shadow-lg' 
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            Login
          </button>
          <button
            onClick={() => { setIsLoginMode(false); setMessage(''); }}
            className={`flex-1 py-2 rounded-md text-xs font-black uppercase tracking-wider transition-all ${
              !isLoginMode 
                ? 'bg-yellow-500 text-black shadow-lg' 
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            Cadastro VIP
          </button>
        </div>

        {/* Mensagens de Erro/Sucesso */}
        {message && (
          <div className={`mb-4 p-3 rounded text-xs font-bold text-center border ${
            message.toLowerCase().includes('sucesso') || message.includes('criada')
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
              : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
          }`}>
            {message}
          </div>
        )}

        {/* Formulário */}
        <form onSubmit={isLoginMode ? handleLogin : handleSignUp} className="space-y-5">
          
          <div className="space-y-1">
            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">E-mail</label>
            <div className="relative group">
              <FaUserAstronaut className="absolute left-3 top-3 text-gray-500 group-focus-within:text-indigo-400 transition-colors" />
              <input
                type="email"
                required
                className="w-full bg-black/40 border border-white/10 rounded-lg py-2.5 pl-10 pr-4 text-sm focus:border-indigo-500 focus:bg-white/5 outline-none transition-all placeholder-gray-600"
                placeholder="piloto@alfaracing.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Senha</label>
            <div className="relative group">
              <FaLock className="absolute left-3 top-3 text-gray-500 group-focus-within:text-indigo-400 transition-colors" />
              <input
                type="password"
                required
                className="w-full bg-black/40 border border-white/10 rounded-lg py-2.5 pl-10 pr-4 text-sm focus:border-indigo-500 focus:bg-white/5 outline-none transition-all placeholder-gray-600"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          {!isLoginMode && (
            <div className="space-y-1 animate-fade-in-up">
              <label className="text-[10px] font-black text-yellow-500 uppercase tracking-widest ml-1 flex items-center gap-1">
                <FaTicketAlt /> Código de Convite
              </label>
              <input
                type="text"
                required={!isLoginMode}
                className="w-full bg-yellow-500/5 border border-yellow-500/30 rounded-lg py-2.5 px-4 text-sm text-yellow-200 focus:border-yellow-500 focus:bg-yellow-500/10 outline-none transition-all uppercase placeholder-yellow-700/50 font-mono tracking-wider"
                placeholder="EX: ALFA-VIP-2024"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
              />
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className={`w-full py-3 rounded-lg font-black text-xs uppercase tracking-[0.15em] shadow-lg flex items-center justify-center gap-2 transition-all transform active:scale-95 hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed mt-4 ${
              isLoginMode 
                ? 'bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white' 
                : 'bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-400 hover:to-amber-400 text-black'
            }`}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                Processando...
              </span>
            ) : (
              <>
                {isLoginMode ? 'Entrar no Sistema' : 'Validar & Cadastrar'} 
                <FaSignInAlt />
              </>
            )}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-white/5 text-center">
          <button 
            onClick={() => router.push('/')}
            className="text-xs font-bold text-gray-500 hover:text-white transition-colors flex items-center justify-center gap-2 mx-auto group"
          >
            <FaArrowLeft className="group-hover:-translate-x-1 transition-transform" />
            Voltar para Página Inicial
          </button>
        </div>
      </div>
    </div>
  );
}