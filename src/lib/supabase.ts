import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/lib/types';

let browserClient: SupabaseClient<Database> | null = null;

export function getSupabaseBrowserClient(): SupabaseClient<Database> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if ((!url || !anonKey) && typeof window !== 'undefined') {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY');
  }

  if (!browserClient) {
    browserClient = createClient<Database>(url ?? 'http://127.0.0.1:54321', anonKey ?? 'missing-anon-key', {
      auth: {
        persistSession: false
      }
    });
  }

  return browserClient;
}
