'use client';
import Link from 'next/link';
import { Wrench, Target, FlaskConical, Calendar, Settings, ShoppingCart } from 'lucide-react';

const shortcuts = [
  { label: 'Setup', href: '/dashboard/setup', icon: Wrench },
  { label: 'Estratégia', href: '/dashboard/strategy', icon: Target },
  { label: 'Testes', href: '/dashboard/tests', icon: FlaskConical },
  { label: 'Calendário', href: '/dashboard/calendar', icon: Calendar },
  { label: 'Integração', href: '/dashboard/configuracoes/integracao', icon: Settings },
  { label: 'Mercado', href: '/dashboard/market', icon: ShoppingCart },
];

export function QuickShortcuts() {
  return (
    <div className="relative bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
      <div className="bg-white p-3 border-b border-slate-200">
        <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-widest">Atalhos</h4>
      </div>
      <div className="p-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 bg-white">
        {shortcuts.map(({ label, href, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="flex flex-col items-center gap-1.5 rounded-xl bg-slate-50 border border-slate-200 p-3 hover:bg-white hover:border-slate-300 hover:shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
          >
            <Icon size={16} className="text-slate-600" />
            <span className="text-[11px] font-black uppercase tracking-wide text-slate-700 text-center">{label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
