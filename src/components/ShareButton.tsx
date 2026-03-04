'use client';

import { useState } from 'react';

interface ShareButtonProps {
  url: string;
  title: string;
  text: string;
}

export default function ShareButton({ url, title, text }: ShareButtonProps) {
  const [feedback, setFeedback] = useState<string | null>(null);

  async function handleShare() {
    try {
      if (navigator.share) {
        await navigator.share({
          title,
          text,
          url
        });

        setFeedback('Shared');
        return;
      }

      await navigator.clipboard.writeText(url);
      setFeedback('Link copied');
    } catch {
      setFeedback('Share failed');
    }

    window.setTimeout(() => setFeedback(null), 1800);
  }

  return (
    <button
      type="button"
      onClick={handleShare}
      className="rounded-xl bg-warm px-4 py-2 text-sm font-semibold text-ink transition hover:opacity-90"
    >
      {feedback ?? 'Share to WhatsApp'}
    </button>
  );
}
