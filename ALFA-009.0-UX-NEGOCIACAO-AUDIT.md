# ALFA-009.0 — Auditoria UX dos indicadores de negociação

> **Tipo:** Auditoria somente leitura — nenhuma alteração de código, banco, API, RLS ou fórmula foi realizada nesta sprint.
> **Data:** 2026-09-16
> **Escopo:** Repaginação dos indicadores da página de patrocinadores (Atual/Médio/Líderes → Vantagem/Estimativa)

---

## 1. Resumo executivo

A repaginação é **viável exclusivamente com alteração de UX (camada de apresentação)**. Os três inputs necessários já existem e estão persistidos; a fórmula da vantagem já existe no backend e pode ser reinterpretada no frontend sem quebrar compatibilidade; a estimativa agregada dos demais é um cálculo derivado puro que não exige nova API, nova coluna ou nova migration. O único trabalho real é:

1. Renomear rótulos (sem mudar nomes de campos no Supabase).
2. Substituir o card único `Eficácia Estimada` por dois indicadores (`Vantagem na negociação` e `Estimativa dos demais/adversário`) com clamps e textos de incerteza corretos.
3. Priorizar o estado `Negociação concluída` quando `meuProgressoAtual === 100`.

Nenhum bloqueio técnico para web ou APK foi encontrado. O bundle não precisa crescer.

---

## 2. Arquivos analisados

| Arquivo | Papel | Linhas relevantes |
|---|---|---|
| `app/dashboard/sponsors/page.tsx:14` | Tipos `SponsorAttribute`, `CatalogSponsor`, `SavedSponsor` | `page.tsx:14,16,29` |
| `app/dashboard/sponsors/page.tsx:62-75` | Estado `attributes` (inputs) e `results.stats.diff` | `page.tsx:66,72` |
| `app/dashboard/sponsors/page.tsx:132-228` | Catálogo `gpro_sponsors` (somente leitura), autocomplete, `loadedSponsor`, `handleSelectCatalogSponsor` | `page.tsx:132,162,178,210` |
| `app/dashboard/sponsors/page.tsx:230-324` | Persistência `sponsors_database_json` via `syncWithSupabase`/`update_state` | `page.tsx:231,266` |
| `app/dashboard/sponsors/page.tsx:433-478` | Card `Atributos do Patrocinador` + `Progresso da Rodada` (MetricInput) | `page.tsx:433,467` |
| `app/dashboard/sponsors/page.tsx:517-541` | Card único atual `Eficácia Estimada` com clamp `Math.min(100,Math.max(0))` | `page.tsx:529` |
| `app/api/python/[[...route]]/route.ts:99-110` | Config `SPONSOR_CONFIG` (abas Excel) | `route.ts:99` |
| `app/api/python/[[...route]]/route.ts:489-524` | Cálculo sponsors: `B9/B10/B11` e `diff` + `lookup` answers | `route.ts:499,503,521` |
| `app/lib/db.ts:30,76,142,237` | `UserState.sponsors_database_json`, `getUserState`/`saveUserState` | `db.ts:76,148,255` |
| `app/context/GameContext.tsx` | Fonte única da verdade; não usado por sponsors (desacoplado, correto) | — |
| `supabase/migrations/*` / `gpro_sponsors` | Tabela catálogo somente leitura, RLS por `user_id` em `user_state` | ver `db.ts:148-152` |
| `capacitor.config.ts` / `package.json` | APK/Capacitor, dependências UI | — |
| `tests/alfa-*.test.js` | Testes existentes (segurança, regressão) | — |
| `components/*` / `app/components/*` | Cards, Badges, barras (`AttributeSlider`, `MetricInput`) | `page.tsx:730,762` |

Nenhum arquivo em `app/dashboard/sponsors/lib/` existe após ALFA-008.20 (IA removida). Não há `competitorPosition.ts`.

---

## 3. Fluxo atual dos dados

