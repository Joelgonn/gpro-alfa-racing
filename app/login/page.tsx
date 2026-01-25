'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleLogin = (e: any) => {
    e.preventDefault();
    setLoading(true);
    // Simulação de login - aqui entraria a validação real no futuro
    setTimeout(() => {
      router.push('/dashboard');
    }, 1000);
  };

  return (
    <main className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="bg-gray-800 p-8 rounded-lg shadow-2xl w-full max-w-md border border-gray-700">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-extrabold text-orange-500 mb-2">GPRO <span className="text-white">Alfa</span></h1>
          <p className="text-gray-400">Entre para gerenciar sua equipe</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="text-sm text-gray-400 block mb-2">Email</label>
            <input type="email" placeholder="manager@gpro.com" className="w-full p-3 bg-gray-700 rounded border border-gray-600 text-white focus:border-orange-500 outline-none" required />
          </div>
          <div>
            <label className="text-sm text-gray-400 block mb-2">Senha</label>
            <input type="password" placeholder="••••••••" className="w-full p-3 bg-gray-700 rounded border border-gray-600 text-white focus:border-orange-500 outline-none" required />
          </div>
          <button 
            type="submit" 
            disabled={loading}
            className="w-full py-3 bg-orange-600 hover:bg-orange-500 text-white font-bold rounded transition-all disabled:opacity-50">
            {loading ? 'Entrando...' : 'ACESSAR SISTEMA'}
          </button>
        </form>
      </div>
    </main>
  );
}