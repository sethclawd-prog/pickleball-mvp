'use client';

import { useEffect, useMemo, useState } from 'react';

import AvailabilityGrid from '@/components/AvailabilityGrid';
import { IDENTITY_UPDATED_EVENT, getStoredIdentity } from '@/lib/identity';
import {
  cellKey,
  selectionFromTemplateRows,
  templateRowsFromSelection
} from '@/lib/availability';
import { getSupabaseBrowserClient } from '@/lib/supabase';
import type { AvailabilityTemplate, StoredIdentity } from '@/lib/types';

export default function AvailabilityPage() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);

  const [identity, setIdentity] = useState<StoredIdentity | null>(null);
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedLabel, setSavedLabel] = useState<string | null>(null);

  useEffect(() => {
    setIdentity(getStoredIdentity());
    const onIdentityUpdate = () => setIdentity(getStoredIdentity());
    window.addEventListener(IDENTITY_UPDATED_EVENT, onIdentityUpdate);

    return () => {
      window.removeEventListener(IDENTITY_UPDATED_EVENT, onIdentityUpdate);
    };
  }, []);

  useEffect(() => {
    if (!identity) {
      setLoading(false);
      return;
    }

    async function loadAvailability() {
      try {
        setLoading(true);
        setError(null);

        const { data, error: queryError } = await supabase
          .from('availability_templates')
          .select('*')
          .eq('user_id', identity!.id)
          .order('weekday', { ascending: true })
          .order('start_time', { ascending: true });

        if (queryError) {
          throw new Error(queryError.message);
        }

        setSelection(selectionFromTemplateRows((data ?? []) as AvailabilityTemplate[]));
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Could not load availability.');
      } finally {
        setLoading(false);
      }
    }

    void loadAvailability();
  }, [identity, supabase]);

  function toggle(weekday: number, slotIndex: number) {
    setSelection((prev) => {
      const next = new Set(prev);
      const key = cellKey(weekday, slotIndex);

      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }

      return next;
    });
  }

  async function handleSave() {
    if (!identity) {
      return;
    }

    try {
      setSaving(true);
      setError(null);
      setSavedLabel(null);

      const rows = templateRowsFromSelection(selection, identity.id);

      const { error: deleteError } = await supabase
        .from('availability_templates')
        .delete()
        .eq('user_id', identity.id);

      if (deleteError) {
        throw new Error(deleteError.message);
      }

      if (rows.length) {
        const { error: insertError } = await supabase.from('availability_templates').insert(rows);
        if (insertError) {
          throw new Error(insertError.message);
        }
      }

      setSavedLabel('Saved');
      window.setTimeout(() => setSavedLabel(null), 1600);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save availability.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <section className="rounded-3xl border border-white/70 bg-white/95 p-5 shadow-card">
        <h1 className="font-display text-3xl text-ink">Weekly availability</h1>
        <p className="mt-2 text-sm text-ink/70">
          Mark the blocks when you are usually free. This helps your crew spot easy game windows.
        </p>
      </section>

      {loading ? <p className="text-sm text-ink/60">Loading your template...</p> : null}
      {error ? <p className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p> : null}

      {!loading ? <AvailabilityGrid selection={selection} onToggle={toggle} /> : null}

      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={saving || !identity}
          onClick={handleSave}
          className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? 'Saving...' : savedLabel ?? 'Save availability'}
        </button>
        <p className="text-xs text-ink/60">Selected slots: {selection.size}</p>
      </div>
    </div>
  );
}
