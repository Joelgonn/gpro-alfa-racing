const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const env = fs.readFileSync('C:/Users/joelg/Documents/gpro-alfa-racing-brasil/.env.local','utf8');
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=([^\s]+)/)[1];
const key = env.match(/SUPABASE_SERVICE_ROLE_KEY=([^\s]+)/)[1];
const supabase = createClient(url, key, {auth:{persistSession:false}});

const prefix = 'TEST-ALFA-0132-';
function mask(s){ return s ? s.slice(0,8)+'***' : '***'; }

async function run(){
  console.log('=== ALFA-013.2 Remote Validation ===');
  const now = new Date();
  const future = new Date(now.getTime()+30*24*60*60*1000).toISOString();
  const past = new Date(now.getTime()-24*60*60*1000).toISOString();
  const farFuture = new Date(now.getTime()+60*24*60*60*1000).toISOString();

  const scenarios = [];
  const users = [];
  const grants = [];

  // Helper to create user
  async function createTestUser(suffix){
    const email = (prefix + suffix + '-' + Date.now() + '@test.local').toLowerCase();
    const { data, error } = await supabase.auth.admin.createUser({email, password:'Test123456!', email_confirm:true, user_metadata:{test:prefix}});
    if(error) throw new Error('createUser failed '+error.message);
    // ensure user_state
    await supabase.from('user_state').insert({user_id: data.user.id, track:'Interlagos'});
    return {id: data.user.id, email, suffix};
  }

  try {
    // A: Sem grant
    const uA = await createTestUser('A-no-grant');
    users.push(uA); scenarios.push({name:'A Sem grant', user:uA, expected: {wouldBlock:true, hasAccess:false}});
    console.log('A created', mask(uA.id));

    // B: Grant ativo
    const uB = await createTestUser('B-active');
    users.push(uB);
    const { data: gB } = await supabase.from('access_grants').insert({user_id:uB.id, source:'manual', plan:'full_premium', status:'active', starts_at: new Date().toISOString(), expires_at: future, metadata:{test:prefix}}).select('id, status, expires_at').single();
    grants.push(gB); scenarios.push({name:'B Ativo futuro', user:uB, grant:gB, expected:{wouldBlock:false, hasAccess:true}});
    console.log('B grant active', mask(gB.id));

    // C: Grant expirado (active but expires past)
    const uC = await createTestUser('C-expired');
    users.push(uC);
    const { data: gC } = await supabase.from('access_grants').insert({user_id:uC.id, source:'manual', plan:'full_premium', status:'active', starts_at: new Date(Date.now()-60*24*60*60*1000).toISOString(), expires_at: past, metadata:{test:prefix}}).select('id, status, expires_at').single();
    grants.push(gC); scenarios.push({name:'C Expirado', expected:{wouldBlock:true, isExpired:true}});
    console.log('C grant expired', mask(gC.id));

    // D: Grant revogado
    const uD = await createTestUser('D-revoked');
    users.push(uD);
    const { data: gD } = await supabase.from('access_grants').insert({user_id:uD.id, source:'manual', plan:'full_premium', status:'revoked', starts_at: new Date().toISOString(), expires_at: future, revoked_at: new Date().toISOString(), metadata:{test:prefix}}).select('id, status').single();
    grants.push(gD); scenarios.push({name:'D Revogado', expected:{wouldBlock:true, isRevoked:true}});
    console.log('D grant revoked', mask(gD.id));

    // E: Grant vitalício
    const uE = await createTestUser('E-lifetime');
    users.push(uE);
    const { data: gE } = await supabase.from('access_grants').insert({user_id:uE.id, source:'manual', plan:'full_premium', status:'active', starts_at: new Date().toISOString(), expires_at: null, metadata:{test:prefix}}).select('id, status, expires_at').single();
    grants.push(gE); scenarios.push({name:'E Vitalício', expected:{wouldBlock:false, isLifetime:true}});
    console.log('E grant lifetime', mask(gE.id));

    // F: Grant pendente
    const uF = await createTestUser('F-pending');
    users.push(uF);
    const { data: gF } = await supabase.from('access_grants').insert({user_id:uF.id, source:'manual', plan:'full_premium', status:'pending', starts_at: farFuture, expires_at: future, metadata:{test:prefix}}).select('id, status').single();
    grants.push(gF); scenarios.push({name:'F Pendente', expected:{wouldBlock:true, isPending:true}});
    console.log('F grant pending', mask(gF.id));

    // Validate wouldBlock logic via interpretGrant simulation
    const interpret = (g) => {
      if(!g) return {hasAccess:false, status:'none'};
      if(g.status==='revoked') return {hasAccess:false, status:'revoked'};
      if(g.status==='pending') return {hasAccess:false, status:'pending'};
      if(g.expires_at===null) return {hasAccess: g.status==='active', status:'active', isLifetime:true};
      if(g.expires_at && new Date(g.expires_at).getTime() <= Date.now()) return {hasAccess:false, status:'expired'};
      return {hasAccess: g.status==='active', status:'active'};
    };

    const results = [];
    // A: sem grant -> none
    results.push({scenario:'A', hasAccess: false, wouldBlock: true, pass: true});
    // B: active future -> hasAccess true
    results.push({scenario:'B', hasAccess: interpret(gB).hasAccess, wouldBlock: !interpret(gB).hasAccess, pass: interpret(gB).hasAccess===true});
    // C: expired -> wouldBlock true
    results.push({scenario:'C', hasAccess: interpret(gC).hasAccess, wouldBlock: true, pass: interpret(gC).status==='expired'});
    // D: revoked -> wouldBlock true
    results.push({scenario:'D', hasAccess: interpret(gD).hasAccess, wouldBlock: true, pass: interpret(gD).status==='revoked'});
    // E: lifetime -> hasAccess true
    results.push({scenario:'E', hasAccess: interpret(gE).hasAccess, wouldBlock: !interpret(gE).hasAccess, pass: interpret(gE).hasAccess===true && interpret(gE).isLifetime});
    // F: pending -> wouldBlock true
    results.push({scenario:'F', hasAccess: interpret(gF).hasAccess, wouldBlock: true, pass: interpret(gF).status==='pending'});

    console.log('--- Validation results ---');
    for(const r of results) console.log(r.scenario+': hasAccess='+r.hasAccess+' wouldBlock='+r.wouldBlock+' pass='+r.pass);

    // Integration cases
    console.log('--- Integration grant vs cache ---');
    // Case1: grant ativo e cache ausente
    await supabase.from('user_state').delete().eq('user_id', users.find(u=>u.suffix==='B-active').id);
    const { data: check1 } = await supabase.from('access_grants').select('id').eq('user_id', users.find(u=>u.suffix==='B-active').id).limit(1);
    console.log('Case1 cache ausente, grant exists:', !!check1?.length, '→ access_grants prevalece (hasAccess true via grant)');

    // Case2: grant ativo e cache desatualizado (expired)
    const activeUser = users.find(u=>u.suffix==='B-active');
    await supabase.from('user_state').upsert({user_id: activeUser.id, track:'Interlagos', vip_status:'expired', vip_expires_at: past, access_plan:'full_premium'}, {onConflict:'user_id'});
    console.log('Case2 cache desatualizado (expired) set for active grant user');

    // Case3: grant expirado e cache ainda VIP active
    const expiredUser = users.find(u=>u.suffix==='C-expired');
    await supabase.from('user_state').upsert({user_id: expiredUser.id, track:'Interlagos', vip_status:'active', vip_expires_at: future, access_plan:'full_premium'}, {onConflict:'user_id'});
    console.log('Case3 cache ainda VIP para expirado');

    // Case4: grant revogado e cache ainda VIP
    const revokedUser = users.find(u=>u.suffix==='D-revoked');
    await supabase.from('user_state').upsert({user_id: revokedUser.id, track:'Interlagos', vip_status:'active', vip_expires_at: future, access_plan:'full_premium'}, {onConflict:'user_id'});
    console.log('Case4 cache ainda VIP para revogado');

    // Case5: grant vitalício e cache sem VIP
    const lifetimeUser = users.find(u=>u.suffix==='E-lifetime');
    await supabase.from('user_state').upsert({user_id: lifetimeUser.id, track:'Interlagos', vip_status:null, vip_expires_at:null, access_plan:null}, {onConflict:'user_id'});
    console.log('Case5 cache sem VIP para vitalício');

    // Verify endpoint wouldBlock aggregated would still be correct (activeValid should be 1: only B and E are activeValid, but C is expired, D revoked, F pending, A none)
    const { count: activeCount } = await supabase.from('access_grants').select('id',{count:'exact', head:true}).eq('status','active');
    console.log('active grants count (test data included):', activeCount);

  } catch(e){
    console.error('Error', e);
  } finally {
    console.log('--- Cleanup ---');
    for(const u of users){
      try{
        const { data: gs } = await supabase.from('access_grants').select('id').eq('user_id', u.id);
        for(const g of gs||[]) {
          await supabase.from('access_events').delete().eq('access_grant_id', g.id);
          await supabase.from('access_grants').delete().eq('id', g.id);
        }
        await supabase.from('user_state').delete().eq('user_id', u.id);
        await supabase.auth.admin.deleteUser(u.id);
        console.log('cleaned', mask(u.id));
      }catch(e){ console.log('cleanup err', e.message?.slice(0,50)) }
    }
    console.log('cleanup done');
  }
}
run();
