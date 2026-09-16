'use client';
import { Users } from 'lucide-react';
import { calcStaffLevel } from '@/app/lib/staff';
type Staff = { toleranciaPressao?: number; concentracao?: number };
export function StaffCard({ staffFacilities }: { staffFacilities: Staff }) {
  return (
    <div className="relative bg-white/[0.04] backdrop-blur-md border border-white/10 rounded-2xl overflow-hidden">
      <div className="bg-[#0a0f1f] p-3 border-b border-white/10 flex items-center gap-2"><Users size={14} className="text-purple-400" /><h4 className="text-[11px] font-black text-white uppercase tracking-widest">Equipe (Staff)</h4></div>
      <div className="p-3 bg-transparent">
        <div className="flex items-center justify-between"><span className="text-sm font-black text-white">Nível</span><span className="text-xs font-black font-mono text-emerald-300">{calcStaffLevel(staffFacilities?.toleranciaPressao, staffFacilities?.concentracao)}</span></div>
        <div className="flex gap-3 mt-1.5 text-xs text-zinc-400"><span>🔄 Tolerância: {staffFacilities?.toleranciaPressao ?? 0}</span><span>🧠 Concentração: {staffFacilities?.concentracao ?? 0}</span></div>
      </div>
    </div>
  );
}