```
[GPRO Excel calculadora.xlsx] ──HyperFormula──┐
                                             │
[gpro_sponsors] ──Supabase (somente leitura) ─┼──> app/api/python/[[...route]] POST action=sponsors
                                             │         body: { finances, expectations, patience,
                                             │                 reputation, image, negotiation,
                                             │                 currentProgress, averageProgress, managers }
                                             │         B9=currentProgress, B10=averageProgress, B11=managers
                                             │         diff = (B9*B11-100)-(B10*B11-100)
                                             │         answers = lookup 5 colunas (image/expectations/patience)
                                             │         return { answers, stats:{diff} }
                                             │
                    page.tsx attributes ──────┼───────────────────────────────────────────────┐
                                              │                                               │
              user_state.sponsors_database_json (array SavedSponsor) ◄──syncWithSupabase──────┘
                        │  { id, sponsorId, sponsorName, name, source, attributes{1-7},
                        │    progress{current,average,managers}, results{diff}, date }
                        │
                        ▼
              page.tsx useState: attributes ──fetchSponsorData──► results ──► Cards
                                600ms debounce (page.tsx:261)
```

* **Catálogo:** `gpro_sponsors` lido via `supabase.from('gpro_sponsors').select(...).limit(100)` (`page.tsx:141`), filtrado localmente (`filteredCatalog`, `autocompleteSuggestions` com `useMemo`). Sem `raw_data` no frontend.
* **Persistência:** `GET /api/python?action=get_state` → `user_state.sponsors_database_json` (`page.tsx:114`), `POST update_state` com `sponsors_database` (`page.tsx:236`).
* **Reatividade:** qualquer `setAttributes` dispara `fetchSponsorData` → atualiza `answers` + `diff`. `handleSelectCatalogSponsor` e `loadFromDb` também trocam `loadedSponsor` e `attributes`.

---

## 4. Fórmulas atuais encontradas

### 4.1 Backend — `app/api/python/[[...route]]/route.ts:499-524`
```ts
const B9 = Number(body.currentProgress) || 0;   // meu progresso atual 0-100
const B10 = Number(body.averageProgress) || 0;  // progresso médio 0-100
const B11 = Number(body.managers) || 1;         // gerentes negociando 1-7
const diff = (B9 * B11 - 100) - (B10 * B11 - 100);
// equivalente a (B9 - B10) * B11
```
Evidência direta em `route.ts:503`. Fórmula está **apenas no backend**. Frontend apenas consome `stats.diff`.

### 4.2 Frontend — `app/dashboard/sponsors/page.tsx:529-531`
```ts
const raw = Number(results.stats.diff);
const safe = Number.isFinite(raw) ? Math.min(100, Math.max(0, raw)) : 0;
// exibido como `${safe>0?'+':''}${safe.toFixed(2)}%`
```
Clamp atual é `0..100` (não `-100..+100`). Valor bruto não é preservado em UI (apenas `results.stats.diff` em memória, mas não exibido). Não há segundo indicador (antiga `Diferença`/`Adversário` foi removida com a IA em ALFA-008.20, corretamente).

### 4.3 Respostas do patrocinador
`lookup` por `SPONSOR_CONFIG.REF_ROW_START_IDX + idx -1` (`route.ts:505-519`) usando `image/expectations/patience` → 5 respostas (`page.tsx:500-513`). Independente dos indicadores, não precisa mudar.

---

## 5. Diferenças entre o sistema atual e o conceito desejado

| Dimensão | Atual | Desejado | Gap |
|---|---|---|---|
| **Nomes dos inputs** | `Atual %`, `Médio %`, `Líderes` (`page.tsx:474-476`) | `Meu progresso atual`, `Progresso médio`, `Gerentes negociando` | Apenas renomeação de rótulo (`MetricInput label`). Nomes de campos `currentProgress/averageProgress/managers` podem permanecer internos. |
| **Indicador 1 nome** | `Eficácia Estimada` (`page.tsx:527`) | `Vantagem na negociação` | Renomeação + mudança de semântica (eficácia 0-100% → vantagem -100..+100). |
| **Indicador 1 cálculo** | `diff = (meu-medio)*gerentes` com clamp `0..100` | Mesmo `diff` bruto com clamp visual `-100..+100` (`Math.max(-100,Math.min(100,bruto))`) + preservar bruto | Ajuste de 1 linha de clamp. Fórmula bruta idêntica, apenas janela de exibição muda. |
| **Indicador 1 interpretação** | `safe>=50 verde / >0 âmbar / 0 vermelho`, sem texto de frente/atrás | Positivo = à frente, negativo = atrás, zero = alinhado + `Negociação concluída` quando `atual===100` | Novo branch condicional + badge/status. |
| **Indicador 2** | Inexistente (removido com IA, correto) | `Estimativa dos demais` = `(medio*gerentes)-meu` ; título dinâmico `Estimativa do adversário` (2) vs `Estimativa dos adversários` (3+) | Cálculo derivado puro no frontend, sem backend. Não existia, precisa ser criado como card novo. |
| **Limites** | Apenas `0..100`, descarta negativos | `-100..+100` para vantagem; estimativa sem clamp (preservar negativo) | Diferença intencional de UX. |
| **Incerteza** | Frase genérica `Estimativa baseada nos líderes` (`page.tsx:538`) | Texto explícito `Esta é uma estimativa agregada... progresso individual não é conhecido` | Trocar string de rodapé. |
| **Persistência** | `progress{current,average,managers}` e `results{diff}` já salvos (`page.tsx:277`) | Nenhuma coluna nova necessária; vantagem/estimativa são derivados e podem ser recalculados | Zero mudança de schema. |

