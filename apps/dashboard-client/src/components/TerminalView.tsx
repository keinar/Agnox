import { useEffect, useRef, useState } from 'react';
import Ansi from 'ansi-to-react';
import { Check, ChevronsDown, Copy, Download } from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────────

interface TerminalViewProps {
  output?: string;
  error?: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function TerminalView({ output, error }: TerminalViewProps) {
  const [autoScroll, setAutoScroll] = useState(true);
  const [copied, setCopied] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom whenever new output arrives, if auto-scroll is active.
  useEffect(() => {
    if (autoScroll && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [output, autoScroll]);

  // Download the raw log content as a plain-text file.
  const handleDownload = () => {
    const parts: string[] = [];
    if (output) parts.push(output);
    if (error) parts.push(`\n--- ERROR ---\n${error}`);
    const blob = new Blob([parts.join('')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'execution-log.txt';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  // Copy the raw log content to clipboard.
  const handleCopy = async () => {
    const parts: string[] = [];
    if (output) parts.push(output);
    if (error) parts.push(`\n--- ERROR ---\n${error}`);
    await navigator.clipboard.writeText(parts.join(''));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const hasContent = !!(output || error);

  return (
    <div className="flex flex-col">

      {/* ── Utility bar ───────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2 bg-slate-100 dark:bg-gh-bg-subtle-dark border-b border-slate-300 dark:border-gh-border-dark shrink-0">
        <span className="text-[10px] uppercase tracking-widest font-bold text-slate-700 dark:text-slate-400 select-none">
          console output
        </span>

        <div className="flex items-center gap-2">

          {/* Auto-scroll toggle */}
          <button
            onClick={() => setAutoScroll((prev) => !prev)}
            title={autoScroll ? 'Auto-scroll enabled — click to disable' : 'Auto-scroll disabled — click to enable'}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium border transition-colors duration-150 cursor-pointer ${autoScroll
              ? 'bg-gh-accent-dark/20 text-gh-accent-dark border-gh-accent-dark/40 hover:bg-gh-accent-dark/30'
              : 'bg-transparent text-slate-500 border-gh-border-dark hover:text-slate-300 hover:border-slate-500'
              }`}
          >
            <ChevronsDown size={13} />
            Auto-scroll
          </button>

          {/* Copy logs to clipboard */}
          <button
            onClick={handleCopy}
            disabled={!hasContent}
            title="Copy logs to clipboard"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium text-slate-400 border border-gh-border-dark hover:text-slate-200 hover:border-slate-500 transition-colors duration-150 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {copied ? <Check size={13} className="text-green-400" /> : <Copy size={13} />}
            {copied ? 'Copied!' : 'Copy Logs'}
          </button>

          {/* Download raw log */}
          <button
            onClick={handleDownload}
            disabled={!hasContent}
            title="Download raw log as .txt"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium text-slate-400 border border-gh-border-dark hover:text-slate-200 hover:border-slate-500 transition-colors duration-150 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Download size={13} />
            Download
          </button>
        </div>
      </div>

      {/* ── Terminal body ──────────────────────────────────────────────────────── */}
      <div className="h-[calc(100vh-200px)] overflow-y-auto bg-gh-bg-dark px-6 py-5 font-mono text-[13px] leading-relaxed text-slate-300 whitespace-pre-wrap break-words">

        {output ? (
          <span><Ansi>{output}</Ansi></span>
        ) : (
          <span className="text-slate-600 italic">Waiting for logs…</span>
        )}

        {error && (
          <div className="mt-3 text-red-400">
            <span className="font-semibold text-red-300">Error:&nbsp;</span>
            {error}
          </div>
        )}

        {/* Invisible anchor for auto-scroll */}
        <div ref={bottomRef} aria-hidden="true" />
      </div>

    </div>
  );
}
