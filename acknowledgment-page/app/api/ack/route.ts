import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

/**
 * POST /api/ack
 *
 * Recebe a confirmação do usuário e:
 * 1. Re-valida o HMAC token (defesa em profundidade)
 * 2. Posta para o Workflow inbound webhook
 * 3. O Workflow atualiza a row em violations e dispara reconciliação
 *
 * Importante: NUNCA confie apenas no client-side. Toda validação crítica é server-side.
 */

interface AckPayload {
  violationId: string;
  token: string;
  action: 'CONFIRM' | 'REJECT';
  reason: string;
  clientIp: string;
  ackTimestamp: string;
  userAgent: string;
}

export async function POST(req: NextRequest) {
  let body: AckPayload;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // Basic shape check
  if (!body.violationId || !body.token || !body.action) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }

  if (body.action !== 'CONFIRM' && body.action !== 'REJECT') {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }

  // Re-validate HMAC server-side
  const hmacKey = process.env.HMAC_KEY;
  if (!hmacKey) {
    console.error('HMAC_KEY not configured');
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
  }

  const tokenValid = verifyHmacToken(body.token, body.violationId, hmacKey);
  if (!tokenValid) {
    return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
  }

  // Forward to Workflow inbound webhook
  const workflowsUrl = process.env.WORKFLOWS_INBOUND_URL;
  const workflowsApiKey = process.env.WORKFLOWS_API_KEY;

  if (!workflowsUrl || !workflowsApiKey) {
    console.error('Workflows inbound not configured');
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
  }

  try {
    const wfRes = await fetch(`${workflowsUrl}/ack-received`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': workflowsApiKey,
      },
      body: JSON.stringify({
        violationId: body.violationId,
        action: body.action,
        reason: body.reason?.slice(0, 500) ?? '',
        ackClientIp: body.clientIp,
        ackTimestamp: body.ackTimestamp,
        ackUserAgent: body.userAgent?.slice(0, 500) ?? '',
        receivedAt: new Date().toISOString(),
      }),
    });

    if (!wfRes.ok) {
      const text = await wfRes.text();
      console.error('Workflows webhook failed', wfRes.status, text);
      return NextResponse.json(
        { error: 'Failed to record acknowledgment' },
        { status: 502 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Error calling Workflows', err);
    return NextResponse.json({ error: 'Network error' }, { status: 502 });
  }
}

/**
 * Verifies the HMAC token.
 *
 * Token format: base64url(payloadJSON).base64url(hmacSignature)
 * payload: { violationId, userId, expiresAt }
 */
function verifyHmacToken(token: string, expectedViolationId: string, secret: string): boolean {
  const parts = token.split('.');
  if (parts.length !== 2) return false;

  const [payloadB64, signatureB64] = parts;

  let payload: { violationId: string; userId: string; expiresAt: string };
  try {
    const payloadJson = Buffer.from(payloadB64, 'base64url').toString('utf8');
    payload = JSON.parse(payloadJson);
  } catch {
    return false;
  }

  if (payload.violationId !== expectedViolationId) return false;
  if (new Date(payload.expiresAt) < new Date()) return false;

  const expectedSig = crypto
    .createHmac('sha256', secret)
    .update(payloadB64)
    .digest('base64url');

  // Constant-time comparison
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signatureB64),
      Buffer.from(expectedSig)
    );
  } catch {
    return false;
  }
}
