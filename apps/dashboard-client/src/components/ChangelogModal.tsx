import { X, Sparkles } from 'lucide-react';

interface ChangelogModalProps {
  onClose: () => void;
}

interface IChangelogEntry {
  version: string;
  title: string;
  items: string[];
}

const CHANGELOG: IChangelogEntry[] = [
  {
    version: 'v3.1.0',
    title: 'Sprint 10: PDF Reporting & Automation Infrastructure',
    items: [
      'Automated version pipeline — UI version is now injected at build time from root package.json; no more manual updates.',
      'VersionDisplay component replaces hardcoded version strings across the sidebar.',
      'Sprint 10 foundation: PDF cycle report generation and download UI (Tasks 10.1–10.2) in progress.',
    ],
  },
  {
    version: 'v3.0.0',
    title: 'The Enterprise Update',
    items: [
      'GitHub-inspired High Contrast Dark Mode.',
      'Grouped Execution Views & Bulk Actions.',
      'Real-time KPI Dashboard.',
      'Jira Integration Enhancements.',
    ],
  },
];

export function ChangelogModal({ onClose }: ChangelogModalProps) {
  return (
    <div
      role="presentation"
      className="fixed inset-0 z-[1000] flex items-center justify-center p-5 bg-black/50"
      onClick={onClose}
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="changelog-modal-title"
        className="bg-white dark:bg-gh-bg-dark rounded-2xl shadow-2xl w-full max-w-md max-h-[85vh] overflow-auto border border-slate-200 dark:border-gh-border-dark"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200 dark:border-gh-border-dark">
          <div className="flex items-center gap-2.5">
            <Sparkles size={18} className="text-blue-500 dark:text-blue-400" />
            <h2
              id="changelog-modal-title"
              className="text-lg font-semibold text-slate-900 dark:text-slate-100"
            >
              What's New in AAC
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close changelog"
            className="p-1.5 rounded-lg text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-gh-bg-subtle-dark transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 flex flex-col gap-6">
          {CHANGELOG.map((entry) => (
            <div key={entry.version}>
              <div className="flex items-center gap-2 mb-3">
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
                  {entry.version}
                </span>
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  {entry.title}
                </span>
              </div>
              <ul className="flex flex-col gap-2">
                {entry.items.map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-sm text-slate-700 dark:text-slate-300">
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-blue-400 dark:bg-blue-500 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex justify-end px-6 py-4 border-t border-slate-200 dark:border-gh-border-dark">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-gh-bg-subtle-dark border border-slate-200 dark:border-gh-border-dark rounded-lg hover:bg-slate-50 dark:hover:bg-gh-bg-dark transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
