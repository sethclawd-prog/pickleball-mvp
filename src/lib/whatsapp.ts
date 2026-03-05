import { normalizePhone } from '@/lib/identity';

export interface ParsedWhatsAppMessage {
  sender: string;
  chatId: string;
  text: string;
  profileName?: string;
  messageId: string;
}

interface WhatsAppWebhookPayload {
  entry?: Array<{
    changes?: Array<{
      value?: {
        contacts?: Array<{
          profile?: {
            name?: string;
          };
        }>;
        messages?: Array<{
          from?: string;
          author?: string;
          id?: string;
          type?: string;
          text?: {
            body?: string;
          };
        }>;
      };
    }>;
  }>;
}

interface SendWhatsAppTextInput {
  to: string;
  body: string;
}

function toRecipient(to: string): string {
  const trimmed = to.trim();

  if (!trimmed) {
    return '';
  }

  if (trimmed.includes('@')) {
    return trimmed;
  }

  const normalized = normalizePhone(trimmed);
  return normalized.replace(/^\+/, '');
}

function getWhatsAppEnv(): {
  accessToken: string;
  phoneNumberId: string;
} {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!accessToken || !phoneNumberId) {
    throw new Error('Missing WhatsApp Cloud API environment variables.');
  }

  return {
    accessToken,
    phoneNumberId
  };
}

export async function sendWhatsAppText(input: SendWhatsAppTextInput): Promise<void> {
  const recipient = toRecipient(input.to);

  if (!recipient) {
    throw new Error('Missing WhatsApp recipient number.');
  }

  const text = input.body.trim();
  if (!text) {
    throw new Error('Cannot send an empty WhatsApp message.');
  }

  const { accessToken, phoneNumberId } = getWhatsAppEnv();

  const response = await fetch(`https://graph.facebook.com/v20.0/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: recipient,
      type: 'text',
      text: {
        preview_url: false,
        body: text
      }
    })
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`WhatsApp API error (${response.status}): ${message}`);
  }
}

export function parseIncomingWhatsAppMessages(payload: unknown): ParsedWhatsAppMessage[] {
  const parsed = payload as WhatsAppWebhookPayload;

  if (!parsed?.entry?.length) {
    return [];
  }

  const messages: ParsedWhatsAppMessage[] = [];

  for (const entry of parsed.entry) {
    for (const change of entry.changes ?? []) {
      const profileName = change.value?.contacts?.[0]?.profile?.name;

      for (const message of change.value?.messages ?? []) {
        if (message.type !== 'text') {
          continue;
        }

        const body = message.text?.body?.trim();
        const chatId = message.from?.trim();
        const sender = (message.author ?? message.from)?.trim();

        if (!body || !chatId || !sender || !message.id) {
          continue;
        }

        messages.push({
          sender,
          chatId,
          text: body,
          profileName,
          messageId: message.id
        });
      }
    }
  }

  return messages;
}
