import { NextRequest, NextResponse } from 'next/server';

import { sendWhatsAppText } from '@/lib/whatsapp';

export const runtime = 'nodejs';

interface SendRouteBody {
  to?: string;
  message?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: SendRouteBody;

  try {
    body = (await request.json()) as SendRouteBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload.' }, { status: 400 });
  }

  const to = body.to?.trim();
  const message = body.message?.trim();

  if (!to || !message) {
    return NextResponse.json(
      {
        error: "Expected JSON payload: { to: '+14155552671', message: 'Hello from bot' }"
      },
      { status: 400 }
    );
  }

  try {
    await sendWhatsAppText({
      to,
      body: message
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const messageText = error instanceof Error ? error.message : 'Failed to send WhatsApp message.';
    return NextResponse.json({ error: messageText }, { status: 500 });
  }
}
