# Guia de Instalação — Jornada Workflows Starter

Tempo estimado: **30–60 minutos** para uma instalação básica.

## Pré-requisitos

- Tenant Okta com licença **Workflows** (Identity Engine recomendado)
- Acesso de **Super Admin**
- Node.js 20+ instalado localmente
- Conta na Vercel, Railway ou similar (para hospedar a página de ack)
- (Opcional) Conta no Slack para notificações
- Acesso ao admin do seu sistema de ponto eletrônico (Pontomais, Tangerino, Senior)

## Etapa 1 — Schema customizado de usuário (5 min)

1. No Okta Admin Console, vá em **Directory → Profile Editor → User (default)**
2. Clique em **Add Attribute** para cada campo definido em [`okta/profile-schema/user-profile-extension.json`](../okta/profile-schema/user-profile-extension.json)
3. Confira que cada attribute tem:
   - Display name em português (ex: "Início do expediente")
   - Variable name conforme o JSON (ex: `workScheduleStart`)
   - Permissions: `Read-only` para SELF; `Read-write` para Admin
4. Para `cctCode` e `userTimezone`, use o tipo "Enum" e cole os valores do JSON

**Validação:**
- Crie um usuário de teste em `Directory → People → Add Person`
- Verifique que os novos atributos aparecem no formulário
- Preencha com um horário de teste (ex: 08:00–18:00, MO,TU,WE,TH,FR, America/Sao_Paulo, CLT_PADRAO)

## Etapa 2 — Okta Tables (10 min)

1. No Okta Workflows Console, vá em **Tables**
2. Crie uma table para cada arquivo em [`okta/tables/`](../okta/tables/):
   - `auth_log` — colunas conforme `auth_log.json`
   - `violations` — colunas conforme `violations.json`
   - `holidays` — colunas conforme `holidays.json`
   - `cct_rules` — colunas conforme `cct_rules.json`

3. **Carregue o seed de feriados:**
   - Em `holidays`, use **Import CSV** e suba [`okta/tables/holidays-seed-2026.csv`](../okta/tables/holidays-seed-2026.csv)
   - Adicione feriados estaduais e municipais conforme localização da sua empresa

4. **Carregue os CCTs iniciais:**
   - Em `cct_rules`, adicione manualmente as duas linhas exemplo do `cct_rules.json` (ou só `CLT_PADRAO` se sua empresa não tem CCTs específicos)
   - **Importante:** os valores do CCT exemplo (`BANCARIOS_SP_2025`) são ilustrativos. Valide com a CCT vigente real.

## Etapa 3 — Implantar a página de Acknowledgment (10 min)

1. Na sua máquina:
   ```bash
   cd acknowledgment-page
   cp .env.example .env.local
   ```
2. Gere a HMAC_KEY:
   ```bash
   openssl rand -base64 32
   ```
   Cole no `.env.local` e **guarde também** — você usará a mesma chave no Workflow.

3. Implante na Vercel:
   ```bash
   npx vercel --prod
   ```
   - Configure as env vars na Vercel: `HMAC_KEY`, `WORKFLOWS_INBOUND_URL`, `WORKFLOWS_API_KEY`
   - Anote a URL final (ex: `https://jornada-ack-empresa.vercel.app`)

4. **Domínio customizado (recomendado):** configure `ack.empresa.com.br` apontando para a Vercel. Funcionários confiam mais em URLs do próprio domínio.

> Você só vai conseguir preencher `WORKFLOWS_INBOUND_URL` depois da Etapa 4. Volte aqui e atualize as env vars depois.

## Etapa 4 — Importar os Flows (15 min)

Os flows estão documentados como especificações JSON em [`flows/`](../flows/). Para implementá-los no Workflows Console:

### Opção A — Reconstruir manualmente (recomendado para entender)
Abra cada arquivo JSON e siga os passos de cada `card`. O Workflows Console tem o equivalente de cada card descrito.

