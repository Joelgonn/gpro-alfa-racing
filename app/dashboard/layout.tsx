'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import { GameProvider, useGame } from '@/app/context/GameContext';
import { supabase } from '@/app/lib/supabase';
import AdminInviteButton from '@/app/components/AdminInviteButton';

// --- ÍCONES DE ALTA PRECISÃO (TELEMETRY/HUD DESIGN) ---
const Icons = {
  Chart: () => (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v18h18" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M18.75 8.25l-5.25 5.25-3-3L4.5 16.5" />
      <circle cx="18.75" cy="8.25" r="1.5" fill="currentColor" />
    </svg>
  ),
  Car: () => (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 10h16M4 14h16M2 12h20M12 2v20" />
      <circle cx="12" cy="12" r="8" />
    </svg>
  ),
  Wrench: () => (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </svg>
  ),
  Strategy: () => (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2" />
    </svg>
  ),
  Money: () => (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <line x1="2" y1="10" x2="22" y2="10" />
      <circle cx="12" cy="14.5" r="2.5" />
    </svg>
  ),
  Users: () => (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  Logout: () => (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
    </svg>
  ),
  Beaker: () => (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M4.5 3h15M6 3v16a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V3M6 14h12" />
    </svg>
  ),
  Calendar: () => (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  ),
  Wear: () => (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
    </svg>
  ),
  Settings: () => (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  ),
  Database: () => (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
      <path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3" />
    </svg>
  ),
};

// --- ESTRUTURA DOS MENUS (HUD CATEGORIZADO) ---
const menuGroups = [
  {
    id: 'race_control',
    prefix: '01',
    title: 'Race Control',
    color: 'text-amber-400',
    bgActive: 'bg-amber-500/5 border-amber-500/10 shadow-[inset_0_0_12px_rgba(245,158,11,0.05)]',
    hoverGlow: 'hover:border-amber-500/20 hover:bg-amber-500/[0.02]',
    items: [
      { name: 'Visão Geral', path: '/dashboard', icon: <Icons.Chart /> },
      { name: 'Setup Calculadora', path: '/dashboard/setup', icon: <Icons.Car /> },
      { name: 'Estratégia', path: '/dashboard/strategy', icon: <Icons.Strategy /> },
    ]
  },
  {
    id: 'engineering',
    prefix: '02',
    title: 'Engineering HUD',
    color: 'text-emerald-400',
    bgActive: 'bg-emerald-500/5 border-emerald-500/10 shadow-[inset_0_0_12px_rgba(16,185,129,0.05)]',
    hoverGlow: 'hover:border-emerald-500/20 hover:bg-emerald-500/[0.02]',
    items: [
      { name: 'Setup Manual', path: '/dashboard/manual', icon: <Icons.Wrench /> },
      { name: 'Testes', path: '/dashboard/tests', icon: <Icons.Beaker /> },
      { name: 'Planejamento', path: '/dashboard/wear', icon: <Icons.Wear /> },
    ]
  },
  {
    id: 'management',
    prefix: '03',
    title: 'Administration',
    color: 'text-indigo-400',
    bgActive: 'bg-indigo-500/5 border-indigo-500/10 shadow-[inset_0_0_12px_rgba(99,102,241,0.05)]',
    hoverGlow: 'hover:border-indigo-500/20 hover:bg-indigo-500/[0.02]',
    items: [
      { name: 'Patrocinadores', path: '/dashboard/sponsors', icon: <Icons.Money /> },
      { name: 'Mercado de Pilotos', path: '/dashboard/market', icon: <Icons.Users /> },
      { name: 'Calendário', path: '/dashboard/calendar', icon: <Icons.Calendar /> },
      { name: 'Integração GPRO', path: '/dashboard/configuracoes/integracao', icon: <Icons.Settings /> },
    ]
  },
  {
    id: 'administration',
    prefix: '04',
    title: 'Core Engine',
    color: 'text-cyan-400',
    bgActive: 'bg-cyan-500/5 border-cyan-500/10 shadow-[inset_0_0_12px_rgba(6,182,212,0.05)]',
    hoverGlow: 'hover:border-cyan-500/20 hover:bg-cyan-500/[0.02]',
    items: [
      { name: 'GPRO API Database', path: '/dashboard/admin/gpro-kb', icon: <Icons.Database /> }
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
    fixed inset-y-0 left-0 z-50 flex flex-col w-64 
    bg-zinc-950/80 backdrop-blur-xl border-r border-white/5
    transition-transform duration-500 cubic-bezier(0.16, 1, 0.3, 1)
    ${isOpen ? 'translate-x-0 shadow-[0_0_40px_rgba(0,0,0,0.9)] shadow-black' : '-translate-x-full'}
    md:sticky md:translate-x-0 md:bg-[#020204]/40 md:border-r md:border-white/5
  `;

  return (
    <aside ref={sidebarRef} className={sidebarClasses}>
      {/* Telemetry Active Header */}
      <div className="h-24 flex flex-col justify-center px-6 border-b border-white/5 relative overflow-hidden shrink-0 text-left">
        <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/3 blur-[40px] rounded-full"></div>
        <div className="absolute bottom-0 left-0 w-16 h-16 bg-emerald-500/3 blur-[30px] rounded-full"></div>
        
        <div className="relative z-10">
          <div className="flex items-center gap-1.5 mb-1 leading-none">
             <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_#10b981]" />
             <span className="text-[7px] text-slate-500 font-mono font-black uppercase tracking-wider">CR-SYS: NOMINAL // ALFA_F1</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-1 h-7 bg-amber-400 rounded-full shadow-[0_0_10px_rgba(251,191,36,0.4)]"></div>
            <div>
              <h1 className="text-xl font-black italic tracking-tighter text-white leading-none">
                ALFA <span className="text-amber-400">RACING</span>
              </h1>
              <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest bg-white/5 border border-white/10 px-1.5 py-0.5 rounded mt-1.5 inline-block">
                LAIR OF WOLVES
              </span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Navigation list */}
      <nav className="flex-1 px-3 py-5 space-y-5 overflow-y-auto scrollbar-thin scrollbar-thumb-white/5 scrollbar-track-transparent">
        {menuGroups.map((group) => (
          <div key={group.id} className="space-y-1 text-left">
            <div className="flex items-center gap-2 px-3 mb-1.5">
               <span className="text-[8px] font-mono text-slate-700 font-bold">{group.prefix}</span>
               <h3 className="text-[8px] font-black text-slate-500 uppercase tracking-[0.2em]">{group.title}</h3>
            </div>
            {group.items.map((item) => {
              const isActive = pathname === item.path;
              return (
                <Link 
                  key={item.path} 
                  href={item.path} 
                  onClick={onClose} 
                  className={`
                    relative flex items-center justify-between px-3.5 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all duration-300 group/item overflow-hidden border border-transparent
                    ${isActive 
                      ? `${group.bgActive} text-white` 
                      : `text-slate-400 hover:text-white ${group.hoverGlow}`
                    }
                  `}
                >
                  <div className="flex items-center gap-3 relative z-10 transition-transform duration-300 group-hover/item:translate-x-0.5">
                    {/* Active Led Blinker */}
                    {isActive && <span className={`w-1 h-1 rounded-full ${group.color.replace('text-', 'bg-')} shadow-[0_0_8px_currentColor]`} />}
                    
                    {/* Icon with brackets on hover */}
                    <span className="relative flex items-center justify-center">
                        <span className={`text-[10px] opacity-0 group-hover/item:opacity-100 -translate-x-1 group-hover/item:translate-x-0 transition-all duration-300 ${isActive ? group.color : 'text-slate-600'}`}>[</span>
                        <span className={`transition-transform duration-300 ${isActive ? `${group.color} scale-105` : 'text-slate-500 group-hover/item:text-slate-300'}`}>
                          {item.icon}
                        </span>
                        <span className={`text-[10px] opacity-0 group-hover/item:opacity-100 translate-x-1 group-hover/item:translate-x-0 transition-all duration-300 ${isActive ? group.color : 'text-slate-600'}`}>]</span>
                    </span>
                    
                    <span>{item.name}</span>
                  </div>

                  {/* Active Indicator Chevron */}
                  {isActive ? (
                     <ChevronsRight size={10} className={`${group.color} shrink-0 relative z-10 animate-pulse`} />
                  ) : (
                     <ChevronRight size={10} className="text-slate-700 group-hover/item:text-slate-400 group-hover/item:translate-x-0.5 transition-all shrink-0 opacity-0 group-hover/item:opacity-100" />
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* User Profile (FIA Credentials Style) */}
      <div className="p-3 border-t border-white/5 bg-black/40 backdrop-blur-xl shrink-0 relative">
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-indigo-500/10 to-transparent" />
        <div className="mb-2">
            <AdminInviteButton userRole={role} />
        </div>
        <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.01] border border-white/5 hover:border-white/10 transition-colors group">
          <div className="flex items-center gap-2.5 text-left">
            <div className="relative">
              <div className="w-8 h-8 rounded-lg bg-zinc-950 border border-white/10 flex items-center justify-center text-[10px] font-black text-amber-400 shadow-inner">
                {userEmail ? userEmail.charAt(0).toUpperCase() : '?'}
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-emerald-500 border border-black rounded-full animate-pulse shadow-[0_0_6px_#10b981]" />
            </div>
            <div className="flex flex-col overflow-hidden">
              <span className="text-[9px] font-black uppercase text-white group-hover:text-amber-400 transition-colors">Team Principal</span>
              <span className="text-[8px] text-slate-500 truncate max-w-[110px] font-mono leading-none mt-0.5">{userEmail || 'Loading...'}</span>
            </div>
          </div>
          <Link href="/login" onClick={() => supabase.auth.signOut()} className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-all" title="Sign Out"><Icons.Logout /></Link>
        </div>
      </div>
    </aside>
  );
}

// --- SUBCOMPONENTES AUXILIARES ---
function ChevronsRight({ size, className }: { size: number; className?: string }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
    </svg>
  );
}

function ChevronRight({ size, className }: { size: number; className?: string }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
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
      <div className="flex min-h-screen bg-[#020204] text-slate-300 font-sans antialiased selection:bg-amber-500/30 selection:text-amber-100">
        
        {/* Mobile Menu Backdrop */}
        <div 
          onClick={() => setIsMobileMenuOpen(false)}
          className={`fixed inset-0 z-50 bg-black/80 backdrop-blur-sm transition-opacity duration-300 md:hidden ${isMobileMenuOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        />
        
        <SidebarContent isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} />

        {/* Content Wrapper */}
        <div className="flex-1 flex flex-col min-w-0 relative">
          
          {/* Mobile Header */}
          <div className="md:hidden h-14 bg-zinc-950/80 backdrop-blur-md px-4 border-b border-white/5 flex justify-between items-center sticky top-0 z-30 shadow-lg">
             <div className="flex items-center gap-2 text-left">
                 <div className="w-1 h-5 bg-amber-400 rounded-full shadow-[0_0_8px_rgba(251,191,36,0.4)]"></div>
                 <Link href="/dashboard" className="font-black italic text-base text-white tracking-tighter">
                   ALFA <span className="text-amber-400">RACING</span>
                 </Link>
             </div>
             <button 
                onClick={() => setIsMobileMenuOpen(true)}
                className="h-9 w-9 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
                aria-label="Open Menu"
             >
                <div className="space-y-1">
                  <span className="block w-5 h-0.5 bg-current rounded-full" />
                  <span className="block w-5 h-0.5 bg-current rounded-full" />
                  <span className="block w-5 h-0.5 bg-current rounded-full" />
                </div>
             </button>
          </div>

          <main className="flex-1 w-full relative z-10">
              {children}
          </main>
        </div>
      </div>
    </GameProvider>
  );
}