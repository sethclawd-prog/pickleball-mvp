import { NextRequest, NextResponse } from 'next/server';

import { handleBotCommand } from '@/lib/bot';
import { parseIncomingWhatsAppMessages, sendWhatsAppText } from '@/lib/whatsapp';

export const runtime = 'nodejs';

function resolveSiteUrl(request: NextRequest): string {
  return process.env.NEXT_PUBLIC_SITE_URL?.trim() || request.nextUrl.origin;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const mode = request.nextUrl.searchParams.get('hub.mode');
  const token = request.nextUrl.searchParams.get('hub.verify_token');
  const challenge = request.nextUrl.searchParams.get('hub.challenge');

  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;

  if (mode === 'subscribe' && verifyToken && token === verifyToken && challenge) {
    return new NextResponse(challenge, { status: 200 });
  }

  return NextResponse.json({ error: 'Webhook verification failed.' }, { status: 403 });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload.' }, { status: 400 });
  }

  const incomingMessages = parseIncomingWhatsAppMessages(payload);

  if (!incomingMessages.length) {
    return NextResponse.json({ ok: true, processed: 0 });
  }

  for (const incoming of incomingMessages) {
    try {
      const result = await handleBotCommand({
        from: incoming.sender,
        message: incoming.text,
        profileName: incoming.profileName,
        replyTo: incoming.chatId,
        siteUrl: resolveSiteUrl(request)
      });

      await sendWhatsAppText({
        to: incoming.chatId,
        body: result.reply
      });

      for (const notification of result.notifications) {
        await sendWhatsAppText(notification);
      }
    } catch (error) {
      console.error('Failed to process WhatsApp webhook message.', error);

      try {
        await sendWhatsAppText({
          to: incoming.chatId,
          body: 'Something went wrong while processing your request. Please try again.'
        });
      } catch (sendError) {
        console.error('Failed to send WhatsApp error response.', sendError);
      }
    }
  }

  return NextResponse.json({ ok: true, processed: incomingMessages.length });
}
