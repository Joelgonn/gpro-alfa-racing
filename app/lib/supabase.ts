import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('As variáveis de ambiente NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY são obrigatórias.');
}

// Browser client com cookies (compatível com utils/supabase/server.ts)
// Mantém compatibilidade: exporta `supabase` como antes, mas agora sincroniza cookies para SSR
export const supabase = createBrowserClient(supabaseUrl, supabaseKey);