# Limitações do Jornada Workflows Starter

Esta página é importante. **Leia antes de implantar em produção.**

O starter resolve ~70% do problema de conformidade trabalhista digital com ~5% do esforço de uma solução dedicada. Mas as limitações são reais e algumas têm impacto jurídico significativo.

---

## 1. Reativo, não preventivo

**O problema:**
Event Hooks do Okta disparam **após** a autenticação ser bem-sucedida. Quando o flow roda e detecta a violação, o usuário **já tem sessão Okta válida** e pode acessar aplicações por minutos antes de a notificação chegar.

**Implicação jurídica:**
Em uma reclamatória, a defesa "nós detectamos e notificamos" é mais fraca do que "nós impedimos tecnicamente". A jurisprudência dá peso a controles preventivos efetivos.

**O que resolveria:**
Token Inline Hook do Okta — endpoint síncrono chamado **durante** a autenticação, com resposta em <3s. Workflows não pode atender Inline Hooks (latência e modelo de execução).

**Mitigação parcial no starter:**
Fluxo de "force re-auth" — após detecção, adicionar usuário a um grupo com session policy de 1 minuto. Reduz a janela de exposição mas não elimina.

---

## 2. Audit log não é prova legal robusta

**O problema:**
Okta Tables são **mutáveis**. Um administrador com permissão pode editar ou deletar linhas. A hash chain implementada ajuda — quem alterar uma linha quebra todas as subsequentes — mas:

- Não há timestamp de autoridade certificadora externa
- Não há assinatura digital ICP-Brasil
- O próprio admin que detecta a edição é também quem pode alterá-la
- Workflows não tem WORM (Write Once Read Many)

**Implicação jurídica:**
Em uma perícia técnica, o opositor pode argumentar que o log foi adulterado. A defesa precisará da palavra do CIO/CTO mais a integridade da hash chain — defensável mas não inquestionável.

**O que resolveria:**
- Export incremental (a cada hora) para S3 com Object Lock (WORM)
- Timestamping ICP-Brasil em cada export
- Notarização blockchain opcional (OpenTimestamps)
- Banco de dados append-only (Postgres com triggers anti-update + Postgres logical replication para WORM)

---

## 3. CCT é manual e desatualiza

**O problema:**
Cada Convenção Coletiva é renegociada anualmente. Centenas de cláusulas. 30.000+ CCTs ativas no Sistema Mediador do MTE. Mantê-las atualizadas em uma table manual é trabalho de tempo integral.

**No starter:** Você codifica os CCTs que importam para sua empresa. Quando o sindicato renegocia, você precisa lembrar de atualizar.

**O que resolveria:**
Biblioteca curada e atualizada por vendor especializado, com diff automático e alerta quando o CCT do seu funcionário muda.

---

## 4. Sem suporte real a turnos complexos

**O problema:**
O starter assume jornada fixa (08:00–18:00, MO–FR). A vida real:

- Escalas 12x36, 6x1, 5x2 — não suportadas
- Turnos noturnos com adicional noturno (22h–05h, 1h reduzida = 52'30")
- Horário flexível com banco de horas
- Sobreaviso e prontidão (regras diferentes de remuneração)
- Trabalho intermitente (Lei 13.467/17)

**Implicação:**
Para indústria, varejo, hospitais, segurança, telecom — o starter não cobre. Você terá falsos positivos (acessos legítimos sendo bloqueados) e negativos (acessos ilegais passando).

---

## 5. Sem integração nativa com ponto eletrônico

**O problema:**
O starter define como **deveria** integrar com Pontomais, Tangerino, Senior. Não implementa. Você terá que escrever a integração específica — APIs e formatos variam.

**Implicação:**
Sem integração, o ack do funcionário não vira efetivamente hora extra paga. É só um log. Você precisa que isso vire pagamento na folha.

---

## 6. Sem UI de administração

**O problema:**
Configurações ficam em Okta Tables. Editar uma escala ou exceção requer:
- Acesso ao Workflows Console
- Conhecimento da estrutura das tables
- Cuidado para não quebrar a hash chain ao editar manualmente

**Implicação:**
RH e Jurídico não conseguem se autoatender. Toda mudança passa por TI.

---

## 7. Sem multi-tenant / multi-empresa

**O problema:**
O starter assume uma empresa, um tenant Okta. Para grupos com múltiplas razões sociais, joint ventures, ou MSPs gerenciando vários clientes — não escala.

---

## 8. Sem relatório verdadeiramente "defesa-ready"

**O problema:**
O flow `03-defesa-report` exporta CSV. Não:
- Não é PDF assinado digitalmente
- Não tem cabeçalho formatado para Justiça do Trabalho
- Não tem certidão de integridade técnica
- Não tem tradução juramentada de termos técnicos

**Implicação:**
Seu advogado trabalhista vai precisar de tempo extra para transformar o CSV em peça de defesa. Em uma reclamatória cara, isso pode custar mais do que o starter economiza.

---

## 9. Limites de execução do Workflows

**O problema:**
A licença básica de Workflows tem cota de execuções. Cada autenticação = 1 execução. Empresas com:
- 1.000 funcionários × 5 logins/dia = 5.000 exec/dia = 150k/mês
- Probabilidade alta de estourar cota

**Mitigação:**
Upgrade para Workflows Enterprise (mais caro). Ou mover lógica crítica para serviço externo.

---

## 10. Sem direito à desconexão de canais não-Okta

**O problema crítico:**
Bloquear Okta resolve só o que passa pelo Okta. Ainda restam:
- WhatsApp do gestor cobrando trabalho
- Slack/Teams se não estiverem atrás do Okta
- E-mail pessoal recebendo cópia de algo de trabalho
- Ligações telefônicas

**Implicação jurídica:**
A maioria das reclamatórias por violação ao direito à desconexão se baseia em **WhatsApp do gestor**, não em login no Okta. Bloquear Okta é necessário mas não suficiente.

**O que resolveria:**
Política interna escrita + treinamento de gestores + cultura organizacional. Tecnologia é só uma camada.

---

## Quando o starter É suficiente

- ✅ Empresa < 500 funcionários
- ✅ Categoria profissional única (CLT padrão)
- ✅ Horários simples e estáveis
- ✅ Baixo histórico de reclamatórias
- ✅ Equipe de TI confortável com Workflows
- ✅ Cultura organizacional já alinhada com direito à desconexão

## Quando você precisa de mais

- ❌ > 1.000 funcionários
- ❌ Múltiplos CCTs coexistindo
- ❌ Operação 24/7 com escalas
- ❌ Histórico de reclamatórias caras
- ❌ Setor regulado (financeiro, saúde, telecom)
- ❌ Jurídico exige evidência criptograficamente robusta
- ❌ Operação multi-empresa / grupo econômico

Para esses casos, considere uma solução dedicada — seja Conecta Suite (para foco em Google Workspace), uma plataforma maior (Senior Sistemas / TOTVS), ou Jornada Pro quando estiver disponível.

---

**Disclaimer final:** Este projeto é uma ferramenta. Conformidade trabalhista é uma prática contínua que envolve política, comunicação, treinamento e cultura. Tecnologia sozinha nunca resolve.