Conclusão: o motor já fornece o bruto necessário; a diferença é **100% apresentação**.

---

## 6. Riscos

| Risco | Severidade | Mitigação |
|---|---|---|
| **Regressão de clamp** — mudar de `0..100` para `-100..+100` pode assustar usuários acostumados a ver sempre positivo | Baixa | Manter fórmula idêntica, apenas janela visual; adicionar tooltip explicando nova escala; preservar `raw` em `results.stats.diff` para auditoria. |
| **Confusão `vantagem=+100` vs `progresso=100%`** | Média | Quando `currentProgress===100`, sobrepor card com `Negociação concluída` (badge verde, desabilitar vantagem). Testar com `atual=100` (ver §15). |
| **Estimativa negativa mal interpretada** (`(50*2)-62=38` vs `(40*2)-62=-?`) | Baixa | Exibir sinal, não clampar; rodapé de incerteza obrigatório. |
| **Dados antigos com `results.opponentProgress`** | Baixa | Campo legado já preservado (`page.tsx:38` comentário) e ignorado; não afeta novos cálculos. `saveUserState` faz upsert parcial, não apaga histórico. |
| **Validação `isProgressValid`** bloqueia cálculo quando `managers` não é inteiro 1-7 | Baixa | Manter validação atual (`page.tsx:326-331`); exibir estado vazio `—` quando inválido, não `0%`. |
| **Duplicidade de fórmula** se alguém recalcular no frontend e divergir do backend | Média | Definir fonte única: backend continua calculando `diff` (oficial), frontend apenas deriva `estimativa` e aplica clamp visual. Não duplicar `diff`. |
| **Bundle** | Nulo | 2 cards + 1 fórmula `O(1)` não aumentam bundle. |

Nenhum risco exige migration, RLS ou contrato de API.

---

## 7. Impactos em API, banco e persistência

* **API `POST /api/python?action=sponsors`**: nenhum impacto. Continua retornando `{answers, stats:{diff}}`. Não precisa expor `estimativa` (derivável). Se desejado, poderia retornar bruto + clamp, mas não obrigatório.
* **API `GET/POST /api/python?action=get_state|update_state`**: já persiste `sponsors_database_json` como JSON (`db.ts:148,255`). Nenhuma coluna nova. Compatível com dados antigos (campo `results.diff` já existe; `opponentProgress` legado ignorado).
* **Tabela `gpro_sponsors`**: somente leitura (`page.tsx:141`). Não alterar. Catálogo global preservado.
* **RLS**: políticas por `user_id` em `user_state` (`db.ts:148 eq user_id`). Sponsors herda isolamento; sem mudança.
* **Compatibilidade:** `saveUserState` faz merge parcial (`db.ts:245-255`), não sobrescreve `driver_static` nem apaga `sponsors_database` antigo. Leitura de registros antigos sem `progress` ainda funciona (fallback para `attributes`).

**Veredito:** viável apenas com UX. Zero alteração de API/banco/persistência.

---

## 8. Impactos no APK (Capacitor)

