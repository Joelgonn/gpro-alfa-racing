'use client'

import { useState } from 'react'
// <<< ADICIONADO: Ícone do WhatsApp
import { FaUserShield, FaCopy, FaCheck, FaWhatsapp } from 'react-icons/fa' 
import { generateNewInvite } from '../actions/admin'
import { supabase } from '../lib/supabase'

export default function AdminInviteButton({ userRole }: { userRole: string }) {
  const [loading, setLoading] = useState(false);
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  if (userRole !== 'admin') {
    return null;
  }

  const handleGenerate = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    
    if (user) {
      const result = await generateNewInvite(user.id);
      if (result.success && result.code) {
        setGeneratedCode(result.code);
      } else {
        alert(result.message || 'Ocorreu um erro.');
      }
    }
    setLoading(false);
  };

  const copyToClipboard = () => {
    if (generatedCode) {
      navigator.clipboard.writeText(generatedCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // <<< ADICIONADO: Função para compartilhar no WhatsApp
  const handleShareToWhatsApp = () => {
    if (!generatedCode) return;

    // 1. Cria a mensagem que será enviada
    const message = `Olá! Aqui está seu código de convite exclusivo para a Alfa Racing Brasil: *${generatedCode}*`;
    
    // 2. Codifica a mensagem para ser usada em uma URL (troca espaços por %20, etc.)
    const encodedMessage = encodeURIComponent(message);

    // 3. Cria o link e abre em uma nova aba
    const whatsappUrl = `https://wa.me/?text=${encodedMessage}`;
    window.open(whatsappUrl, '_blank');
  };

  return (
    <div className="w-full">
      {!generatedCode ? (
        <button
          onClick={handleGenerate}
          disabled={loading}
          className="w-full flex items-center gap-3 px-3 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 rounded-xl transition-all group"
        >
          <div className="p-1.5 bg-red-500 rounded-lg text-black group-hover:scale-110 transition-transform">
            {loading ? <div className="animate-spin w-3 h-3 border-2 border-black border-t-transparent rounded-full"/> : <FaUserShield size={12} />}
          </div>
          <div className="text-left">
            <p className="text-[10px] font-black uppercase tracking-widest">Painel Admin</p>
            <p className="text-[9px] opacity-70">Gerar Convite VIP</p>
          </div>
        </button>
      ) : (
        <div className="w-full bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-2 animate-in fade-in">
          <div className="flex justify-between items-center mb-1">
            <span className="text-[8px] font-black text-emerald-500 uppercase">Código Gerado</span>
            <button onClick={() => setGeneratedCode(null)} className="text-[8px] text-gray-500 hover:text-white">X</button>
          </div>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-black/40 p-1.5 rounded text-[10px] font-mono text-emerald-400 border border-emerald-500/20 text-center select-all">
              {generatedCode}
            </code>
            
            {/* Botão de Copiar */}
            <button onClick={copyToClipboard} className="p-1.5 bg-emerald-500 text-black rounded-lg hover:bg-emerald-400 transition-colors" title="Copiar">
              {copied ? <FaCheck size={10} /> : <FaCopy size={10} />}
            </button>

            {/* <<< ADICIONADO: Botão do WhatsApp */}
            <button 
              onClick={handleShareToWhatsApp} 
              className="p-1.5 bg-green-500 text-white rounded-lg hover:bg-green-400 transition-colors"
              title="Compartilhar no WhatsApp"
            >
              <FaWhatsapp size={10} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}