'use client';

type ResearchVariableSearchProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
};

export function ResearchVariableSearch({ value, onChange, placeholder = 'Pesquisar variável' }: ResearchVariableSearchProps) {
  return (
    <div className="rounded-[1.75rem] border border-white/70 bg-white/85 p-5 shadow-[0_16px_50px_rgba(15,23,42,0.06)] backdrop-blur">
      <label className="text-[10px] font-black uppercase tracking-[0.35em] text-slate-500">Busca global</label>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-3 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-500"
      />
    </div>
  );
}
