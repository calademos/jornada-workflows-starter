'use client';

import { useState } from 'react';

interface AckFormProps {
  violationId: string;
  token: string;
  clientIp: string;
  ackTimestamp: string;
}

export default function AckForm({ violationId, token, clientIp, ackTimestamp }: AckFormProps) {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<'success' | 'rejected' | 'error' | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  const handleConfirm = async () => {
    setSubmitting(true);
    setErrorMessage('');

    try {
      const res = await fetch('/api/ack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          violationId,
          token,
          action: 'CONFIRM',
          reason,
          clientIp,
          ackTimestamp,
          userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
        }),
      });

      if (!res.ok) {
        const body = await res.text();
        setErrorMessage(`Falha (${res.status}): ${body}`);
        setResult('error');
      } else {
        setResult('success');
      }
    } catch (err) {
      setErrorMessage('Erro de rede.');
      setResult('error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!confirm('Você está afirmando que NÃO está trabalhando. Isso aciona revisão de segurança. Confirmar?')) {
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/ack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          violationId,
          token,
          action: 'REJECT',
          reason: 'Usuário declarou não estar trabalhando',
          clientIp,
          ackTimestamp,
          userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
        }),
      });

      if (!res.ok) {
        setErrorMessage(`Falha (${res.status})`);
        setResult('error');
      } else {
        setResult('rejected');
      }
    } catch (err) {
      setErrorMessage('Erro de rede.');
      setResult('error');
    } finally {
      setSubmitting(false);
    }
  };

  if (result === 'success') {
    return (
      <div style={successStyle}>
        <strong>✓ Confirmado.</strong>
        <p style={{ margin: '8px 0 0' }}>
          Hora extra registrada. O tempo será computado no seu próximo holerite
          conforme as regras da sua categoria.
        </p>
      </div>
    );
  }

  if (result === 'rejected') {
    return (
      <div style={rejectedStyle}>
        <strong>Registro de rejeição enviado.</strong>
        <p style={{ margin: '8px 0 0' }}>
          A equipe de segurança foi notificada. Se sua credencial pode estar comprometida,
          troque sua senha imediatamente em <code>https://login.empresa.com.br</code>.
        </p>
      </div>
    );
  }

  return (
    <div>
      <label style={{ display: 'block', fontSize: 14, marginBottom: 6, fontWeight: 500 }}>
        Motivo (opcional):
      </label>
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={3}
        placeholder="Ex: atendimento de incidente, cliente em emergência, etc."
        style={textareaStyle}
        maxLength={500}
        disabled={submitting}
      />

      <div style={{ display: 'flex', gap: 12, marginTop: 16, flexWrap: 'wrap' }}>
        <button
          onClick={handleConfirm}
          disabled={submitting}
          style={primaryButtonStyle}
        >
          {submitting ? 'Enviando...' : 'Confirmo: estou fazendo hora extra'}
        </button>

        <button
          onClick={handleReject}
          disabled={submitting}
          style={secondaryButtonStyle}
        >
          Não estou trabalhando
        </button>
      </div>

      {errorMessage && (
        <div style={errorStyle}>
          {errorMessage}
        </div>
      )}
    </div>
  );
}

const textareaStyle: React.CSSProperties = {
  width: '100%',
  padding: 10,
  fontFamily: 'inherit',
  fontSize: 14,
  border: '1px solid #ccd0d5',
  borderRadius: 6,
  resize: 'vertical',
  boxSizing: 'border-box',
};

const primaryButtonStyle: React.CSSProperties = {
  background: '#0a7d3a',
  color: 'white',
  border: 'none',
  padding: '12px 20px',
  borderRadius: 6,
  fontSize: 15,
  fontWeight: 500,
  cursor: 'pointer',
  flex: 1,
  minWidth: 220,
};

const secondaryButtonStyle: React.CSSProperties = {
  background: 'white',
  color: '#c0392b',
  border: '1px solid #c0392b',
  padding: '12px 20px',
  borderRadius: 6,
  fontSize: 15,
  fontWeight: 500,
  cursor: 'pointer',
  flex: 1,
  minWidth: 180,
};

const successStyle: React.CSSProperties = {
  background: '#e8f5ed',
  border: '1px solid #0a7d3a',
  color: '#0a5628',
  padding: 16,
  borderRadius: 8,
};

const rejectedStyle: React.CSSProperties = {
  background: '#fdf3f3',
  border: '1px solid #c0392b',
  color: '#9c2a1f',
  padding: 16,
  borderRadius: 8,
};

const errorStyle: React.CSSProperties = {
  marginTop: 12,
  padding: 10,
  background: '#fff4e5',
  border: '1px solid #d68910',
  borderRadius: 6,
  fontSize: 14,
  color: '#7d5c12',
};
