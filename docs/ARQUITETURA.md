# Arquitetura — Jornada Workflows Starter

## Visão geral

```
┌──────────────────────────────────────────────────────────────────┐
│                          Okta Tenant                             │
│                                                                  │
│  ┌─────────────┐  user.session.start  ┌──────────────────────┐   │
│  │   Usuário   │────────────────────► │   Event Hook         │   │
│  └─────────────┘                      └──────────┬───────────┘   │
│                                                  │               │
│                                                  ▼               │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │              Okta Workflows Console                        │  │
│  │                                                            │  │
│  │  Flow 1: Evaluator       (síncrono ao event hook)          │  │
│  │     ├─► Read User                                          │  │
│  │     ├─► Lookup CCT (Tables)                                │  │
│  │     ├─► Lookup Holiday (Tables)                            │  │
│  │     ├─► Decide ALLOWED / BLOCKED_*                         │  │
│  │     ├─► Write auth_log + violations (Tables)               │  │
│  │     ├─► Generate HMAC ack token                            │  │
│  │     └─► Email user + Slack + Email manager                 │  │
│  │                                                            │  │
│  │  Flow 2: Daily Reconciliation  (cron 06:00 BRT)            │  │
│  │     ├─► Process pending violations                         │  │
│  │     ├─► Push to ponto eletrônico API                       │  │
│  │     └─► Send daily digest                                  │  │
│  │                                                            │  │
│  │  Flow 3: Defesa Report  (API endpoint)                     │  │
│  │     ├─► Verify hash chain                                  │  │
│  │     └─► Generate ZIP + email to requester                  │  │
│  │                                                            │  │
│  │  Tables:                                                   │  │
│  │     - auth_log         (todos os eventos)                  │  │
│  │     - violations       (eventos fora do horário)           │  │
│  │     - holidays         (calendário de feriados)            │  │
│  │     - cct_rules        (regras por CCT)                    │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
                            │  HMAC link
                            ▼
        ┌─────────────────────────────────────────┐
        │   Acknowledgment Page (Next.js)         │
        │   ack.empresa.com.br                    │
        │                                         │
        │   - Renderiza form de confirmação       │
        │   - Valida HMAC server-side             │
        │   - POST /api/ack → Workflows webhook   │
        └─────────────────────────────────────────┘
                            │
                            ▼  ack callback
        ┌─────────────────────────────────────────┐
        │   Workflow inbound webhook              │
        │   (atualiza violation row)              │
        └─────────────────────────────────────────┘
                            │
                            ▼
        ┌─────────────────────────────────────────┐
        │   Sistema de Ponto Eletrônico           │
        │   (Pontomais / Tangerino / Senior)      │
        └─────────────────────────────────────────┘
```

## Por que essa separação

### Por que não tudo dentro do Workflows?

Workflows é ótimo para **orquestração** mas péssimo para:
- Renderizar UIs
- Validar assinaturas criptográficas com timing-safe compare
- Manipular estado complexo entre etapas

A página de ack precisa ser hospedada externamente. Por isso o Next.js separado.

### Por que não tudo fora do Workflows?

Você poderia fazer todo o sistema em Next.js + Postgres. Mas:
- Perde o handshake nativo com Okta Event Hooks (você teria que registrar webhook próprio, lidar com retry, dead letter, etc.)
- Perde a integração com Tables / Slack / Email cards
- Perde a possibilidade de admin de RH editar regras sem código

Workflows te dá orquestração de baixo código + integração nativa com Okta. Vale a pena.

### Por que HMAC e não JWT?

- HMAC é trivial de gerar/verificar em Workflows e em Node.js
- JWT exigiria biblioteca específica em Workflows (não tem nativa)
- Para tokens de uso único e curta duração, HMAC é suficiente

## Modelo de segurança

### Threat model

**Atacante 1: Funcionário tentando burlar.**
- Tentativa: copiar URL de ack de outro funcionário, alterar params
- Defesa: token HMAC inclui violationId + userId + expiry; assinatura inválida → 401

**Atacante 2: Admin tentando adulterar logs.**
- Tentativa: editar uma row de auth_log para esconder uma violação
- Defesa parcial: hash chain. Mas admin pode também regenerar hashes em massa.
- **Não cobre completamente.** Veja [`LIMITACOES.md`](LIMITACOES.md) §2.

**Atacante 3: Credencial comprometida (phishing).**
- Cenário: invasor tem credenciais de João, faz login às 02:00
- Defesa: violação dispara, ack chega no e-mail de João → ele rejeita → alerta de segurança P1
- **Esta é uma feature de segurança bonus**, não só compliance trabalhista

### LGPD considerations

Dados pessoais em jogo:
- Login, IP, user agent, dispositivo, horário de acesso
- Vinculados a registroFuncional (identifica univocamente)

Bases legais:
- **Cumprimento de obrigação legal** (CLT — controle de jornada)
- **Legítimo interesse** (segurança da informação)

Implementações necessárias:
- Política de privacidade do RH menciona o sistema
- Funcionário tem direito de solicitar relatório do **próprio** acesso (não de outros)
- Retenção: 6 anos (alinhado com prescrição quinquenal da CLT + 1 ano de folga)
- Não enviar para fora do Brasil sem cláusulas contratuais padrão

## Performance

| Métrica | Valor esperado | Limite |
|---------|---------------|---------|
| Latência do flow Evaluator | 2–4s | Workflows timeout: 30s |
| Throughput | ~50 exec/min | Cota da licença |
| Tamanho de auth_log/ano | ~5 MB / 100 usuários | Tables: sem hard limit publicado |
| Latência da página de ack | <500ms | Vercel Edge |

## Extensibilidade

### Adicionar novo CCT
1. Adicione linha em `cct_rules`
2. Documente o `cctCode` no enum do profile schema
3. Atribua usuários ao novo CCT

### Adicionar feriado custom (ex: aniversário da empresa)
1. Adicione linha em `holidays` com scope=NACIONAL ou via cctOverride

### Adicionar nova categoria de violação (ex: limite semanal de hora extra)
1. Estenda `cct_rules` com nova coluna
2. Adicione card no Evaluator que verifique a regra
3. Adicione novo `violationType` em violations

### Trocar provedor de ponto eletrônico
1. Edite Flow 02 — substitua o card de integração HTTP
2. Atualize formato do payload conforme docs do provedor

## Decisões de design e trade-offs

### Por que SHA-256 e não SHA-3?
SHA-256 é nativo no Workflows. SHA-3 exigiria custom function.

### Por que ack via e-mail e não push notification?
- E-mail é universal e arquivável
- Push exigiria mobile app (escopo grande)
- Workflows pode chamar SMS via Twilio se preferir

### Por que reativo (Event Hook) e não preventivo (Inline Hook)?
Inline Hooks exigem endpoint síncrono <3s, hospedado externamente, com SLA. Saem do escopo de "starter de baixo esforço". Esse é justamente o gap que justifica um produto comercial.

### Por que Brazilian Portuguese only?
Mercado-alvo é Brasil. Internacionalizar dobra escopo sem aumentar valor.

## Roadmap não-coberto neste starter

Veja [`LIMITACOES.md`](LIMITACOES.md). Os principais ausentes:
- Inline Hook preventivo (ao invés de Event Hook reativo)
- WORM + assinatura ICP-Brasil
- UI de admin para RH
- Multi-tenant
- CCT library mantida
