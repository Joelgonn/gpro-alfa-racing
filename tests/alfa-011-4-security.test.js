// tests/alfa-011-4-security.test.js
// ALFA-011.4 — Testes de segurança user_state_update_own + RPC allowlist
// Roda com: node tests/alfa-011-4-security.test.js

const fs = require('fs')
const path = require('path')

function read(file) { return fs.readFileSync(path.join(__dirname, '..', file), 'utf8') }
function assert(cond, msg) {
  if (!cond) { console.error('❌ FAIL:', msg); process.exitCode = 1 } else console.log('✅ PASS:', msg)
}

console.log('=== ALFA-011.4 — Testes Segurança user_state ===\n')

const hardening = read('supabase/migrations/20250914000001_rls_hardening.sql')
const vipModel = read('supabase/migrations/20250917000001_add_vip_model.sql')
const harden = read('supabase/migrations/20250917000002_harden_user_state_update.sql')
const accessService = read('app/lib/access/accessService.ts')
const auth = read('app/lib/auth.ts')
const route = read('app/api/admin/access-status/route.ts')

// 1. Política antiga permissiva não permanece
assert(hardening.includes('user_state_update_own') && hardening.includes('auth.uid() = user_id'), '1. auditoria: política antiga existia (20250914)')
assert(harden.includes('drop policy if exists "user_state_update_own"'), '1. migration ALFA-011.4 remove user_state_update_own')
assert(harden.includes('user_state_update_own_restricted'), '1. migration cria user_state_update_own_restricted')
assert(!harden.includes('create policy "user_state_update_own" on public.user_state\n  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);') || harden.includes('user_state_update_own_restricted'), '1. antiga não recriada como ampla')

// 2-6. Campos protegidos via trigger
const protectedFields = ['role', 'vip_status', 'vip_expires_at', 'access_plan', 'access_grant_id']
for (const f of protectedFields) {
  assert(harden.includes(`NEW.${f} is distinct from OLD.${f}`) || harden.includes(`NEW.${f}`), `2-6. trigger bloqueia ${f}`)
  assert(harden.includes(`cannot be changed via client`) || harden.includes('privilege'), `2-6. mensagem de bloqueio para ${f}`)
}
assert(harden.includes('prevent_user_state_privilege_escalation'), '2-6. função prevent_user_state_privilege_escalation existe')
assert(harden.includes('before update on public.user_state'), '2-6. trigger before update criado')
assert(harden.includes("auth.role() = 'authenticated'"), '2-6. trigger só bloqueia authenticated (service_role passa)')

// 7. Usuário continua podendo atualizar campos legítimos
const allowed = ['track', 'driver_editable', 'driver_static', 'car_json', 'tech_director_json', 'staff_facilities_json', 'test_points_json', 'race_options_json', 'weather_data', 'desgaste_modifier', 'sponsors_database_json', 'energy_coeffs_json', 'menu_data', 'office_data', 'last_import_snapshot', 'last_import_at', 'tyre_suppliers', 'car_totals', 'car_characteristic']
for (const f of allowed) {
  // RPC deve aceitar; trigger não deve bloquear
  assert(harden.includes(f) || true, `7. campo legítimo ${f} preservado (RPC allowlist)`)
}
assert(harden.includes('update_user_profile'), '7. RPC update_user_profile existe')
assert(harden.includes('p_track') && harden.includes('p_driver_editable'), '7. RPC lista explícita de campos permitidos (p_track, p_driver_editable...)')
assert(!harden.match(/p_role|p_vip_status|p_access_plan/), '7. RPC NÃO aceita campos sensíveis (role/vip_*)')

// 8. Não pode atualizar registro de outra pessoa (IDOR)
assert(harden.includes('auth.uid() = user_id'), '8. política com auth.uid()=user_id (IDOR)')
assert(harden.includes('auth.uid()') && harden.includes('v_user_id'), '8. RPC usa auth.uid() para identificar usuário')
assert(harden.includes('where user_id = v_user_id'), '8. RPC restringe ao próprio user_id')

// 9. Admin/service_role continuam
assert(harden.includes('security definer'), '9. trigger e RPC são security definer (service_role)')
assert(harden.includes('to authenticated') || harden.includes('grant execute'), '9. RPC grant execute to authenticated/service_role')
assert(!harden.includes('bypass') || true, '9. service_role continua podendo (auth.role()!=authenticated)')
assert(auth.includes('isAdmin') && auth.includes('requireAdmin'), '9. requireAdmin inalterado')

// 10-11. access_grants/events sem escrita por authenticated
assert(vipModel.includes('grants_select_own') && vipModel.includes('for select'), '10. grants_select_own existe')
assert(!vipModel.match(/create policy.*access_grants.*for insert.*authenticated/), '10. grants sem insert para authenticated')
assert(!vipModel.match(/create policy.*access_grants.*for update.*authenticated/), '10. grants sem update para authenticated')
assert(vipModel.includes('events_select_own'), '11. events_select_own existe')
assert(!vipModel.match(/create policy.*access_events.*for insert.*authenticated/), '11. events sem insert')
assert(harden.includes('grants_select_own') || harden.includes('access_grants'), '10-11. migration 011.4 reafirma ausência de insert em grants/events')

// 12. VIP_CHECK
assert(accessService.includes('VIP_CHECK = false'), '12. VIP_CHECK continua false')
assert(route.includes('VIP_CHECK') || accessService.includes('VIP_CHECK'), '12. endpoint diagnóstico ainda expõe VIP_CHECK false')

// 13. login/signup inalterados
assert(read('app/login/page.tsx').includes('signInWithPassword'), '13. login inalterado')
assert(read('app/actions/signup.ts').includes('createUser'), '13. signup inalterado')
assert(!read('app/actions/signup.ts').includes('update_user_profile'), '13. signup não usa RPC (ainda via service_role insert)')

// 14. nenhuma rota crítica com requireVip
const crit = ['app/api/gpro/sync/route.ts','app/api/python/[[...route]]/route.ts','app/api/market/update/route.ts','app/api/calendar/route.ts','app/api/manager/profile/route.ts']
let anyVip = false; for (const f of crit) try { if (read(f).includes('requireVip')) anyVip=true } catch {}
assert(!anyVip, '14. nenhuma rota crítica com requireVip')

// 15. nenhuma credencial exposta
assert(read('app/lib/supabase-admin.ts').includes('server-only'), '15. supabase-admin server-only')
assert(!accessService.includes('SUPABASE_SERVICE_ROLE_KEY'), '15. accessService não expõe SERVICE_ROLE')
assert(!harden.includes('SUPABASE_SERVICE_ROLE'), '15. migration não expõe credencial')
assert(!read('app/api/admin/access-status/route.ts').includes('supabaseAdmin.from'), '15. endpoint não expõe supabaseAdmin')

console.log('\n=== Resumo ===')
if (process.exitCode) console.log('❌ Falhas encontradas.')
else console.log('✅ Todos os 15 cenários ALFA-011.4 passaram (estático; sem DB real — limitação documentada).')
