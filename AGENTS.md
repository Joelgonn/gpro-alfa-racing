# AGENTS.md
# GPRO Alfa Racing Brasil
# Manual de Engenharia do Projeto

---

# Objetivo

Este projeto NÃO é apenas um cliente para a API da GPRO.

Seu objetivo é construir uma plataforma de engenharia para tomada de decisões baseada em conhecimento.

Toda alteração deve preservar essa visão.

---

# Idioma

Toda comunicação deve ser realizada em português do Brasil.

Nunca responder em inglês, exceto quando solicitado explicitamente.

Comentários de código podem permanecer em inglês quando seguirem padrões da comunidade.

---

# Filosofia

Antes de modificar qualquer arquivo:

- compreender o contexto;
- identificar impactos;
- preservar compatibilidade.

Nunca fazer grandes refatorações sem necessidade.

Mudanças pequenas são preferidas.

Sempre preservar o funcionamento existente.

---

# Regra número 1

O gerente nunca pode perder funcionalidades.

Toda evolução deve ser incremental.

Nunca quebrar funcionalidades existentes.

Nunca remover comportamento utilizado pelo usuário.

Compatibilidade é prioridade.

---

# Arquitetura

Este projeto segue evolução incremental.

Sempre preferir:

Strangler Fig Pattern

ao invés de grandes reescritas.

Código legado só deve ser removido quando o novo fluxo estiver totalmente validado.

---

# Filosofia da Knowledge Platform

A Knowledge Platform NÃO é outro cliente da GPRO.

Ela é um observador.

Ela observa o Sync.

Nunca deve fazer chamadas duplicadas para a API da GPRO.

Todo conhecimento nasce do payload bruto recebido pelo Sync.

---

# Payload bruto

O payload bruto é o maior ativo do projeto.

Nunca descartá-lo.

Nunca reduzir informações antes da captura.

Sempre armazenar observações preservando o máximo possível do payload.

---

# Explorer

Explorer NÃO pertence ao domínio do jogo.

Explorer é um domínio observacional.

Ele:

- observa;
- analisa;
- aprende.

Ele nunca controla o jogo.

---

# Separação de responsabilidades

Sync:

responsável por importar.

Knowledge:

responsável por observar.

Explorer:

responsável por explorar.

GameContext:

responsável por fornecer estado do jogo.

Esses módulos possuem responsabilidades diferentes.

---

# GameContext

GameContext é a fonte única da verdade.

Nunca criar estados paralelos.

Nunca duplicar informações.

Sempre consumir GameContext quando a informação pertencer ao domínio do jogo.

---

# Knowledge Base

A Knowledge Base:

- não interfere no jogo;
- não modifica decisões;
- não controla Sync;
- não altera Setup;
- não altera Strategy.

Ela apenas aprende.

---

# Explorer

Explorer deve permanecer desacoplado do domínio.

Nunca depender de:

GameContext

Strategy

Driver

Car

Setup

Explorer trabalha sobre observações.

---

# Observatory

Observatory registra fatos.

Nunca opiniões.

Nunca deduções.

Observações devem representar fatos ocorridos.

---

# Capture Layer

Capture Layer deve registrar eventos exatamente como chegaram.

Sem transformação de domínio.

Sem perda de informação.

---

# Reference Layer

Reference Layer organiza conhecimento.

Nunca altera payloads.

Nunca altera observações.

---

# Fingerprint

Fingerprints identificam eventos.

Nunca representam regras de negócio.

São apenas identificadores.

---

# Research

Research representa conhecimento produzido.

Não representa dados brutos.

---

# Driver

Driver representa o estado do piloto.

Nunca armazenar decisões de pesquisa dentro do Driver.

---

# Fuel

Fuel representa apenas cálculos de combustível.

Não misturar com Setup.

---

# Tyres

Tyres representa apenas cálculos relacionados aos pneus.

---

# Weather

Weather deve utilizar dados oficiais.

Nunca gerar clima artificial.

---

# Strategy

Strategy produz decisões.

Nunca produzir observações.

---

# Setup

Setup calcula configuração.

Nunca misturar regras de pesquisa.

---

# Banco de Dados

Sempre preservar compatibilidade.

Nunca remover colunas existentes.

Nunca alterar migrations antigas.

Criar novas migrations.

---

# API

Nunca alterar contratos públicos sem necessidade.

Sempre manter compatibilidade.

---

# Refatorações

Antes de refatorar:

- explicar objetivo;
- explicar impacto;
- explicar riscos.

Evitar refatorações cosméticas.

---

# Código

Prioridades:

1. Clareza

2. Simplicidade

3. Baixo acoplamento

4. Alta coesão

5. Compatibilidade

---

# TypeScript

Evitar any.

Preferir tipos existentes.

Criar novos tipos apenas quando realmente necessários.

---

# Performance

Evitar:

duplicação

consultas repetidas

processamentos desnecessários

renderizações desnecessárias

---

# Supabase

Não alterar estrutura sem necessidade.

Preservar compatibilidade.

---

# UI

A UX existente deve ser preservada.

Nunca quebrar páginas existentes.

---

# Commits

Commits devem ser pequenos.

Cada commit deve representar apenas uma mudança lógica.

---

# Comunicação

Antes de alterar:

explicar.

Depois de alterar:

informar:

- arquivos modificados;

- motivo;

- impacto;

- riscos.

---

# Quando houver dúvida

Nunca inventar.

Perguntar.

---

# O que evitar

Não criar novas camadas sem necessidade.

Não criar abstrações desnecessárias.

Não criar serviços apenas porque "fica bonito".

Toda nova camada deve:

- remover duplicação;

ou

- reduzir acoplamento;

ou

- melhorar testes;

ou

- representar um conceito real do domínio.

Caso contrário, reutilizar a estrutura existente.

---

# Filosofia final

Este projeto evolui continuamente.

Toda mudança deve deixar o sistema:

mais simples,

mais organizado,

mais fácil de manter,

sem perder compatibilidade,

sem perder conhecimento,

e sem alterar o comportamento esperado pelo gerente.