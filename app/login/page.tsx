'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Link from 'next/link'; // Importe Link para navegar de volta à landing page

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    // Simulação de login - aqui entraria a validação real no futuro
    setTimeout(() => {
      // Idealmente, após um login bem-sucedido, você redirecionaria para o dashboard
      router.push('/dashboard');
      setLoading(false); // Resetar loading em caso de falha ou após redirecionamento
    }, 1500); // Aumentei um pouco para simular melhor
  };

  return (
    // Fundo com o mesmo gradiente da LandingPage
    <main className="min-h-screen bg-gradient-to-br from-gray-950 to-blue-950 flex items-center justify-center p-4 font-sans antialiased">
      <div className="bg-gray-900/80 backdrop-blur-md p-8 rounded-lg shadow-2xl w-full max-w-md border border-gray-700 animate-fade-in-up">
        {/* Adiciona um botão de "Voltar" ou link para a LandingPage */}
        <div className="absolute top-4 left-4">
          <Link href="/" className="text-gray-400 hover:text-yellow-400 transition-colors duration-300 flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            Voltar
          </Link>
        </div>

        <div className="text-center mb-8">
          {/* Logo/Título estilizado como na LandingPage */}
          <h1 className="text-4xl md:text-5xl font-extrabold text-white leading-tight mb-2">
            ALFA RACING <span className="text-yellow-500">BRASIL</span>
          </h1>
          <p className="text-gray-300 text-lg">Área do Gerente</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label htmlFor="email" className="text-sm text-gray-300 block mb-2 font-medium">Email</label>
            <input
              type="email"
              id="email"
              placeholder="seuemail@gpro.com" // Exemplo mais realista para um usuário
              className="w-full p-3 bg-gray-700 rounded-md border border-gray-600 text-white focus:ring-2 focus:ring-yellow-500 outline-none transition-colors"
              required
            />
          </div>
          <div>
            <label htmlFor="password" className="text-sm text-gray-300 block mb-2 font-medium">Senha</label>
            <input
              type="password"
              id="password"
              placeholder="••••••••"
              className="w-full p-3 bg-gray-700 rounded-md border border-gray-600 text-white focus:ring-2 focus:ring-yellow-500 outline-none transition-colors"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-yellow-500 hover:bg-yellow-400 text-gray-900 text-lg font-semibold rounded-full shadow-lg transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          >
            {loading ? (
              <>
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-gray-900" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Entrando...
              </>
            ) : (
              'ACESSAR SISTEMA'
            )}
          </button>
        </form>

        <div className="mt-8 text-center text-gray-400">
          <a href="#" className="hover:text-yellow-400 transition-colors duration-300 text-sm">Esqueceu sua senha?</a>
          {/* Opcional: link para registro, se houver */}
          {/* <p className="mt-2 text-sm">
            Não tem uma conta?{' '}
            <a href="#" className="text-yellow-500 hover:text-yellow-400 font-medium">Registre-se</a>
          </p> */}
        </div>
      </div>
    </main>
  );
}