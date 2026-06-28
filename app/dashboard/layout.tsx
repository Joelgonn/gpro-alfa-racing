'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import { GameProvider } from '@/app/context/GameContext';
import { supabase } from '@/app/lib/supabase';
import AdminInviteButton from '@/app/components/AdminInviteButton';

// --- ÍCONES PREMIUM COM ACABAMENTO DOURADO ---
const Icons = {
  Chart: () => (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v18h18" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M18.75 8.25l-5.25 5.25-3-3L4.5 16.5" />
      <circle cx="18.75" cy="8.25" r="1.5" fill="currentColor" />
    </svg>
  ),
  Car: () => (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <path d="M4 10h16M4 14h16M2 12h20M12 2v20" />
      <circle cx="12" cy="12" r="8" />
    </svg>
  ),
  Wrench: () => (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </svg>
  ),
  Strategy: () => (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z" />
      <path d="M12 6v6l4 2" />
    </svg>
  ),
  Money: () => (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <line x1="2" y1="10" x2="22" y2="10" />
      <circle cx="12" cy="14.5" r="2.5" />
    </svg>
  ),
  Users: () => (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  Logout: () => (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
    </svg>
  ),
  Beaker: () => (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <path d="M4.5 3h15M6 3v16a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V3M6 14h12" />
    </svg>
  ),
  Calendar: () => (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  ),
  Wear: () => (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
    </svg>
  ),
  Settings: () => (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  ),
  Database: () => (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
      <path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3" />
    </svg>
  ),
};

// --- ESTRUTURA DOS MENUS (FUSÃO: BRANCO GELO + DOURADO) ---
const menuGroups = [
  {
    id: 'race_control',
    prefix: '01',
    title: 'Controle de Corrida',
    color: 'text-amber-600',
    borderColor: 'border-amber-400/30',
    bgActive: 'bg-gradient-to-r from-amber-50/90 to-amber-100/60 border-amber-400/50 text-amber-700 shadow-lg shadow-amber-500/20',
    hoverGlow: 'hover:bg-gradient-to-r hover:from-slate-50/80 hover:to-transparent hover:border-amber-300/30 text-slate-700',
    items: [
      { name: 'Visão Geral', path: '/dashboard', icon: <Icons.Chart /> },
      { name: 'Setup Calculadora', path: '/dashboard/setup', icon: <Icons.Car /> },
      { name: 'Estratégia', path: '/dashboard/strategy', icon: <Icons.Strategy /> },
    ]
  },
  {
    id: 'engineering',
    prefix: '02',
    title: 'Engenharia & Testes',
    color: 'text-emerald-600',
    borderColor: 'border-emerald-400/30',
    bgActive: 'bg-gradient-to-r from-emerald-50/90 to-emerald-100/60 border-emerald-400/50 text-emerald-700 shadow-lg shadow-emerald-500/20',
    hoverGlow: 'hover:bg-gradient-to-r hover:from-slate-50/80 hover:to-transparent hover:border-emerald-300/30 text-slate-700',
    items: [
      { name: 'Setup Manual', path: '/dashboard/manual', icon: <Icons.Wrench /> },
      { name: 'Testes', path: '/dashboard/tests', icon: <Icons.Beaker /> },
      { name: 'Planejamento', path: '/dashboard/wear', icon: <Icons.Wear /> },
    ]
  },
  {
    id: 'management',
    prefix: '03',
    title: 'Gestão & Integração',
    color: 'text-indigo-600',
    borderColor: 'border-indigo-400/30',
    bgActive: 'bg-gradient-to-r from-indigo-50/90 to-indigo-100/60 border-indigo-400/50 text-indigo-700 shadow-lg shadow-indigo-500/20',
    hoverGlow: 'hover:bg-gradient-to-r hover:from-slate-50/80 hover:to-transparent hover:border-indigo-300/30 text-slate-700',
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
    title: 'Administração',
    color: 'text-cyan-600',
    borderColor: 'border-cyan-400/30',
    bgActive: 'bg-gradient-to-r from-cyan-50/90 to-cyan-100/60 border-cyan-400/50 text-cyan-700 shadow-lg shadow-cyan-500/20',
    hoverGlow: 'hover:bg-gradient-to-r hover:from-slate-50/80 hover:to-transparent hover:border-cyan-300/30 text-slate-700',
    items: [
      { name: 'GPRO API Database', path: '/dashboard/admin/gpro-kb', icon: <Icons.Database /> }
    ]
  }
];

// --- SIDEBAR COMPONENT (FUSÃO PERFEITA: BRANCO GELO + DOURADO) ---
function SidebarContent({ isOpen, onClose }: { isOpen: boolean; onClose: () => void; }) {
  const pathname = usePathname();
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [localRole, setLocalRole] = useState<string | null>(null);
  const sidebarRef = useRef<HTMLElement>(null);

  useEffect(() => {
    async function fetchUserData() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          setUserEmail(user.email || null);
          const { data: userState } = await supabase
            .from('user_state')
            .select('role')
            .eq('user_id', user.id)
            .single();
          
          if (userState?.role) {
            setLocalRole(userState.role);
          }
        }
      } catch (error) {
        console.error('Erro ao buscar dados do usuário:', error);
      }
    }
    fetchUserData();
  }, []);

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
    fixed inset-y-0 left-0 z-50 flex flex-col w-[290px] 
    bg-gradient-to-b from-white via-white/98 to-slate-50/95
    backdrop-blur-2xl
    border-r border-amber-200/40
    shadow-[0_0_80px_rgba(245,158,11,0.06),0_20px_60px_rgba(0,0,0,0.05)]
    transition-all duration-500 cubic-bezier(0.4, 0, 0.2, 1)
    ${isOpen ? 'translate-x-0 shadow-2xl shadow-amber-500/10' : '-translate-x-full'}
    md:sticky md:translate-x-0
  `;

  return (
    <aside ref={sidebarRef} className={sidebarClasses}>
      {/* Efeito de brilho dourado no topo */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-400/60 to-transparent" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 bg-amber-400/5 blur-3xl rounded-full" />
      
      {/* Header - Branco Gelo com Toques Dourados */}
      <div className="relative px-6 py-7 border-b border-amber-200/30 bg-gradient-to-b from-amber-50/50 to-transparent">
        <div className="absolute -top-20 -right-20 w-48 h-48 bg-amber-400/5 blur-3xl rounded-full" />
        <div className="absolute -bottom-20 -left-20 w-48 h-48 bg-amber-400/5 blur-3xl rounded-full" />
        
        <div className="relative">
          {/* Status Indicator */}
          <div className="flex items-center gap-3 mb-4">
            <div className="relative flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-60" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-400 shadow-lg shadow-amber-400/50" />
              </span>
              <span className="text-[10px] font-mono font-bold text-amber-600/80 tracking-[0.15em] uppercase">
                System Active
              </span>
            </div>
            <div className="flex-1 h-px bg-gradient-to-r from-amber-400/30 to-transparent" />
            <span className="text-[8px] font-mono text-amber-500/60 bg-amber-50/80 px-2.5 py-0.5 rounded-full border border-amber-200/50 tracking-wider">
              v2.4.1
            </span>
          </div>

          {/* Logo - Branco Gelo com Dourado */}
          <div className="flex items-end gap-4">
            <div className="relative group">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 via-amber-500 to-amber-600 
                            shadow-[0_0_30px_rgba(245,158,11,0.3),inset_0_1px_0_rgba(255,255,255,0.3)] 
                            flex items-center justify-center transform group-hover:scale-105 transition-transform duration-300">
                <span className="text-white font-black text-2xl tracking-tighter drop-shadow-[0_0_10px_rgba(0,0,0,0.2)]">A</span>
              </div>
              <div className="absolute -inset-0.5 rounded-2xl bg-gradient-to-br from-amber-400/20 to-transparent blur-md group-hover:blur-xl transition-all duration-300" />
              <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-emerald-400 rounded-full border-2 border-white shadow-lg shadow-emerald-400/50" />
            </div>
            <div className="pb-0.5">
              <h1 className="text-3xl font-black tracking-tight leading-none">
                <span className="text-slate-800">ALFA</span>
                <span className="text-amber-500 ml-1">RACING</span>
              </h1>
              <p className="text-[10px] font-bold text-amber-500/60 tracking-[0.25em] uppercase mt-1.5 flex items-center gap-2">
                <span className="w-4 h-px bg-amber-300/40" />
                LAIR OF WOLVES
                <span className="w-4 h-px bg-amber-300/40" />
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation - Itens com Brilho Dourado e Branco Gelo */}
      <nav className="flex-1 px-4 py-6 overflow-y-auto custom-scrollbar">
        {menuGroups.map((group, idx) => (
          <div key={group.id} className={`${idx > 0 ? 'mt-7' : ''}`}>
            {/* Group Header */}
            <div className="flex items-center gap-3 px-3 mb-3">
              <span className="text-[8px] font-mono font-bold text-amber-500/60 bg-amber-50/80 px-2.5 py-0.5 rounded border border-amber-200/50 shadow-sm">
                {group.prefix}
              </span>
              <span className="text-[10px] font-bold text-slate-400/80 uppercase tracking-[0.2em]">
                {group.title}
              </span>
              <div className="flex-1 h-px bg-gradient-to-r from-amber-200/40 to-transparent" />
            </div>

            {/* Items */}
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const isActive = pathname === item.path;
                return (
                  <Link 
                    key={item.path} 
                    href={item.path} 
                    onClick={onClose}
                    className={`
                      relative flex items-center gap-3 px-3 py-2.5 rounded-xl
                      text-[11px] font-medium transition-all duration-300
                      group border border-transparent
                      hover:scale-[1.02] active:scale-[0.98]
                      ${isActive 
                        ? `${group.bgActive} ${group.color} font-semibold border ${group.borderColor}` 
                        : `text-slate-600 ${group.hoverGlow} border-transparent hover:border-amber-200/30`
                      }
                    `}
                  >
                    {/* Active Indicator */}
                    {isActive && (
                      <>
                        <div className={`absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 rounded-r-full ${group.color.replace('text-', 'bg-')} shadow-[0_0_20px_currentColor]`} />
                        <div className={`absolute left-0 top-1/2 -translate-y-1/2 w-1 h-12 rounded-r-full ${group.color.replace('text-', 'bg-')} opacity-20 blur-md`} />
                      </>
                    )}

                    {/* Icon Container */}
                    <div className={`
                      relative flex items-center justify-center w-8 h-8 rounded-lg
                      transition-all duration-300
                      ${isActive 
                        ? `${group.color} bg-white/80 shadow-lg shadow-amber-500/10 border border-amber-400/30` 
                        : 'text-slate-400 group-hover:text-amber-500/70 group-hover:bg-amber-50/60 group-hover:border-amber-200/30'
                      }
                      border transition-all duration-300
                    `}>
                      {item.icon}
                      {isActive && (
                        <div className={`absolute inset-0 rounded-lg ${group.color.replace('text-', 'bg-')} opacity-10 blur-sm`} />
                      )}
                    </div>

                    {/* Label */}
                    <span className={`flex-1 ${isActive ? 'text-slate-800' : 'text-slate-600 group-hover:text-slate-800'}`}>
                      {item.name}
                    </span>

                    {/* Active Badge */}
                    {isActive && (
                      <span className="relative flex h-2 w-2">
                        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${group.color.replace('text-', 'bg-')} opacity-60`} />
                        <span className={`relative inline-flex rounded-full h-2 w-2 ${group.color.replace('text-', 'bg-')} shadow-[0_0_15px_currentColor]`} />
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer - Perfil Branco Gelo com Dourado */}
      <div className="relative p-4 border-t border-amber-200/30 bg-gradient-to-t from-amber-50/40 to-transparent">
        <div className="absolute inset-0 bg-gradient-to-r from-amber-500/5 via-transparent to-amber-500/5 pointer-events-none" />
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-400/30 to-transparent" />
        
        <div className="relative">
          {/* ✅ Passa localRole ou string vazia como fallback */}
          <AdminInviteButton userRole={localRole || ''} />
          
          <div className="mt-3 flex items-center gap-3 p-3 rounded-xl bg-white/90 backdrop-blur-sm border border-amber-200/40 hover:border-amber-400/60 transition-all duration-300 group shadow-lg shadow-amber-500/5 hover:shadow-amber-500/20">
            {/* Avatar */}
            <div className="relative">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 border border-amber-200/50 flex items-center justify-center text-sm font-bold text-amber-600 shadow-lg shadow-amber-500/10 group-hover:shadow-amber-500/30 transition-all duration-300">
                {userEmail ? userEmail.charAt(0).toUpperCase() : '?'}
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-400 rounded-full border-2 border-white shadow-lg shadow-emerald-400/50 animate-pulse" />
            </div>

            {/* User Info */}
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold text-slate-700 group-hover:text-amber-600 transition-colors truncate">
                {userEmail || 'Loading...'}
              </p>
              <p className="text-[8px] font-medium text-amber-500/60 uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-1 h-1 rounded-full bg-amber-400/40" />
                Team Principal
              </p>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1">
              <button 
                className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50/80 border border-transparent hover:border-amber-200/50 transition-all duration-200"
                title="Configurações"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
              </button>
              <Link 
                href="/login" 
                onClick={() => supabase.auth.signOut()} 
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50/80 border border-transparent hover:border-rose-200/50 transition-all duration-200"
                title="Sair"
              >
                <Icons.Logout />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}

