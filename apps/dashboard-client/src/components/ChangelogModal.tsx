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
    version: 'v3.6.0',
    title: 'Dual-Agent AI Analysis Pipeline',
    items: [
      'AI root cause analysis now uses a two-step Analyzer + Critic pipeline — the Critic validates the initial diagnosis against raw logs and eliminates hallucinations before output.',
      'Log context passed to Gemini expanded to 60 000 characters, capturing full suite output and earlier setup failures.',
      'Analysis accuracy improvements: Analyzer uses structured JSON schema; Critic runs at temperature 0.0 for factual grounding.',
    ],
  },
  {
    version: 'v3.5.0',
    title: 'DocSync & Multi-Tenant Architecture Alignment',
    items: [
      'Synchronized all project documentation to reflect the new Multi-Tenant architecture.',
      'Removed legacy environment variables and decoupled platform from client test workloads.',
      'Documented background Docker image pre-fetching mechanism for execution wait times.',
    ],
  },
  {
    version: 'v3.4.0',
    title: 'Env Variables & Secrets Management',
    items: [
      'Added per-project environment variables with AES-256-GCM encryption.',
      'Execution pipeline integration securely injects env vars into test runs.',
      'New Environment Variables Settings tab with masked table view and secret toggles.',
    ],
  },
  {
    version: 'v3.3.0',
    title: 'Slack Notifications & Execution Polishes',
    items: [
      'Configurable Slack Notifications based on test execution statuses.',
      'Added "Connected" status badges for CI integrations.',
      'Global Brand Refresh to "Agnox" and various UI/UX bug fixes.',
    ],
  },
  {
    version: 'v3.2.0',
    title: 'Native CI/CD Integrations',
    items: [
      'Native CI Provider implementations to post AI root-cause analysis as PR/MR comments.',
      'Dynamic API Routing and encrypted storage for integration credentials (PATs).',
      'New Provider Settings UI in the Dashboard to securely manage tokens.',
    ],
  },
  {
    version: 'v3.1.0',
    title: 'Quality Hub & Reporting Evolution',
    items: [
      'Live HTML Reports: Dedicated preview screen for Test Cycles with native browser-print optimization.',
      'Feature Management: Organization-level toggles for Manual Test Repository and Hybrid Cycles.',
      'Automated Versioning: Single-source-of-truth versioning injected from package.json to the entire UI.',
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
              What's New in agnox
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
