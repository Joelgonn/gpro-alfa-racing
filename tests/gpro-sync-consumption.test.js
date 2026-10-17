// tests/gpro-sync-consumption.test.js
// ============================================
// ALFA-010 - Consumo de API GPRO (sync / Testes / patrocinadores)
// ============================================
// 1) Garantias estruturais (convenção do repo: leitura do source)
// 2) Unit tests REAIS: compila o helper puro e valida com mocks
// ============================================

function assert(cond, msg){ if(!cond){ console.error('FAIL',msg); process.exitCode=1;} else console.log('PASS',msg); }

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

// ============================================================
// 1) GARANTIAS ESTRUTURAIS
// ============================================================

const testsPage = read('app/dashboard/tests/page.tsx');
assert(!testsPage.includes("fetch('/api/gpro/sync'"), 'página Testes NÃO dispara mais POST em /api/gpro/sync');
assert(testsPage.includes("fetch('/api/gpro/testing'"), 'página Testes usa /api/gpro/testing');
assert(!testsPage.includes('loadTestingData'), 'efeito auto-sync antigo (mount) removido');
assert(testsPage.includes("fetch('/api/gpro/testing', { cache: 'no-store' })"), 'mount lê o snapshot via GET (0 chamadas GPRO)');
assert(testsPage.includes('handleRefreshTesting'), 'página Testes expõe atualização manual');
assert(testsPage.includes('testingSnapshotAt'), 'página Testes exibe a última sincronização');
assert(testsPage.includes('applyTestingData'), 'página Testes reutiliza aplicação dos dados de testes');

const syncRoute = read('app/api/gpro/sync/route.ts');
assert(!syncRoute.includes('sponsorsList.slice(0, 20)'), 'sem loop incondicional slice(0, 20) de enriquecimento');
assert(!syncRoute.includes('sponsorsList.slice(20)'), 'sem fallback redundante slice(20)');
assert(syncRoute.includes('selectSponsorsForEnrichment'), 'enriquecimento CONDICIONAL presente');
assert(syncRoute.includes('getLatestSnapshot'), 'AvailSponsors controlado por snapshot (1x por corrida)');
assert(syncRoute.includes('refreshSponsors'), 'flag opcional refreshSponsors presente (retrocompatível)');
assert(syncRoute.includes('[gpro-sync]'), 'log estruturado de consumo presente');
assert(syncRoute.includes('MAX_SPONSOR_ENRICHMENTS_PER_SYNC'), 'limite nomeado por sync presente');
assert(!syncRoute.includes('async function fetchGproJson'), 'gateway extraído da rota de sync');
assert(!syncRoute.includes('function mapTesting'), 'mapTesting extraído da rota de sync');
assert(syncRoute.includes('limitado a 10') === false, 'comentário incorreto sobre limite removido');

const gateway = read('app/lib/gpro-gateway.ts');
assert(gateway.includes('export async function fetchGproJson'), 'gateway compartilhado criado (app/lib/gpro-gateway.ts)');

const testingLib = read('app/lib/gpro-testing.ts');
assert(testingLib.includes('export function mapTesting'), 'mapper de Testing compartilhado criado');

const testingRoute = read('app/api/gpro/testing/route.ts');
assert(testingRoute.includes('export async function GET'), 'rota Testing possui GET (snapshot, 0 chamadas GPRO)');
assert(testingRoute.includes('export async function POST'), 'rota Testing possui POST (refresh leve)');
assert(/fetchGproJson\('Testing', token\)/.test(testingRoute), 'POST busca somente o endpoint Testing (1 chamada GPRO)');
assert(!testingRoute.includes("'/api/gpro/sync'"), 'rota Testing não depende do sync completo');

const snapshotLib = read('app/lib/gpro-snapshot.ts');
assert(snapshotLib.includes('export async function getLatestSnapshot'), 'helper de leitura de snapshot criado (somente leitura)');

const sponsorsLib = read('app/lib/gpro-sponsors.ts');
assert(sponsorsLib.includes('MAX_SPONSOR_ENRICHMENTS_PER_SYNC'), 'constante nomeada de limite presente');
assert(sponsorsLib.includes('export function needsSponsorEnrichment'), 'regra de seleção pura presente');
assert(sponsorsLib.includes('export function selectSponsorsForEnrichment'), 'seleção pura presente');
assert(sponsorsLib.includes('export function buildSponsorRow'), 'montagem de linha pura presente');
assert(sponsorsLib.includes('export function shouldRefreshAvailSponsors'), 'decisão refresh/reuso extraída (pura)');
assert(syncRoute.includes('shouldRefreshAvailSponsors'), 'rota usa a decisão pura de refresh/reuso');
assert(!syncRoute.includes('sameRaceAsLastAvail'), 'lógica inline removida da rota (agora pura)');

