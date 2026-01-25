'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { GameProvider } from '../context/GameContext'; 

// Componentes de Ícones SVG (Para substituir os emojis e dar ar profissional)
const Icons = {
  Chart: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" /></svg>,
  Car: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.126-.504 1.126-1.125V14.25m-17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.125-.504 1.125-1.125V14.25m-17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.125-.504 1.125-1.125V14.25m-6 0h1.125a1.125 1.125 0 011.125 1.125v1.5a3.375 3.375 0 01-3.375 3.375H9.75" /><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5H21A7.5 7.5 0 0013.5 3v7.5z" /></svg>,
  Wrench: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z" /></svg>,
  Strategy: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" /></svg>,
  Money: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  Users: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" /></svg>,
  Logout: () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" /></svg>,
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Lista de Navegação (Mapeada para os componentes SVG acima)
  const menuItems = [
    { name: 'Visão Geral', path: '/dashboard', icon: <Icons.Chart /> },
    { name: 'Setup Calculadora', path: '/dashboard/setup', icon: <Icons.Car /> },
    { name: 'Setup Manual', path: '/dashboard/manual', icon: <Icons.Wrench /> },
    { name: 'Estratégia', path: '/dashboard/strategy', icon: <Icons.Strategy /> },
    { name: 'Patrocinadores', path: '/dashboard/sponsors', icon: <Icons.Money /> },
    { name: 'Mercado de Pilotos', path: '/dashboard/market', icon: <Icons.Users /> },
  ];

  return (
    <GameProvider>
      {/* 
        Fundo Base: Slate-950 puro. 
        Fonte: antialiased para renderização mais nítida.
      */}
      <div className="flex min-h-screen bg-[#020617] text-slate-200 font-sans antialiased selection:bg-yellow-500/30 selection:text-yellow-200">
        
        {/* === SIDEBAR (MENU LATERAL) === */}
        <aside className="w-72 hidden md:flex flex-col z-30 sticky top-0 h-screen border-r border-white/5 bg-slate-900/40 backdrop-blur-xl">
          
          {/* Logo / Título */}
          <div className="h-24 flex items-center px-8 border-b border-white/5 relative overflow-hidden group">
            {/* Efeito Glow no Logo */}
            <div className="absolute left-10 top-1/2 -translate-y-1/2 w-24 h-24 bg-emerald-500/10 blur-[50px] rounded-full group-hover:bg-emerald-500/20 transition-all duration-700"></div>
            
            <h1 className="relative z-10 flex flex-col">
              <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-[0.3em] ml-0.5 mb-1">Team Manager</span>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-black tracking-tighter text-white">
                  ALFA<span className="text-yellow-400">RACING</span>
                </span>
                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-white/10 text-white/50 border border-white/5">BR</span>
              </div>
            </h1>
          </div>
          
          {/* Links de Navegação */}
          <nav className="flex-1 px-4 py-8 space-y-1 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-800">
            <p className="px-4 mb-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest opacity-80">
              Console de Equipe
            </p>

            {menuItems.map((item) => {
              const isActive = pathname === item.path;
              return (
                <Link 
                  key={item.path} 
                  href={item.path}
                  className={`
                    relative flex items-center gap-3.5 px-4 py-3.5 rounded-xl text-sm font-medium transition-all duration-300 group overflow-hidden
                    ${isActive 
                      ? 'text-white shadow-[0_0_20px_-5px_rgba(234,179,8,0.15)]' 
                      : 'text-slate-400 hover:text-white hover:bg-white/[0.03]'
                    }
                  `}
                >
                  {/* Fundo Ativo (Glassmorphism sutil) */}
                  {isActive && (
                    <div className="absolute inset-0 bg-gradient-to-r from-yellow-500/10 to-transparent border border-white/5 rounded-xl pointer-events-none" />
                  )}
                  
                  {/* Indicador lateral ativo */}
                  {isActive && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-yellow-400 rounded-r-full shadow-[0_0_10px_rgba(250,204,21,0.5)]" />
                  )}

                  <span className={`relative z-10 transition-transform duration-300 ${isActive ? 'text-yellow-400 scale-110' : 'text-slate-500 group-hover:text-emerald-400'}`}>
                    {item.icon}
                  </span>
                  <span className="relative z-10 tracking-wide">{item.name}</span>
                  
                  {/* Ícone de seta sutil no hover */}
                  {!isActive && (
                    <span className="absolute right-4 text-slate-700 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300">
                      →
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Rodapé do Menu (User Profile) */}
          <div className="p-4 border-t border-white/5 bg-black/20 backdrop-blur-sm">
             <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/5 hover:border-white/10 transition-colors group">
               <div className="flex items-center gap-3">
                  {/* Avatar com status indicator */}
                  <div className="relative">
                    <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-slate-700 to-slate-900 border border-white/10 flex items-center justify-center text-xs font-bold text-white shadow-inner">
                      M
                    </div>
                    <span className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 border-2 border-slate-900 rounded-full animate-pulse"></span>
                  </div>
                  
                  <div className="flex flex-col">
                      <span className="text-xs font-bold text-white group-hover:text-yellow-400 transition-colors">Team Principal</span>
                      <span className="text-[10px] text-slate-500">ID: #8842</span>
                  </div>
               </div>

                <Link 
                  href="/login" 
                  className="p-2 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
                  title="Sair"
                >
                  <Icons.Logout />
                </Link>
             </div>
          </div>
        </aside>

        {/* === ÁREA DE CONTEÚDO PRINCIPAL === */}
        <div className="flex-1 flex flex-col min-h-screen relative">
          
          {/* Background Decorativo (Ambiente) */}
          <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
             {/* Gradient Spotlights - Mais suaves e dispersos */}
             <div className="absolute top-[-20%] left-[10%] w-[800px] h-[800px] bg-emerald-900/10 blur-[120px] rounded-full mix-blend-screen"></div>
             <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-yellow-900/5 blur-[100px] rounded-full mix-blend-screen"></div>
             {/* Noise texture overlay (opcional, dá textura premium) */}
             <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] brightness-100 contrast-150"></div>
          </div>

          {/* Header Mobile (Minimalista) */}
          <header className="md:hidden bg-slate-950/80 backdrop-blur-md p-4 border-b border-white/5 flex justify-between items-center sticky top-0 z-50">
              <span className="font-bold text-white tracking-tight flex gap-1">
                ALFA <span className="text-yellow-400">RACING</span>
              </span>
              <Link 
                href="/dashboard" 
                className="text-[10px] font-bold bg-white/5 text-white px-3 py-1.5 rounded-full border border-white/10 hover:bg-white/10 transition-colors"
              >
                MENU
              </Link>
          </header>

          {/* Main Content */}
          <main className="flex-1 overflow-auto p-6 md:p-10 relative z-10 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
             <div className="mx-auto max-w-7xl w-full animate-in fade-in slide-in-from-bottom-4 duration-700">
                {children}
             </div>
          </main>
        </div>
        
      </div>
    </GameProvider>
  );
}