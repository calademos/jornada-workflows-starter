# Jornada — Okta Workflows Starter para Conformidade com a CLT

> Template open-source para empresas brasileiras que usam **Okta** e precisam controlar acesso fora do horário de expediente, evitando passivos trabalhistas (horas extras, sobreaviso, danos morais por violação do direito à desconexão).

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Okta Workflows](https://img.shields.io/badge/Okta-Workflows-blue.svg)](https://www.okta.com/products/workflows/)
[![Made in Brazil](https://img.shields.io/badge/Made%20in-Brazil-009c3b.svg)](#)

## O problema

A jurisprudência da Justiça do Trabalho tem reconhecido que o simples acesso de funcionários a ferramentas corporativas (e-mail, Slack, VPN, sistemas internos) **fora do horário de expediente** pode configurar:

- **Horas extras** (Art. 59 da CLT) — quando há trabalho efetivo
- **Sobreaviso** (Súmula 428 do TST) — quando há disponibilidade exigida, pago a 1/3 da hora normal
- **Danos morais existenciais** — quando há violação habitual do direito à desconexão
- **Rescisão indireta** (Art. 483 da CLT) — em casos extremos

Este repositório fornece um **starter completo** para implementar controle de acesso CLT-compliant usando **Okta Workflows** — sem precisar comprar uma ferramenta dedicada.

## O que está incluído

```
jornada-workflows-starter/
├── flows/                          # Workflows exportados (.flopack)
│   ├── 01-evaluator.flopack        # Avalia cada autenticação
│   ├── 02-daily-reconciliation.flopack
│   └── 03-defesa-report.flopack    # Relatório para Justiça do Trabalho
├── okta/
│   ├── profile-schema/             # Atributos customizados de usuário
│   └── tables/                     # Schemas das Okta Tables
├── acknowledgment-page/            # Next.js app: "Confirmo hora extra"
└── docs/
    ├── INSTALACAO.md               # Setup passo a passo
    ├── ARQUITETURA.md              # Como funciona
    └── LIMITACOES.md               # ⚠️ Leia antes de implantar
```

## Como funciona

```
┌─────────────────────────────────────────────────────────┐
│  1. Funcionário tenta logar via Okta às 22h de sábado   │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│  2. Okta dispara Event Hook (user.session.start)        │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│  3. Workflow "Evaluator" verifica:                      │
│     - Horário contratado do usuário                     │
│     - Dia da semana / feriado                           │
│     - CCT aplicável                                     │
│     - Isenção do Art. 62 da CLT                         │
└─────────────────────────────────────────────────────────┘
                          │
              ┌───────────┴───────────┐
              ▼                       ▼
       ┌─────────────┐        ┌──────────────────┐
       │  Permitido  │        │  Fora do horário │
       │  Log: ALLOW │        │  → Notifica RH   │
       └─────────────┘        │  → Adiciona em   │
                              │    grupo "ack"   │
                              │  → Envia link    │
                              └──────────────────┘
                                       │
                                       ▼
                              ┌──────────────────┐
                              │ Funcionário      │
                              │ confirma hora    │
                              │ extra na página  │
                              │ → Status: ACK    │
                              │ → Calcula minutos│
                              │ → Envia ao ponto │
                              └──────────────────┘
```

## Quick start

**Pré-requisitos:**
- Tenant Okta com licença de Workflows
- Permissão de Super Admin
- Node.js 20+ (para a página de acknowledgment)
- Vercel/Railway/qualquer host (para a página)

**Setup em 30 minutos:**

1. **Importe o schema de perfil** (`okta/profile-schema/user-profile-extension.json`)
   ```
   Okta Admin Console → Directory → Profile Editor → User (default) → Add Attribute
   ```

2. **Crie as Okta Tables** (`okta/tables/`)
   - `auth_log` — todos os eventos de autenticação
   - `violations` — eventos fora do horário
   - `holidays` — feriados nacionais/estaduais/municipais
   - `cct_rules` — regras de convenção coletiva

3. **Importe os flows** (`flows/*.flopack`)
   ```
   Okta Workflows Console → Flows → Import Flowpack
   ```

4. **Implante a página de acknowledgment**
   ```bash
   cd acknowledgment-page
   npm install
   vercel deploy
   ```

5. **Configure o Event Hook** apontando para o flow Evaluator

Detalhes completos em [`docs/INSTALACAO.md`](docs/INSTALACAO.md).

## ⚠️ Limitações importantes

Este starter resolve **~70% do problema** com **~5% do esforço** de uma solução dedicada. As limitações estão documentadas em [`docs/LIMITACOES.md`](docs/LIMITACOES.md), mas as principais:

| Limitação | Impacto |
|-----------|---------|
| **Reativo, não preventivo** | Event Hooks disparam *após* a autenticação. O usuário já acessou os dados quando o log é gerado. Defesa jurídica mais fraca. |
| **Sem audit chain criptográfica** | Okta Tables não são append-only. Um admin com permissão pode editar linhas. Hash chain ajuda mas não é prova legal robusta. |
| **CCT é manual** | Cada Convenção Coletiva precisa ser codificada manualmente nas tables. Renegociações anuais quebram a configuração. |
| **Sem UI para o funcionário** | A página de ack é separada e precisa ser hospedada por você. |
| **Sem relatório "defesa-ready"** | O export é CSV. Para Justiça do Trabalho, você precisa de PDF assinado, com timestamps de autoridade certificadora. |
| **Limites de execução do Workflows** | Tenants com 100k+ autenticações/dia podem estourar quota. |

**Quando este starter é suficiente:**
- Empresa com até ~500 funcionários
- Categoria profissional única (ex: só CLT padrão, sem CCTs específicos)
- Horários simples (8h-18h, segunda a sexta)
- Equipe de TI confortável mantendo Workflows
- Risco trabalhista moderado (não há histórico de reclamatórias caras)

**Quando você precisa de algo mais robusto:**
- Múltiplos CCTs (bancários, comerciários, metalúrgicos coexistindo)
- Operações 24/7 com escalas de sobreaviso
- Histórico de reclamatórias trabalhistas significativas
- Necessidade de relatórios para Justiça do Trabalho
- Mais de 1.000 funcionários
- Compliance officer / Jurídico exigindo evidência legalmente robusta

Para esses casos, considere [Jornada Pro](#) — versão hospedada com rules engine de CLT, biblioteca de CCTs, audit chain criptográfica e relatórios defesa-ready. *(Em desenvolvimento.)*

## Contribuindo

Aceitamos PRs! Especialmente:

- **CCTs codificados** — se você tem expertise em uma categoria (bancários, petroleiros, telemarketing, etc.), envie a regra como JSON
- **Calendários de feriados** — feriados estaduais e municipais
- **Traduções** — README em inglês para outros mercados latino-americanos com legislação similar
- **Bug fixes** nos flows

## FAQ

**Posso usar isso em produção?**
Sim, com as ressalvas acima. Vários componentes são apenas "good faith" — não são prova legal robusta. Se você está em uma indústria de alto risco trabalhista (bancário, varejo, telemarketing), use isto como prototipagem e migre para uma solução dedicada.

**E se o funcionário precisar trabalhar fora do horário em emergência?**
O fluxo permite isso via "acknowledgment" — o funcionário declara que está fazendo hora extra, registra eletronicamente, e o sistema computa para o ponto. Isso transforma um sobreaviso ambíguo em uma hora extra explícita e devidamente paga.

**O Art. 62 da CLT (isenção de controle de jornada) está coberto?**
Sim. Usuários com `exemptArt62 = true` no perfil são pulados pelo Evaluator. Use isso para gerentes, cargos de confiança e teletrabalho por produção.

**E o trabalho remoto / home office?**
A Lei 14.442/2022 e Art. 6º da CLT equiparam trabalho remoto a presencial para fins de jornada. O sistema funciona igualmente — o controle é por horário, não por localização.

**Preciso da licença Enterprise do Okta Workflows?**
A versão básica do Workflows funciona para até ~50 usuários. Acima disso, você provavelmente precisará da licença Enterprise por questões de quota de execução.

## Licença

MIT. Use, modifique, redistribua à vontade. Sem garantia, sem responsabilidade — você é responsável pela conformidade trabalhista da sua empresa.

## Sobre

Construído por [Matt](https://github.com/) — Senior Solutions Engineer especializado em IAM (Okta, Auth0) atuando no mercado brasileiro.

Se este starter foi útil, considere:
- ⭐ dar uma estrela no repositório
- 🐛 abrir issues com bugs ou sugestões
- 💬 entrar em contato para falar sobre o produto hospedado

---

**Disclaimer:** Este projeto não constitui aconselhamento jurídico. Consulte advogado trabalhista para validar a aderência da implementação à sua realidade específica.
