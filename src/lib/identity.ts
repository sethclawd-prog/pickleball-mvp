import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database, StoredIdentity } from '@/lib/types';

const STORAGE_KEY = 'pickleball_identity_v1';
export const IDENTITY_UPDATED_EVENT = 'pickleball:identity-updated';

export function normalizePhone(input: string): string {
  const trimmed = input.trim();
  const digitsAndPlus = trimmed.replace(/[^\d+]/g, '');

  if (!digitsAndPlus) {
    return '';
  }

  if (digitsAndPlus.startsWith('+')) {
    return digitsAndPlus;
  }

  const digitsOnly = digitsAndPlus.replace(/\D/g, '');
  if (digitsOnly.length === 10) {
    return `+1${digitsOnly}`;
  }

  if (digitsOnly.length === 11 && digitsOnly.startsWith('1')) {
    return `+${digitsOnly}`;
  }

  return `+${digitsOnly}`;
}

export function getStoredIdentity(): StoredIdentity | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as StoredIdentity;
    if (!parsed.id || !parsed.name || !parsed.phone) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export function saveStoredIdentity(identity: StoredIdentity): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(identity));
  window.dispatchEvent(new Event(IDENTITY_UPDATED_EVENT));
}

export async function upsertIdentity(
  supabase: SupabaseClient<Database>,
  input: { name: string; phone: string }
): Promise<StoredIdentity> {
  const name = input.name.trim();
  const phone = normalizePhone(input.phone);

  if (name.length < 2) {
    throw new Error('Please enter your full first name.');
  }

  if (!phone || phone.length < 11) {
    throw new Error('Please enter a valid phone number.');
  }

  const { data, error } = await supabase
    .from('users')
    .upsert(
      {
        name,
        phone
      },
      {
        onConflict: 'phone'
      }
    )
    .select('id,name,phone')
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? 'Failed to save your profile.');
  }

  const identity: StoredIdentity = {
    id: data.id,
    name: data.name,
    phone: data.phone
  };

  saveStoredIdentity(identity);
  return identity;
}
