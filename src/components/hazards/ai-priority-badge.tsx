'use client';

import type { HazardPriority } from '@/lib/hazards/types';
import { formatAiConfidence } from '@/lib/hazards/types';

const priorityClasses: Record<HazardPriority, string> = {
  Low: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  Medium: 'border-amber-200 bg-amber-50 text-amber-800',
  High: 'border-rose-200 bg-rose-50 text-rose-800',
};

export function AiPriorityBadge({
  priority,
  confidence,
}: Readonly<{
  priority: HazardPriority | null;
  confidence: number | string | null;
}>) {
  const confidenceLabel = formatAiConfidence(confidence);

  if (!priority) {
    return (
      <span className="text-sm text-slate-500">AI recommendation unavailable</span>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span
        className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${priorityClasses[priority]}`}
      >
        {priority}
      </span>
      {confidenceLabel ? (
        <span className="text-xs text-slate-600">{confidenceLabel} confidence</span>
      ) : null}
    </div>
  );
}

