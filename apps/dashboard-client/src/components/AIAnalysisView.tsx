import React, { useMemo } from 'react';
import { Bot, Sparkles, AlertTriangle, Loader2 } from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────────

interface AIAnalysisViewProps {
  analysis: string | null | undefined;
  status: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Converts a subset of markdown (## headers, * bullets, **bold**) to JSX. */
function renderMarkdown(text: string): React.ReactNode[] {
  return text.split('\n').map((line, i) => {
    // H2 section headers
    if (line.startsWith('## ')) {
      const title    = line.replace('## ', '').replace(/\*\*/g, '');
      const isRoot   = title.toLowerCase().includes('root cause');
      const isFix    = title.toLowerCase().includes('fix') || title.toLowerCase().includes('solution');
      const colorCls = isRoot
        ? 'text-rose-600 dark:text-rose-400'
        : isFix
          ? 'text-emerald-600 dark:text-emerald-400'
          : 'text-slate-900 dark:text-slate-100';

      return (
        <div
          key={i}
          className="mt-6 mb-3 pb-2 border-b border-slate-200 dark:border-gh-border-dark first:mt-0"
        >
          <h3 className={`text-base font-bold flex items-center gap-2 m-0 ${colorCls}`}>
            {isRoot && <AlertTriangle size={16} className="shrink-0 text-rose-500 dark:text-rose-400" />}
            {isFix  && <Sparkles     size={16} className="shrink-0 text-emerald-500 dark:text-emerald-400" />}
            {title}
          </h3>
        </div>
      );
    }

    // Bullet points
    if (line.trim().startsWith('* ')) {
      return (
        <div key={i} className="flex gap-3 mb-2 pl-2">
          <span className="mt-2 shrink-0 w-1.5 h-1.5 rounded-full bg-blue-500 dark:bg-blue-400" />
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed m-0">
            {line.replace('* ', '').replace(/\*\*/g, '')}
          </p>
        </div>
      );
    }

    // Inline **bold**
    if (line.includes('**')) {
      const parts = line.split('**');
      return (
        <p key={i} className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-3">
          {parts.map((part, idx) =>
            idx % 2 === 1 ? (
              <span
                key={idx}
                className="font-semibold text-slate-900 dark:text-slate-100 bg-slate-100 dark:bg-slate-800 px-1 rounded"
              >
                {part}
              </span>
            ) : part,
          )}
        </p>
      );
    }

    // Blank line spacer
    if (line.trim() === '') return <div key={i} className="h-2" />;

    // Plain paragraph
    return (
      <p key={i} className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-3">
        {line}
      </p>
    );
  });
}

// ── Component ──────────────────────────────────────────────────────────────────

export function AIAnalysisView({ analysis, status }: AIAnalysisViewProps) {
  const isAnalyzing = status === 'ANALYZING';
  const isUnstable  = status === 'UNSTABLE';

  const renderedContent = useMemo(
    () => (analysis ? renderMarkdown(analysis) : null),
    [analysis],
  );

  // ── Loading state ────────────────────────────────────────────────────────────
  if (isAnalyzing) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 py-20">
        <Loader2 size={28} className="animate-spin text-blue-500 dark:text-blue-400" />
        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
          AI is analysing your run&hellip;
        </p>
        <p className="text-xs text-slate-400 dark:text-slate-500 text-center max-w-xs">
          Gemini is processing the execution logs to identify root causes.
        </p>
      </div>
    );
  }

  // ── Empty state ──────────────────────────────────────────────────────────────
  if (!analysis) {
    return (
      <div className="flex items-center justify-center h-32 rounded-lg border border-dashed border-slate-200 dark:border-gh-border-dark">
        <p className="text-sm text-slate-400 dark:text-slate-500">
          No AI analysis available for this run.
        </p>
      </div>
    );
  }

  // ── Analysis content ─────────────────────────────────────────────────────────
  return (
    <div>
      {/* Panel header — branding strip */}
      <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-200 dark:border-gh-border-dark">
        <div
          className={`p-2 rounded-lg shrink-0 ${
            isUnstable
              ? 'bg-amber-100 dark:bg-amber-950/30 text-amber-500 dark:text-amber-400'
              : 'bg-rose-100 dark:bg-rose-950/30 text-rose-500 dark:text-rose-400'
          }`}
        >
          <Bot size={20} />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2 m-0">
            AI Root Cause Analysis
            <Sparkles size={13} className="text-blue-400 dark:text-blue-300 animate-pulse" />
          </h3>
          <p className="text-xs text-slate-400 dark:text-slate-500 m-0">
            Powered by Gemini 2.5 Flash
          </p>
        </div>
      </div>

      {/* Rendered markdown body */}
      <div>{renderedContent}</div>
    </div>
  );
}