// ALFA-010 - Isolamento por user_id (leitura de snapshot nunca cruza usuários)
assert(/\.eq\('user_id',\s*userId\)/.test(snapshotLib), 'getLatestSnapshot filtra por user_id (isolamento)');
assert(/\.eq\('endpoint',\s*endpoint\)/.test(snapshotLib), 'getLatestSnapshot filtra por endpoint');
assert(testingRoute.includes('resolveUserId'), 'rota Testing resolve usuário no server-side');

// ALFA-010 - Dedup atômica de AvailSponsors (claim persistente)
const migration = read('supabase/migrations/20261017000001_gpro_sponsor_sync_state.sql');
assert(/create table if not exists public\.gpro_sponsor_sync_state/i.test(migration), 'migration cria gpro_sponsor_sync_state (idempotente)');
assert(/primary key \(user_id, season, race\)/i.test(migration), 'claim usa chave única (user_id, season, race)');
assert(/enable row level security/i.test(migration), 'claim tem RLS habilitada');
assert(!/create policy/i.test(migration), 'claim não expõe policies (somente service_role)');
assert(sponsorsLib.includes('isAvailSponsorsClaimExpired'), 'helper puro de expiração do claim presente');
assert(sponsorsLib.includes('AVAIL_SPONSORS_CLAIM_TTL_MS'), 'TTL do claim nomeado presente');

const claimLib = read('app/lib/gpro-sync-claim.ts');
assert(claimLib.includes('export async function acquireAvailSponsorsClaim'), 'lib expõe acquireAvailSponsorsClaim');
assert(claimLib.includes('export async function releaseAvailSponsorsClaim'), 'lib expõe releaseAvailSponsorsClaim');
assert(claimLib.includes("'23505'"), 'conflito de unicidade tratado explicitamente');
assert(claimLib.includes('.eq(\'claim_token\', existing.claim_token)'), 'takeover compara o token lido (atômico)');
assert(/taken\.length === 1/.test(claimLib), 'takeover confirma 1 linha atualizada');
assert(claimLib.includes('fail-open'), 'falha de infraestrutura é fail-open documentada');
assert(/\.eq\('claim_token', token\)/.test(claimLib), 'release restrito ao próprio token');
assert(syncRoute.includes('acquireAvailSponsorsClaim'), 'rota adquire o claim antes do refresh');
assert(syncRoute.includes('releaseAvailSponsorsClaim'), 'rota libera o claim ao final');
assert(/claim\.status === 'busy'/.test(syncRoute), 'rota trata execução concorrente (busy) sem chamar GPRO');

// ALFA-010 - UX da página Testes (loading, erro acionável, timestamp efetivo)
assert(testsPage.includes('isLoadingTesting'), 'página Testes expõe estado de carregamento');
assert(testsPage.includes('Carregando testes'), 'página Testes exibe estado de carregamento');
assert(testsPage.includes('testingError'), 'página Testes expõe estado de erro');
assert(testsPage.includes('role="alert"'), 'erro de atualização exibido de forma acessível');
assert(!testsPage.includes('data.createdAt || new Date().toISOString()'), 'página não fabrica o timestamp da atualização');
assert(testingRoute.includes('savedAt'), 'POST de Testing usa o timestamp efetivo da persistência');
assert(testingRoute.includes("getLatestSnapshot(userId, 'Testing')"), 'POST relê o snapshot salvo para o timestamp efetivo');
assert(!/createdAt: new Date\(\)\.toISOString\(\)/.test(testingRoute), 'POST não retorna mais o horário do cliente como timestamp principal');




// ============================================================
// 2) UNIT TESTS REAIS (helper compilado + mocks)
// ============================================================

let lib = null;
try {
  const buildDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gpro-sponsors-'));
  try {
    execSync(
      'npx tsc app/lib/gpro-sponsors.ts --outDir "' + buildDir +
      '" --module commonjs --target es2019 --skipLibCheck --esModuleInterop',
      { cwd: ROOT, stdio: 'pipe' }
    );
    lib = require(path.join(buildDir, 'gpro-sponsors.js'));
  } finally {
    fs.rmSync(buildDir, { recursive: true, force: true });
  }
} catch (e) {
  assert(false, 'falha ao compilar app/lib/gpro-sponsors.ts para os unit tests: ' + (e && e.message));
}

