'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import { GameProvider, useGame } from '../context/GameContext';
import { supabase } from '../lib/supabase';
import AdminInviteButton from '../components/AdminInviteButton';

// --- ÍCONES SVG PERSONALIZADOS ---
const Icons = {
  Chart: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" /></svg>,
  Car: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.126-.504 1.126-1.125V14.25m-17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.125-.504 1.125-1.125V14.25m-17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.125-.504 1.125-1.125V14.25m-6 0h1.125a1.125 1.125 0 011.125 1.125v1.5a3.375 3.375 0 01-3.375 3.375H9.75" /><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5H21A7.5 7.5 0 0013.5 3v7.5z" /></svg>,
  Wrench: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z" /></svg>,
  Strategy: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" /></svg>,
  Money: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  Users: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" /></svg>,
  Logout: () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" /></svg>,
  Beaker: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c.252 0 .487.02.718.057l.25.029c.26.03.515.07.764.124m5.24 7.812a2.25 2.25 0 00-.659-1.591l-4.091-4.091a2.25 2.25 0 01-.659-1.591V3.104m3.668 12.392V3.104c0-.261.023-.515.068-.764l.048-.276c.045-.252.098-.497.16-.732M9.75 15.75l-3.32-3.32a1.405 1.405 0 00-2.022.288 1.405 1.405 0 00.288 2.022l3.32 3.32M9.75 15.75V18m0 0l3.32-3.32a1.405 1.405 0 012.022.288 1.405 1.405 0 01-.288 2.022l-3.32 3.32m0 0V21m-3.32-5.25a1.405 1.405 0 00-2.022-.288 1.405 1.405 0 00.288 2.022l3.32-3.32" /></svg>,
  Calendar: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" /></svg>,
  Wear: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>, // Ícone de Alerta/Gauge
};

// --- ESTRUTURA DOS MENUS POR PRIORIDADE ---
// CORREÇÃO: Renderizar os componentes (<Icons.Nome />) aqui dentro, e não apenas passar a função.
const menuGroups = [
  {
    id: 'race_control',
    title: 'Controle de Corrida',
    color: 'text-amber-400',
    bgHover: 'hover:bg-amber-500/10',
    bgActive: 'bg-amber-500/10',
    borderActive: 'border-amber-500/20',
    items: [
      { name: 'Visão Geral', path: '/dashboard', icon: <Icons.Chart /> },
      { name: 'Setup Calculadora', path: '/dashboard/setup', icon: <Icons.Car /> },
      { name: 'Estratégia', path: '/dashboard/strategy', icon: <Icons.Strategy /> },
    ]
  },
  {
    id: 'engineering',
    title: 'Engenharia',
    color: 'text-emerald-400',
    bgHover: 'hover:bg-emerald-500/10',
    bgActive: 'bg-emerald-500/10',
    borderActive: 'border-emerald-500/20',
    items: [
      { name: 'Setup Manual', path: '/dashboard/manual', icon: <Icons.Wrench /> },
      { name: 'Testes', path: '/dashboard/tests', icon: <Icons.Beaker /> },
      { name: 'Desgastes', path: '/dashboard/wear', icon: <Icons.Wear /> },
    ]
  },
  {
    id: 'management',
    title: 'Gerenciamento',
    color: 'text-indigo-400',
    bgHover: 'hover:bg-indigo-500/10',
    bgActive: 'bg-indigo-500/10',
    borderActive: 'border-indigo-500/20',
    items: [
      { name: 'Patrocinadores', path: '/dashboard/sponsors', icon: <Icons.Money /> },
      { name: 'Mercado de Pilotos', path: '/dashboard/market', icon: <Icons.Users /> },
      { name: 'Calendário', path: '/dashboard/calendar', icon: <Icons.Calendar /> },
    ]
  }
];