* **Dependências UI:** `lucide-react`, `framer-motion`, `tailwind` já usados em `page.tsx:6,11`. Novos cards reutilizam `MetricInput`/`AttributeSlider` (`page.tsx:730,762`) e divs com `backdrop-blur` — todos já compatíveis com WebView do Capacitor.
* **JS puro:** cálculos `Math.max(-100,Math.min(100,bruto))` e `(medio*gerentes)-meu` são aritmética pura, sem `Intl`, `ResizeObserver`, `localStorage` ou APIs exclusivas de navegador.
* **Responsividade:** layout atual `grid-cols-1 lg:grid-cols-12` + `grid-cols-3` para progresso (`page.tsx:473`) já responsivo. Dois cards de indicadores empilhados em `lg:col-span-7` mantêm `min-w-0` e `overflow-hidden` — testar em 360px (ver §13).
* **Bundle:** +~200 bytes JS, 0 nova dependência. Build atual `✓ Compiled successfully in 16.8s` (`npm run build` já validado em ALFA-008.20/21).
* **Bloqueios:** nenhum. Não há `server-only` no client, não há `fs`, não há `better-sqlite3` (removido em ALFA-003).

---

## 9. Componentes que podem ser reutilizados

* `MetricInput` (`page.tsx:762`) — já valida `0-100` e `1-7`, exibe `suffix %` e `highlight`. Reutilizável para `Meu progresso atual / Progresso médio / Gerentes negociando` apenas trocando `label`.
* `AttributeSlider` (`page.tsx:730`) — barras 1-7 com cores `rose/amber/emerald`. Sem alteração.
* Estrutura de card `bg-white/90 border rounded-2xl shadow-sm backdrop-blur-sm` (`page.tsx:433,468,524`) — padrão repetido 4 vezes na página; pode virar `IndicatorCard` genérico mas não obrigatório.
* `filteredCatalog`/`autocompleteSuggestions` (`page.tsx:162,178`) — já filtram localmente, sem impacto nos novos indicadores.
* `loadedSponsor` banner (`page.tsx:439-455`) — exemplo de como exibir status dinâmico (reutilizável para `Negociação concluída`).

Nenhum componente compartilhado global precisa ser criado; reutilização é por cópia de padrão existente (baixo acoplamento, alta coesão — filosofia do projeto).

---

## 10. Componentes que precisam ser alterados

| Componente | Arquivo | Mudança |
|---|---|---|
| **Progresso da Rodada** — rótulos | `page.tsx:467-478` | `Atual %` → `Meu progresso atual`, `Médio %` → `Progresso médio`, `Líderes` → `Gerentes negociando`. Manter `field` keys internas. |
| **Card Eficácia** | `page.tsx:517-540` | Renomear para `Vantagem na negociação`. Trocar clamp `Math.min(100,Math.max(0))` → `Math.max(-100,Math.min(100,raw))`. Adicionar branch `if (attributes.currentProgress===100) → Negociação concluída`. Adicionar cores para negativo (rose), positivo (emerald), zero (slate) e preservação de `raw` para tooltip. |
| **Novo Card Estimativa** | `page.tsx:481-540` (nova seção) | Criar segundo card ao lado/abaixo da vantagem. Título dinâmico `managers===2 ? Estimativa do adversário : Estimativa dos adversários`. Valor `estimativa = (averageProgress*managers)-currentProgress` (sem clamp, preserva negativo). Rodapé fixo de incerteza. |
| **Validação** | `page.tsx:326` | Manter `isProgressValid`; quando inválido, mostrar `—` nos dois indicadores em vez de `0%` para não mascarar dado ausente. |
| **Testes** | `tests/` | Criar `sponsors-indicators.test.js` (ver §15). |

Nenhuma alteração em `route.ts`, `db.ts`, `supabase` ou `capacitor.config`.

---

## 11. Proposta de nova estrutura visual

```
[Header] Painel Comercial — Nuvem Sincronizada — [Buscar patrocinador...] [Salvar]
[Grid lg:12]

Col esquerda (lg:5)
  ┌ Atributos do Patrocinador ──────────────────┐
  │ [LoadedSponsor banner ou Nenhum carregado]  │
  │ Finanças ▓▓▓░░░░ 2/7 ... Negociação 6/7    │
  └─────────────────────────────────────────────┘
  ┌ Progresso da Rodada ────────────────────────┐
  │ Meu progresso atual [62 %]  Progresso médio [50 %]  Gerentes negociando [2] │
  └─────────────────────────────────────────────┘

Col direita (lg:7)
  ┌ Decisões Recomendadas ──────────────────────┐ (existente, inalterado)
  └─────────────────────────────────────────────┘
  ┌ Vantagem na negociação ─┬─ Estimativa dos adversários ┐  ← grid grid-cols-2 gap-3 (reuso do grid removido em ALFA-008.20)
  │ +24  (bruto +24)        │ 38                          │  ou +150 → +100 com badge "limitado"
  │ à frente da média       │ estimativa agregada...      │
  │ Negociação concluída*   │ incerteza rodapé            │
  └─────────────────────────┴─────────────────────────────┘
  * sobreposição quando atual===100

[Full width]
  Biblioteca de Análises (filtrada por sponsorName)
  Biblioteca em Nuvem (tabela filtrada localmente)
```

