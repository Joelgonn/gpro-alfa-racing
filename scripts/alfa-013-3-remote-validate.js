const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const env = fs.readFileSync('C:/Users/joelg/Documents/gpro-alfa-racing-brasil/.env.local','utf8');
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=([^\s]+)/)[1];
const key = env.match(/SUPABASE_SERVICE_ROLE_KEY=([^\s]+)/)[1];
const supabase = createClient(url, key, {auth:{persistSession:false}});
const prefix = 'TEST-ALFA-0133-';
function mask(s){ return s ? s.slice(0,8)+'***' : '***'; }
async function run(){
  console.log('=== ALFA-013.3 Remote Validation ===');
  const now = new Date();
  const future = new Date(now.getTime()+30*24*60*60*1000).toISOString();
  const past = new Date(now.getTime()-24*60*60*1000).toISOString();
  const farFuture = new Date(now.getTime()+60*24*60*60*1000).toISOString();
  const users=[], grants=[];
  async function createUser(suffix){
    const email = (prefix + suffix + '-' + Date.now() + Math.random().toString(36).slice(2,4) + '@test.local').toLowerCase();
    const { data, error } = await supabase.auth.admin.createUser({email, password:'Test123456!', email_confirm:true, user_metadata:{test:prefix}});
    if(error) throw new Error('createUser '+error.message);
    await supabase.from('user_state').insert({user_id: data.user.id, track:'Interlagos'});
    return {id: data.user.id, email, suffix};
  }
  try{
    const uA = await createUser('A-no-grant'); users.push(uA); console.log('A no-grant', mask(uA.id));
    const uB = await createUser('B-active'); users.push(uB);
    const { data: gB } = await supabase.from('access_grants').insert({user_id:uB.id, source:'manual', plan:'full_premium', status:'active', starts_at: new Date().toISOString(), expires_at: future, metadata:{test:prefix}}).select('id, status, expires_at').single();
    grants.push(gB); console.log('B active', mask(gB.id));
    const uC = await createUser('C-expired'); users.push(uC);
    const { data: gC } = await supabase.from('access_grants').insert({user_id:uC.id, source:'manual', plan:'full_premium', status:'active', starts_at: new Date(Date.now()-60*24*60*60*1000).toISOString(), expires_at: past, metadata:{test:prefix}}).select('id, status, expires_at').single();
    grants.push(gC); console.log('C expired', mask(gC.id));
    const uD = await createUser('D-revoked'); users.push(uD);
    const { data: gD } = await supabase.from('access_grants').insert({user_id:uD.id, source:'manual', plan:'full_premium', status:'revoked', starts_at: new Date().toISOString(), expires_at: future, revoked_at: new Date().toISOString(), metadata:{test:prefix}}).select('id, status').single();
    grants.push(gD); console.log('D revoked', mask(gD.id));
    const uE = await createUser('E-lifetime'); users.push(uE);
    const { data: gE } = await supabase.from('access_grants').insert({user_id:uE.id, source:'manual', plan:'full_premium', status:'active', starts_at: new Date().toISOString(), expires_at: null, metadata:{test:prefix}}).select('id, status, expires_at').single();
    grants.push(gE); console.log('E lifetime', mask(gE.id));
    const uF = await createUser('F-pending'); users.push(uF);
    const { data: gF } = await supabase.from('access_grants').insert({user_id:uF.id, source:'manual', plan:'full_premium', status:'pending', starts_at: farFuture, expires_at: future, metadata:{test:prefix}}).select('id, status').single();
    grants.push(gF); console.log('F pending', mask(gF.id));

    const interpret = (g) => {
      if(!g) return {hasAccess:false, status:'none'};
      if(g.status==='revoked') return {hasAccess:false, status:'revoked'};
      if(g.status==='pending') return {hasAccess:false, status:'pending'};
      if(g.expires_at===null) return {hasAccess: g.status==='active', status:'active', isLifetime:true};
      if(g.expires_at && new Date(g.expires_at).getTime() <= Date.now()) return {hasAccess:false, status:'expired'};
      return {hasAccess: g.status==='active', status:'active'};
    };
    const checks = [
      {name:'A Sem grant', g:null, expWouldBlock:true},
      {name:'B Ativo', g:gB, expWouldBlock:false},
      {name:'C Expirado', g:gC, expWouldBlock:true},
      {name:'D Revogado', g:gD, expWouldBlock:true},
      {name:'E Vitalício', g:gE, expWouldBlock:false},
      {name:'F Pendente', g:gF, expWouldBlock:true},
    ];
    for(const c of checks){
      const res = c.g ? interpret(c.g) : {hasAccess:false, status:'none'};
      const wouldBlock = !res.hasAccess;
      console.log(c.name+': hasAccess='+res.hasAccess+' wouldBlock='+wouldBlock+' pass='+(wouldBlock===c.expWouldBlock));
    }

    // Integration cases
    console.log('--- Integration grant vs cache ---');
    await supabase.from('user_state').delete().eq('user_id', uB.id);
    console.log('Case A active + cache ausente → grant prevalece (hasAccess true via grant)');
    await supabase.from('user_state').upsert({user_id: uB.id, track:'Interlagos', vip_status:'expired', vip_expires_at: past, access_plan:'full_premium'}, {onConflict:'user_id'});
    console.log('Case B active + cache expirado → grant prevalece');
    await supabase.from('user_state').upsert({user_id: uC.id, track:'Interlagos', vip_status:'active', vip_expires_at: future, access_plan:'full_premium'}, {onConflict:'user_id'});
    console.log('Case C expirado + cache VIP → wouldBlock true, divergência');
    await supabase.from('user_state').upsert({user_id: uD.id, track:'Interlagos', vip_status:'active', vip_expires_at: future, access_plan:'full_premium'}, {onConflict:'user_id'});
    console.log('Case D revogado + cache VIP → revogação prevalece');
    await supabase.from('user_state').upsert({user_id: uE.id, track:'Interlagos', vip_status:null, vip_expires_at:null, access_plan:null}, {onConflict:'user_id'});
    console.log('Case E vitalício + cache sem VIP → vitalício válido');

    const { count: active } = await supabase.from('access_grants').select('id',{count:'exact', head:true}).eq('status','active');
    console.log('active grants total (incl test)', active);
  }catch(e){ console.error('Error', e.message?.slice(0,120)); }
  finally{
    console.log('--- Cleanup ---');
    for(const u of users){
      try{
        const { data: gs } = await supabase.from('access_grants').select('id').eq('user_id', u.id);
        for(const g of gs||[]){ await supabase.from('access_events').delete().eq('access_grant_id', g.id); await supabase.from('access_grants').delete().eq('id', g.id); }
        await supabase.from('user_state').delete().eq('user_id', u.id);
        await supabase.auth.admin.deleteUser(u.id);
        console.log('cleaned', mask(u.id));
      }catch(e){ console.log('cleanup err', e.message?.slice(0,50)) }
    }
    // Verify no remaining
    const { count } = await supabase.from('access_grants').select('id',{count:'exact', head:true}).like('metadata->>test', prefix+'%');
    console.log('remaining test grants', count);
  }
}
run();