// --- SIDEBAR COMPONENT ---
function SidebarContent({ isOpen, onClose }: { isOpen: boolean; onClose: () => void; }) {
  const pathname = usePathname();
  const { role, updateRole } = useGame();
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const sidebarRef = useRef<HTMLElement>(null);

  useEffect(() => {
    async function fetchUserData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserEmail(user.email || null);
        const { data: userState } = await supabase.from('user_state').select('role').eq('user_id', user.id).single();
        if (userState && (userState.role === 'admin' || userState.role === 'user')) {
          updateRole(userState.role);
        }
      }
    }
    fetchUserData();
  }, [updateRole]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isOpen && sidebarRef.current && !sidebarRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  const sidebarClasses = `
    fixed inset-y-0 left-0 z-50 flex flex-col w-72 
    bg-[#050505]/95 backdrop-blur-2xl border-r border-white/5
    transition-transform duration-500 cubic-bezier(0.16, 1, 0.3, 1)
    ${isOpen ? 'translate-x-0 shadow-2xl shadow-black' : '-translate-x-full'}
    md:sticky md:translate-x-0 md:bg-transparent md:border-r md:border-white/5
  `;

  return (
    <aside ref={sidebarRef} className={sidebarClasses}>
      {/* Logo Area */}
      <div className="h-28 flex flex-col justify-center px-8 border-b border-white/5 relative overflow-hidden group shrink-0">
        <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 blur-[60px] rounded-full"></div>
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-emerald-500/5 blur-[40px] rounded-full"></div>
        
        <div className="relative z-10">
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] mb-1 block">Team</span>
          <div className="flex items-center gap-2">
             <div className="w-1 h-8 bg-amber-400 rounded-full shadow-[0_0_10px_rgba(251,191,36,0.5)]"></div>
             <div>
                <h1 className="text-2xl font-black italic tracking-tighter text-white leading-none">
                  ALFA <span className="text-amber-400">RACING</span>
                </h1>
                <span className="text-[9px] font-bold text-emerald-500 uppercase tracking-widest bg-emerald-950/30 px-1.5 py-0.5 rounded border border-emerald-500/20">Brasil - Lair of Wolves</span>
             </div>
          </div>
        </div>
      </div>
      
      {/* Navigation */}
      <nav className="flex-1 px-4 py-6 space-y-8 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
        {menuGroups.map((group) => (
          <div key={group.id} className="space-y-1">
            <h3 className="px-4 text-[10px] font-black text-slate-600 uppercase tracking-[0.2em] mb-2">{group.title}</h3>
            {group.items.map((item) => {
              const isActive = pathname === item.path;
              return (
                <Link 
                  key={item.path} 
                  href={item.path} 
                  onClick={onClose} 
                  className={`
                    relative flex items-center gap-3.5 px-4 py-3 rounded-lg text-xs font-bold uppercase tracking-wide transition-all duration-300 group/item overflow-hidden
                    ${isActive 
                      ? `${group.bgActive} text-white ${group.borderActive} border shadow-[0_0_15px_-5px_rgba(0,0,0,0.5)]` 
                      : `text-slate-400 hover:text-white ${group.bgHover} border border-transparent`
                    }
                  `}
                >
                  {/* Active Indicator Line */}
                  {isActive && <div className={`absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 rounded-r-full ${group.color.replace('text-', 'bg-')} shadow-[0_0_8px_currentColor]`} />}
                  
                  {/* Icon */}
                  <span className={`relative z-10 transition-transform duration-300 ${isActive ? `${group.color} scale-110` : 'text-slate-500 group-hover/item:text-slate-300'}`}>
                    {item.icon}
                  </span>
                  
                  {/* Text */}
                  <span className="relative z-10">{item.name}</span>

                  {/* Hover Arrow */}
                  {!isActive && <span className="absolute right-3 text-slate-600 opacity-0 -translate-x-2 group-hover/item:opacity-100 group-hover/item:translate-x-0 transition-all duration-300">→</span>}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* User Profile */}
      <div className="p-4 border-t border-white/5 bg-black/40 backdrop-blur-xl shrink-0">
        <div className="mb-3">
            <AdminInviteButton userRole={role} />
        </div>
        <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-colors group">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-slate-800 to-black border border-white/10 flex items-center justify-center text-xs font-black text-amber-400 shadow-inner">
                {userEmail ? userEmail.charAt(0).toUpperCase() : '?'}
              </div>
              <span className="absolute -bottom-1 -right-1 w-3 h-3 bg-emerald-500 border-2 border-black rounded-full animate-pulse"></span>
            </div>
            <div className="flex flex-col">
              <span className="text-[11px] font-black uppercase text-white group-hover:text-amber-400 transition-colors">Team Principal</span>
              <span className="text-[10px] text-slate-500 truncate max-w-[120px] font-mono">{userEmail || 'Loading...'}</span>
            </div>
          </div>
          <Link href="/login" onClick={() => supabase.auth.signOut()} className="p-2 rounded-lg text-slate-600 hover:text-rose-400 hover:bg-rose-500/10 transition-all" title="Logout"><Icons.Logout /></Link>
        </div>
      </div>
    </aside>
  );
}

// --- LAYOUT ---
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => { setIsMobileMenuOpen(false); }, [pathname]);
  useEffect(() => { document.body.style.overflow = isMobileMenuOpen ? 'hidden' : 'auto'; }, [isMobileMenuOpen]);

  return (
    <GameProvider>
      <div className="flex min-h-screen bg-[#020617] text-slate-200 font-sans antialiased selection:bg-amber-500/30 selection:text-amber-100">
        
        {/* Mobile Backdrop */}
        <div 
          onClick={() => setIsMobileMenuOpen(false)}
          className={`fixed inset-0 bg-black/80 backdrop-blur-sm z-40 transition-opacity duration-300 md:hidden ${isMobileMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
          aria-hidden="true"
        />
        
        <SidebarContent isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} />
        
        <div className="flex-1 flex flex-col min-h-screen relative">
          {/* Background Ambient Effects */}
          <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
             <div className="absolute top-[-20%] left-[10%] w-[800px] h-[800px] bg-emerald-900/10 blur-[150px] rounded-full mix-blend-screen opacity-60"></div>
             <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-amber-900/10 blur-[150px] rounded-full mix-blend-screen opacity-60"></div>
             <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] brightness-100 contrast-150"></div>
          </div>
          
          {/* Mobile Header */}
          <header className="md:hidden bg-[#050505]/80 backdrop-blur-xl px-5 h-16 border-b border-white/5 flex justify-between items-center sticky top-0 z-30 shadow-lg shadow-black/20">
              <div className="flex items-center gap-2">
                 <div className="w-1 h-5 bg-amber-400 rounded-full shadow-[0_0_8px_rgba(251,191,36,0.5)]"></div>
                 <Link href="/dashboard" className="font-black italic text-lg text-white tracking-tighter">
                    ALFA <span className="text-amber-400">RACING</span>
                 </Link>
              </div>
              
              <button 
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} 
                className="relative z-50 h-10 w-10 flex items-center justify-center text-slate-300 hover:text-white transition-colors"
                aria-label="Menu"
              >
                <div className="space-y-1.5">
                  <span className={`block w-6 h-0.5 bg-current rounded-full transform transition-all duration-300 ${isMobileMenuOpen ? 'rotate-45 translate-y-2 bg-amber-400' : ''}`}></span>
                  <span className={`block w-4 h-0.5 bg-current rounded-full transition-all duration-300 ml-auto ${isMobileMenuOpen ? 'opacity-0' : ''}`}></span>
                  <span className={`block w-6 h-0.5 bg-current rounded-full transform transition-all duration-300 ${isMobileMenuOpen ? '-rotate-45 -translate-y-2 bg-amber-400' : ''}`}></span>
                </div>
              </button>
          </header>

          {/* Main Content */}
          <main className="flex-1 overflow-auto p-4 md:p-8 lg:p-10 relative z-10 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
             <div className="mx-auto max-w-7xl w-full animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out">
                {children}
             </div>
          </main>
        </div>
      </div>
    </GameProvider>
  );
}