if (lib) {
  // --- a) needsSponsorEnrichment (mocks) ---
  assert(
    lib.needsSponsorEnrichment({ sponsorId: 10 }, { sponsor_id: 10, category: 'Automobilismo', country: 'br' }) === false,
    'patrocinador já enriquecido NÃO gera NegotiateSponsor'
  );
  assert(
    lib.needsSponsorEnrichment({ sponsorId: 11 }, { sponsor_id: 11, category: null, country: null }) === true,
    'patrocinador sem categoria/país gera NegotiateSponsor'
  );
  assert(
    lib.needsSponsorEnrichment({ sponsorId: 12 }, null) === true,
    'patrocinador inexistente no catálogo gera NegotiateSponsor'
  );
  assert(
    lib.needsSponsorEnrichment({ sponsorId: Number('x') }, null) === false,
    'sponsorId inválido não é selecionado'
  );

  // --- b) selectSponsorsForEnrichment com mocks ---
  const enrichedList = Array.from({ length: 20 }, (_, i) => ({ sponsorId: 100 + i }));
  const newList = Array.from({ length: 5 }, (_, i) => ({ sponsorId: 200 + i }));
  const enrichedMap = new Map(enrichedList.map(s => [s.sponsorId, { sponsor_id: s.sponsorId, category: 'X', country: 'br' }]));
  const fullList = [...enrichedList, ...newList];

  const selected = lib.selectSponsorsForEnrichment(fullList, enrichedMap, lib.MAX_SPONSOR_ENRICHMENTS_PER_SYNC);
  assert(selected.length === 5, 'apenas os 5 novos são selecionados (obtido ' + selected.length + ')');
  assert(selected.every(s => s.sponsorId >= 200), 'nenhum já enriquecido é selecionado');

  const steadyState = lib.selectSponsorsForEnrichment(fullList, new Map([...enrichedList, ...newList].map(s => [s.sponsorId, { sponsor_id: s.sponsorId, category: 'X', country: 'br' }])), lib.MAX_SPONSOR_ENRICHMENTS_PER_SYNC);
  assert(steadyState.length === 0, 'regime estável: 0 chamadas NegotiateSponsor');

  const capped = lib.selectSponsorsForEnrichment(
    Array.from({ length: 50 }, (_, i) => ({ sponsorId: 500 + i })),
    new Map(),
    3
  );
  assert(capped.length === 3, 'limite por sincronização respeitado (3)');

  // --- c) buildSponsorRow preserva dados válidos ---
  const rowFull = lib.buildSponsorRow(
    { sponsorId: 300, name: '', natCode: 'it' },
    { country: null, category: null, name: '' },
    { sponsor_id: 300, name: 'Patrocinador Antigo', category: 'Tecnologia', country: 'br', finances: 42 }
  );
  assert(rowFull.name === 'Patrocinador Antigo', 'nome existente preservado quando o novo está vazio');
  assert(rowFull.category === 'Tecnologia', 'categoria existente preservada quando não há detalhe');
  assert(rowFull.country === 'it', 'país novo (AvailSponsors) tem precedência sobre o existente');
  assert(rowFull.finances === 42, 'financeiro existente preservado quando não há dado novo');

  const rowKept = lib.buildSponsorRow(
    { sponsorId: 301, name: 'Novo Nome', finances: '' },
    null,
    { sponsor_id: 301, name: 'Antigo', category: 'Energia', country: 'us', finances: 7 }
  );
  assert(rowKept.country === 'us', 'país existente preservado sem detalhe');
  assert(rowKept.category === 'Energia', 'categoria existente preservada sem detalhe');
  assert(rowKept.name === 'Novo Nome', 'nome novo aplicado quando não vazio');
  assert(rowKept.finances === 7, 'valor vazio não sobrescreve o existente');

  // --- c2) shouldRefreshAvailSponsors (refresh vs reuso) ---
  assert(
    lib.shouldRefreshAvailSponsors({ lastSeason: 3, lastRace: 5, season: 3, race: 5 }) === false,
    'mesma corrida: NÃO atualiza AvailSponsors (reuso do snapshot)'
  );
  assert(
    lib.shouldRefreshAvailSponsors({ lastSeason: 3, lastRace: 5, season: 3, race: 6 }) === true,
    'corrida nova (race): atualiza AvailSponsors'
  );
  assert(
    lib.shouldRefreshAvailSponsors({ lastSeason: 3, lastRace: 5, season: 4, race: 1 }) === true,
    'corrida nova (temporada): atualiza AvailSponsors'
  );
  assert(
    lib.shouldRefreshAvailSponsors({ lastSeason: null, lastRace: null, season: 3, race: 5 }) === true,
    'sem snapshot anterior: atualiza AvailSponsors (1ª sync)'
  );
  assert(
    lib.shouldRefreshAvailSponsors({ lastSeason: 3, lastRace: 5, season: 3, race: 5, force: true }) === true,
    'refreshSponsors forçado: atualiza mesmo na mesma corrida'
  );
  assert(
    lib.shouldRefreshAvailSponsors({ lastSeason: 3, lastRace: 5, season: 0, race: 0 }) === true,
    'season/race ausentes no Office: atualiza (não reutiliza)'
  );
  assert(
    lib.shouldRefreshAvailSponsors({ lastSeason: null, lastRace: 7, season: 3, race: 7 }) === true,
    'snapshot sem temporada: não reutiliza'
  );
  assert(
    lib.shouldRefreshAvailSponsors({ lastSeason: 3, lastRace: 5, season: 3, race: 5, force: false }) === false,
    'force ausente/false mantém o comportamento otimizado'
  );

  // --- c3) isAvailSponsorsClaimExpired (recuperação por TTL) ---
  const NOW = 1_700_000_000_000;
  assert(
    lib.isAvailSponsorsClaimExpired(new Date(NOW - 1000).toISOString(), NOW) === false,
    'claim recente NÃO expira (exclusão mútua ativa)'
  );
  assert(
    lib.isAvailSponsorsClaimExpired(new Date(NOW - lib.AVAIL_SPONSORS_CLAIM_TTL_MS - 1).toISOString(), NOW) === true,
    'claim além do TTL expira (permite takeover)'
  );
  assert(
    lib.isAvailSponsorsClaimExpired(new Date(NOW - lib.AVAIL_SPONSORS_CLAIM_TTL_MS + 1).toISOString(), NOW) === false,
    'claim dentro do TTL ainda é válido (fronteira)'
  );
  assert(lib.isAvailSponsorsClaimExpired(null, NOW) === true, 'claim sem data é assumível');
  assert(lib.isAvailSponsorsClaimExpired('data-invalida', NOW) === true, 'claim com data inválida é assumível');

  // --- d) Simulação de consumo por sincronização completa ---
  // Base da rota de sync (endpoints sempre buscados) = 10 chamadas.
  const BASE_CALLS = 10;

  // 1ª sincronização (catálogo vazio, 20 patrocinadores, nova corrida)
  const firstCalls = BASE_CALLS
    + 1                                  // AvailSponsors (1x por corrida)
    + lib.selectSponsorsForEnrichment(enrichedList, new Map(), lib.MAX_SPONSOR_ENRICHMENTS_PER_SYNC).length; // 20

  // 2ª sincronização (mesma corrida, catálogo já completo)
  const secondCalls = BASE_CALLS
    + 0                                  // AvailSponsors reutilizado do snapshot
    + lib.selectSponsorsForEnrichment(enrichedList, enrichedMap, lib.MAX_SPONSOR_ENRICHMENTS_PER_SYNC).length; // 0

  // Corrida nova, catálogo completo
  const newRaceSteady = BASE_CALLS
    + 1
    + lib.selectSponsorsForEnrichment(enrichedList, enrichedMap, lib.MAX_SPONSOR_ENRICHMENTS_PER_SYNC).length;

  // Corrida nova com 3 patrocinadores inéditos
  const threeNew = Array.from({ length: 3 }, (_, i) => ({ sponsorId: 700 + i }));
  const newRaceThreeNew = BASE_CALLS
    + 1
    + lib.selectSponsorsForEnrichment([...enrichedList, ...threeNew], enrichedMap, lib.MAX_SPONSOR_ENRICHMENTS_PER_SYNC).length;

  assert(firstCalls === 31, '1ª sincronização: 31 chamadas (somente uma vez) — obtido ' + firstCalls);
  assert(secondCalls === 10, 'sincronizações seguintes caem para 10 chamadas — obtido ' + secondCalls);
  assert(newRaceSteady === 11, 'corrida nova com catálogo completo: 11 chamadas — obtido ' + newRaceSteady);
  assert(newRaceThreeNew === 14, 'corrida nova + 3 novos patrocinadores: 14 chamadas — obtido ' + newRaceThreeNew);

  const OLD_WORST_CASE = BASE_CALLS + 1 + 20; // versão anterior: sempre 11 + até 20 enriquecimentos
  assert(OLD_WORST_CASE === 31, 'baseline anterior documentado: 31 chamadas por sync');
  assert(secondCalls < OLD_WORST_CASE, 'regime estável abaixo do pior caso anterior — obtido ' + secondCalls + ' < 31');
  assert(newRaceThreeNew <= 25, 'cenário típico (corrida nova) dentro da faixa histórica: ' + newRaceThreeNew + ' <= 25');
  assert(newRaceSteady <= 25, 'corrida nova estável dentro da faixa histórica: ' + newRaceSteady + ' <= 25');
}

console.log('\n--- gpro-sync-consumption.test.js concluído ---');