Mobile: `grid-cols-1` empilha vantagem/estimativa verticalmente (já usado em `AttributeSlider` e `Biblioteca`). Cores: `emerald` positivo, `rose` negativo, `slate` zero, `amber` aviso de limite.

---

## 12. Proposta de nomenclatura

| Antigo (Excel/herdado) | Novo (UX) | Onde aplicar |
|---|---|---|
| `Atual` / `Atual %` | `Meu progresso atual` | `MetricInput label` |
| `Médio` / `Médio %` | `Progresso médio` | `MetricInput label` |
| `Líderes` | `Gerentes negociando` | `MetricInput label` |
| `Eficácia` / `Eficácia Estimada` | `Vantagem na negociação` | Card título |
| `Diferença` / `Adversário` | `Estimativa do adversário` (2) / `Estimativa dos adversários` (3+) | Card título dinâmico |
| `diff` (interno) | `vantagemBruta` / `vantagemExibida` | Variáveis frontend (manter `stats.diff` na API para compatibilidade) |
| `opponentProgress` | removido (legado) | Não reintroduzir |

Manter chaves técnicas `currentProgress`, `averageProgress`, `managers` no `attributes` e `progress` para compatibilidade com `sponsors_database_json` antigo.

---

## 13. Casos-limite

| Caso | Entrada | Vantagem bruta | Vantagem exibida | Estimativa | Status |
|---|---|---|---|---|---|
| Equilibrado | 50,50,1 | 0 | 0 | 0 | Normal |
| Limite inferior | 0,100,2 | -200 → | -100 | 200 | Clamp vantagem, estimativa preservada |
| Limite superior | 100,0,7 | +700 → | +100 | -100 | Clamp vantagem |
| Negociação concluída | atual=100 | — | — | — | Priorizar badge `Negociação concluída` sobre vantagem |
| Vazio/inválido | NaN/undefined | — | `—` | `—` | `isProgressValid===false` → não mostrar `0%` |
| 2 gerentes | 62,50,2 | +24 | +24 | 38 | Título singular |
| 3 gerentes | 62,50,3 | +36 | +36 | 88 | Título plural, texto incerteza |
| Negativa preservada | 35,40,2 | -10 | -10 | 45 | Estimativa 45 (positiva) |
| Estimativa negativa | 80,30,2 | +100 → | +100 | -20 | Estimativa -20 preservada, sem clamp |

---

## 14. Plano de implementação por etapas

**Etapa 0 — Preparação (sem código)**
- [ ] Validar este audit com stakeholders.
- [ ] Congelar nomes finais da §12.

**Etapa 1 — Renomeação segura (UX-only, 1 commit)**
- [ ] Trocar `MetricInput label` em `page.tsx:474-476`.
- [ ] Renomear card `Eficácia Estimada` → `Vantagem na negociação` + clamp `-100..100`.
- [ ] Preservar `raw` em tooltip/`data-raw`.

**Etapa 2 — Novo indicador (UX-only, 1 commit)**
- [ ] Criar cálculo `estimativa = (averageProgress*managers)-currentProgress` em `useMemo` no frontend.
- [ ] Renderizar segundo card com título dinâmico por `managers`.
- [ ] Adicionar rodapé de incerteza fixo.

**Etapa 3 — Estado concluído (UX-only, 1 commit)**
- [ ] Branch `if (currentProgress===100) → Negociação concluída` (badge + desabilitar vantagem).

**Etapa 4 — Testes & validação (sem migration)**
- [ ] Criar `tests/sponsors-indicators.test.js` com 6 cenários da §15.
- [ ] `npx tsc --noEmit` + `npm run build` + testes manuais mobile/APK.