### Opção B — Pacote .flopack (em desenvolvimento)
Pacotes binários `.flopack` para importação direta estão sendo construídos. Acompanhe [issues do repositório](https://github.com/calademos/jornada-workflows-starter/issues).

### Configuração de secrets para os flows

No Workflows Console, vá em **Settings → Secrets** e adicione:

| Nome | Valor |
|------|-------|
| `HMAC_KEY` | Mesmo valor da Vercel |
| `ACK_PAGE_DOMAIN` | `https://ack.empresa.com.br` |
| `SLACK_WEBHOOK_URL` | Webhook do canal #compliance-trabalhista |
| `RH_EMAIL` | rh@empresa.com.br |
| `JURIDICO_EMAIL` | juridico@empresa.com.br |

### Configurar o flow 03 como API Endpoint
1. Em `03-defesa-report`, configure o trigger como **API Endpoint**
2. Copie a URL do endpoint
3. Crie uma API Key e dê **apenas** a 2-3 pessoas de Jurídico/RH sênior
4. Documente o uso em runbook interno

## Etapa 5 — Configurar o Event Hook (5 min)

1. No Okta Admin Console: **Workflow → Event Hooks → Create Event Hook**
2. Configure:
   - **Name:** Jornada Evaluator
   - **URL:** URL do trigger do flow `01-evaluator` (Workflows fornece quando você publica o flow)
   - **Authentication:** Header com API key compartilhada
   - **Events:** `User session start`
3. Verify o event hook (Okta envia request de teste)
4. Active o hook

## Etapa 6 — Validação end-to-end (10 min)

**Teste 1 — Acesso dentro do horário (deve permitir):**
1. Use o usuário de teste com horário 08:00–18:00
2. Faça login durante esse intervalo
3. Verifique em `auth_log`: deve haver linha com `decision = ALLOWED`

**Teste 2 — Acesso fora do horário (deve disparar ack):**
1. Mude temporariamente o horário do usuário de teste para algo que NÃO inclua o agora (ex: 02:00–04:00)
2. Faça login
3. Verifique:
   - `auth_log` tem linha com `decision = BLOCKED_OFF_HOURS`
   - `violations` tem nova linha com `status = PENDING_ACK`
   - O usuário recebeu e-mail com link de acknowledgment
   - Slack recebeu notificação

**Teste 3 — Confirmação de hora extra:**
1. Clique no link do e-mail
2. Página renderiza com nome, horário, etc.
3. Clique em "Confirmo: estou fazendo hora extra"
4. Verifique:
   - Página mostra "Confirmado"
   - `violations` row foi atualizada para `status = ACKNOWLEDGED`, `ackReceivedAt` preenchido

**Teste 4 — Rejeição (segurança):**
1. Repita teste 2 com um novo evento
2. Clique em "Não estou trabalhando"
3. Confirme no diálogo
4. Verifique:
   - `violations` row foi atualizada para `status = REJECTED_BY_USER`
   - Alerta P1 disparado para sec@empresa.com.br

**Teste 5 — Reconciliação (executar manualmente):**
1. No Workflows Console, dispare o flow `02-daily-reconciliation` manualmente
2. Verifique:
   - Violações ACKNOWLEDGED foram enviadas ao ponto eletrônico
   - Violações PENDING_ACK foram escaladas
   - Resumo diário foi enviado por e-mail

## Etapa 7 — Rollout para produção

**Não ative para todos de uma vez.** Sequência recomendada:

1. **Semana 1:** Apenas equipe de TI/RH (10–20 pessoas). Coleta de feedback.
2. **Semana 2:** Um departamento piloto (50–100 pessoas).
3. **Semana 3:** Comunicação interna ampla. CEO/RH explicando o motivo.
4. **Semana 4:** Rollout para toda a empresa.

**Comunicação obrigatória ANTES de ativar:**
- Comunicado explicando o sistema
- Atualização do regulamento interno
- Treinamento para gestores
- (Recomendado) Aviso aos sindicatos relevantes

## Troubleshooting

### "Event Hook não dispara"
- Verifique se o hook está **Active** (não apenas Verified)
- Cheque os logs do Okta System Log: filtre por `system.api_token.create` e `system.event_hook.*`

### "Flow demora >3 segundos"
- Reduza chamadas a Tables (cache em variáveis dentro do flow)
- Considere upgrade para Workflows Enterprise se você está estourando quota

### "Hash chain não bate"
- Cada row precisa ler `previousHash` da row anterior antes de escrever
- Workflows não tem locking nativo: se dois flows rodarem simultaneamente, podem grravar com o mesmo `previousHash`. Para tenants alta-volume, mova hash chain para fora (Postgres com transação)

### "Email não chega"
- Verifique SPF/DKIM/DMARC do domínio
- Para volumes altos, use SendGrid/Postmark/Resend ao invés de Okta Email card

## Próximos passos

- Leia [`LIMITACOES.md`](LIMITACOES.md) para saber o que este starter NÃO resolve
- Leia [`ARQUITETURA.md`](ARQUITETURA.md) se quiser estender ou adaptar
- Considere [Jornada Pro](https://github.com/calademos/jornada-workflows-starter#) se você bate em algum dos limites listados