// --- SUBCOMPONENTES AUXILIARES ---
function ChevronsRight({ size, className }: { size: number; className?: string }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
    </svg>
  );
}

function ChevronRight({ size, className }: { size: number; className?: string }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
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
      <div className="flex min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 text-slate-800 font-sans antialiased selection:bg-amber-400/20 selection:text-amber-900">
        
        {/* Mobile Menu Backdrop */}
        <div 
          onClick={() => setIsMobileMenuOpen(false)}
          className={`fixed inset-0 z-40 bg-black/30 backdrop-blur-sm transition-opacity duration-500 md:hidden ${
            isMobileMenuOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        />
        
        <SidebarContent isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} />

        {/* Content Wrapper */}
        <div className="flex-1 flex flex-col min-w-0 relative">
          
          {/* Mobile Header - Branco Gelo com Dourado */}
          <div className="md:hidden sticky top-0 z-30 bg-white/90 backdrop-blur-xl border-b border-amber-200/30 px-4 h-16 flex items-center justify-between shadow-lg shadow-amber-500/5">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 shadow-lg shadow-amber-500/30 flex items-center justify-center">
                  <span className="text-white font-black text-base">A</span>
                </div>
                <div className="absolute -inset-0.5 rounded-xl bg-amber-400/20 blur-md" />
              </div>
              <div>
                <h1 className="text-sm font-black tracking-tight text-slate-800 leading-none">
                  ALFA <span className="text-amber-500">RACING</span>
                </h1>
                <p className="text-[6px] font-bold text-amber-500/60 tracking-[0.25em] uppercase mt-0.5">
                  Lair of Wolves
                </p>
              </div>
            </div>
            
            <button 
              onClick={() => setIsMobileMenuOpen(true)}
              className="relative w-10 h-10 flex items-center justify-center rounded-xl hover:bg-amber-50/80 border border-transparent hover:border-amber-200/50 transition-all duration-300 group"
              aria-label="Open Menu"
            >
              <div className="space-y-1.5">
                <span className="block w-5 h-0.5 bg-slate-600/70 rounded-full transition-all group-hover:bg-amber-500 group-hover:w-6" />
                <span className="block w-5 h-0.5 bg-slate-600/70 rounded-full transition-all group-hover:bg-amber-500" />
                <span className="block w-5 h-0.5 bg-slate-600/70 rounded-full transition-all group-hover:bg-amber-500 group-hover:w-6" />
              </div>
            </button>
          </div>

          <main className="flex-1 w-full relative z-10 p-4 md:p-6 lg:p-8">
            {children}
          </main>
        </div>
      </div>
    </GameProvider>
  );
}