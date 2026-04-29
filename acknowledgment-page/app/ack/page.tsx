import { headers } from 'next/headers';
import AckForm from './AckForm';

/**
 * Página de acknowledgment de hora extra
 *
 * URL: /ack?t={hmacToken}&v={violationId}
 *
 * Validações server-side:
 * 1. Token HMAC válido (assinado com HMAC_KEY do Workflows)
 * 2. Token não expirado (24h)
 * 3. violationId existe
 *
 * Ao confirmar, chama /api/ack que devolve resposta ao Workflow via webhook inbound.
 */

interface PageProps {
  searchParams: Promise<{ t?: string; v?: string }>;
}

export default async function AckPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const token = params.t;
  const violationId = params.v;

  if (!token || !violationId) {
    return <ErrorState message="Link inválido. Verifique se você acessou pela URL completa enviada por e-mail." />;
  }

  // Validate HMAC + expiry server-side before rendering
  const validation = await validateAckToken(token, violationId);

  if (!validation.valid) {
    return <ErrorState message={validation.reason || 'Link expirado ou inválido.'} />;
  }

  if (validation.alreadyAcknowledged) {
    return (
      <div style={pageStyle}>
        <div style={cardStyle}>
          <h1 style={{ color: '#0a7d3a', marginTop: 0 }}>✓ Já confirmado</h1>
          <p>Este registro de hora extra já foi confirmado anteriormente.</p>
          <p style={{ color: '#666', fontSize: 14 }}>
            Confirmado em: {validation.acknowledgedAt}
          </p>
        </div>
      </div>
    );
  }

  const headersList = await headers();
  const clientIp =
    headersList.get('x-forwarded-for')?.split(',')[0] ||
    headersList.get('x-real-ip') ||
    'unknown';

  return (
    <div style={pageStyle}>
      <div style={cardStyle}>
        <h1 style={{ marginTop: 0 }}>Confirmação de hora extra</h1>

        <p>Olá, <strong>{validation.userName}</strong>.</p>

        <p>
          Detectamos um acesso ao sistema corporativo <strong>fora do seu horário contratado</strong>:
        </p>

        <div style={infoBoxStyle}>
          <div><strong>Data/hora:</strong> {validation.violationTime}</div>
          <div><strong>Horário contratado:</strong> {validation.scheduleStart} – {validation.scheduleEnd}</div>
          <div><strong>Categoria:</strong> {validation.cctDisplayName}</div>
        </div>

        <p>
          De acordo com a CLT (Art. 4º e Art. 59), tempo à disposição do empregador
          fora da jornada contratada deve ser registrado e pago como hora extra.
        </p>

        <p>
          <strong>Se você está realmente trabalhando agora,</strong> confirme abaixo.
          O tempo será registrado no seu ponto eletrônico e pago conforme as regras da sua categoria.
        </p>

        <p>
          <strong>Se você NÃO está trabalhando</strong> (acesso acidental, dispositivo desbloqueado,
          credencial possivelmente comprometida), use o botão de rejeição —
          isso aciona uma revisão de segurança imediata.
        </p>

        <AckForm
          violationId={violationId}
          token={token}
          clientIp={clientIp}
          ackTimestamp={new Date().toISOString()}
        />

        <hr style={{ margin: '24px 0', border: 'none', borderTop: '1px solid #e0e0e0' }} />

        <p style={{ fontSize: 12, color: '#666' }}>
          Este link expira em 24 horas. Se ficou pendente, sua chefia e o RH serão notificados
          automaticamente. Em caso de dúvidas, contate {validation.rhEmail}.
        </p>
      </div>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div style={pageStyle}>
      <div style={cardStyle}>
        <h1 style={{ color: '#c0392b', marginTop: 0 }}>Não foi possível processar</h1>
        <p>{message}</p>
        <p style={{ fontSize: 14, color: '#666' }}>
          Se você acredita que isso é um erro, entre em contato com seu RH.
        </p>
      </div>
    </div>
  );
}

interface ValidationResult {
  valid: boolean;
  reason?: string;
  alreadyAcknowledged?: boolean;
  acknowledgedAt?: string;
  userName?: string;
  violationTime?: string;
  scheduleStart?: string;
  scheduleEnd?: string;
  cctDisplayName?: string;
  rhEmail?: string;
}

async function validateAckToken(token: string, violationId: string): Promise<ValidationResult> {
  // In a real deployment, this:
  // 1. Verifies HMAC signature using the same HMAC_KEY the Workflow used
  // 2. Checks expiration (encoded in the token)
  // 3. Calls Workflow inbound webhook to look up violation details
  //
  // For the starter, we sketch the contract:

  try {
    const workflowsBaseUrl = process.env.WORKFLOWS_INBOUND_URL;
    const apiKey = process.env.WORKFLOWS_API_KEY;

    if (!workflowsBaseUrl || !apiKey) {
      return { valid: false, reason: 'Servidor mal configurado. Contate o admin.' };
    }

    const res = await fetch(`${workflowsBaseUrl}/validate-ack-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
      body: JSON.stringify({ token, violationId }),
      cache: 'no-store',
    });

    if (!res.ok) {
      return { valid: false, reason: 'Erro de validação. Tente novamente.' };
    }

    return await res.json();
  } catch (err) {
    return { valid: false, reason: 'Erro de comunicação com o servidor.' };
  }
}

const pageStyle: React.CSSProperties = {
  minHeight: '100vh',
  background: '#f5f6f8',
  padding: '40px 16px',
  fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  color: '#222',
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'center',
};

const cardStyle: React.CSSProperties = {
  background: '#fff',
  maxWidth: 560,
  width: '100%',
  padding: '32px 28px',
  borderRadius: 12,
  boxShadow: '0 2px 16px rgba(0,0,0,0.06)',
  lineHeight: 1.55,
};

const infoBoxStyle: React.CSSProperties = {
  background: '#fafbfc',
  border: '1px solid #e0e3e8',
  borderRadius: 8,
  padding: '14px 18px',
  margin: '18px 0',
  fontSize: 14,
  lineHeight: 1.9,
};