Cada etapa é reversível e não toca `route.ts:503`, `db.ts` ou `supabase`.

---

## 15. Testes recomendados

Criar `tests/sponsors-indicators.test.js` (puro JS, sem dependência de Supabase):

```js
function vantagem(atual, medio, gerentes){ return (atual-medio)*gerentes; }
function clampV(v){ return Math.max(-100, Math.min(100, v)); }
function estimativa(atual, medio, gerentes){ return (medio*gerentes)-atual; }

// 1) atual=62, medio=50, gerentes=2 → vantagem +24, estimativa 38
// 2) atual=35, medio=40, gerentes=2 → vantagem -10, estimativa 45
// 3) atual=62, medio=50, gerentes=3 → vantagem +36, estimativa 88
// 4) atual=90, medio=40, gerentes=3 → vantagem bruta +150, exibida +100
// 5) atual=100 → status negociação concluída (qualquer medio/gerentes)
// 6) estimativa=-10 → valor negativo preservado, sem clamp
// + casos: NaN → — , managers=1..7, atual=0/20/50/100, medio=0/50/100
```

Reutilizar padrão de `tests/sponsors-competitor.test.js` removido (ALFA-008.20) como referência. Testes existentes `alfa-001/002/003` permanecem válidos (não tocam sponsors).

---

## 16. Veredito técnico sobre a viabilidade

A arquitetura atual **já entrega os três dados confiáveis** (`currentProgress`, `averageProgress`, `managers`) como `number` validados (`page.tsx:312-324`), **já calcula a vantagem no backend** (`route.ts:503`), **já persiste os três campos** (`page.tsx:277 progress{current,average,managers}` + `db.ts:255 sponsors_database_json`) e **já filtra o catálogo localmente** sem novas APIs. Não há diferença entre dados da API, locais e manuais além da escala `0-6↔1-7` já tratada (`page.tsx:215`).

A alteração pode ser feita **apenas na camada de apresentação** trocando rótulos e clamps e derivando a estimativa no client. Não há risco de quebrar compatibilidade com dados antigos porque `progress` e `results.diff` são aditivos e `opponentProgress` legado é ignorado. Nenhum componente compartilhado precisa ser criado; `MetricInput` e o padrão de card já são reutilizáveis. Mobile/APK não são bloqueados.

### Viabilidade

* [x] Viável apenas com alteração de UX;
* [ ] Viável com alteração de UX e motor de cálculo;
* [ ] Exige alteração de persistência;
* [ ] Exige alteração de API;
* [ ] Há bloqueio técnico.

### Recomendação técnica

Implementar em **ALFA-009.1** seguindo o plano da §14, em 3 commits pequenos (renomeação → novo card → estado concluído), mantendo `route.ts:503` e `db.ts` intocados, preservando `stats.diff` como fonte única e calculando `estimativa` e `clamp -100..100` exclusivamente no frontend. Adicionar `data-raw` para auditoria e tooltip explicando `vantagem vs progresso real`.

### Próxima sprint sugerida

**ALFA-009.1 — Implementação UX dos indicadores de negociação** (estimada 1-2 dias):

1. Renomear inputs e card vantagem + clamp `-100..100`.
2. Criar card estimativa com título dinâmico e texto de incerteza.
3. Adicionar estado `Negociação concluída` + testes `sponsors-indicators.test.js` + validação `tsc`/`build`/`APK`.

Nenhuma migration, nenhum commit/push nesta auditoria (ALFA-009.0).

---

## Anexos — Evidências de leitura

* `page.tsx:66` estado inicial `currentProgress 50.0 / averageProgress 50.0 / managers 1` — confirma disponibilidade confiável.
* `page.tsx:326` `isProgressValid` — validação `0-100` e `1-7 integer` já existe, reutilizável.
* `route.ts:499-503` — B9/B10/B11 mapeados diretamente dos três inputs, sem `gpro_sponsors` ou `HyperFormula` para `diff`.
* `db.ts:76,255` — `sponsors_database: any[]` persiste sem schema, compatível com novos rótulos.
* `page.tsx:141,162` — `gpro_sponsors` lido com `limit 100` e filtrado localmente — sem necessidade de nova API para estimativa.
* `page.tsx:529` — clamp atual `0..100` é o único ponto que precisa virar `-100..100`.

