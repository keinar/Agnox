import React, { useState, useEffect } from 'react';
import { Dialog, DialogPanel, Transition, TransitionChild } from '@headlessui/react';
import { X } from 'lucide-react';
import type { Execution } from '../types';
import { TerminalView } from './TerminalView';
import { AIAnalysisView } from './AIAnalysisView';
import { ArtifactsView } from './ArtifactsView';

// ── Types ──────────────────────────────────────────────────────────────────────

interface ExecutionDrawerProps {
  executionId: string | null;
  /** Full execution object resolved by the parent — kept live via React Query. */
  execution: Execution | null;
  onClose: () => void;
  /** Tab to activate when the drawer first opens for a given executionId. */
  defaultTab?: DrawerTab;
}

export type DrawerTab = 'terminal' | 'artifacts' | 'ai-analysis';

// ── Constants ─────────────────────────────────────────────────────────────────

const TABS: { id: DrawerTab; label: string }[] = [
  { id: 'terminal',    label: 'Terminal' },
  { id: 'artifacts',   label: 'Artifacts' },
  { id: 'ai-analysis', label: 'AI Analysis' },
];

// ── Component ─────────────────────────────────────────────────────────────────

export function ExecutionDrawer({ executionId, execution, onClose, defaultTab }: ExecutionDrawerProps) {
  const [activeTab, setActiveTab] = useState<DrawerTab>(defaultTab ?? 'terminal');
  const isOpen = !!executionId;

  // Reset active tab whenever a new execution is opened so defaultTab is honoured.
  useEffect(() => {
    if (executionId) setActiveTab(defaultTab ?? 'terminal');
  }, [executionId, defaultTab]);

  return (
    <Transition show={isOpen}>
      <Dialog onClose={onClose} className="relative z-50">

        {/* ── Backdrop ────────────────────────────────────────────────────── */}
        <TransitionChild
          enter="transition-opacity duration-300 ease-out"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="transition-opacity duration-200 ease-in"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div
            className="fixed inset-0 bg-slate-900/50 dark:bg-black/70"
            aria-hidden="true"
          />
        </TransitionChild>

        {/* ── Slide panel ─────────────────────────────────────────────────── */}
        <div className="fixed inset-0 overflow-hidden">
          <div className="flex h-full items-stretch justify-end">
            <TransitionChild
              enter="transition-transform duration-300 ease-out"
              enterFrom="translate-x-full"
              enterTo="translate-x-0"
              leave="transition-transform duration-200 ease-in"
              leaveFrom="translate-x-0"
              leaveTo="translate-x-full"
            >
              <DialogPanel className="relative flex h-full w-full flex-col bg-white dark:bg-gh-bg-dark border-l border-slate-200 dark:border-gh-border-dark shadow-2xl md:max-w-4xl">

                {/* ── Header ────────────────────────────────────────────── */}
                <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-slate-200 dark:border-gh-border-dark shrink-0">
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      Execution Details
                    </h2>
                    <p className="text-xs font-mono text-slate-500 dark:text-slate-400 truncate">
                      {executionId}
                    </p>
                  </div>
                  <button
                    onClick={onClose}
                    aria-label="Close drawer"
                    className="flex shrink-0 items-center justify-center w-8 h-8 rounded-lg text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors duration-150"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* ── Tab bar ───────────────────────────────────────────── */}
                <div className="flex items-center gap-1 px-6 border-b border-slate-200 dark:border-gh-border-dark shrink-0">
                  {TABS.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors duration-150 cursor-pointer ${
                        activeTab === tab.id
                          ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                          : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* ── Tab content ───────────────────────────────────────── */}
                {/* Terminal manages its own scroll; other tabs own their padding wrapper. */}
                <div className="flex-1 overflow-hidden">

                  {activeTab === 'terminal' && (
                    <TerminalView
                      output={execution?.output}
                      error={execution?.error}
                    />
                  )}

                  {activeTab === 'artifacts' && executionId && (
                    <div className="h-full overflow-y-auto p-6">
                      <ArtifactsView taskId={executionId} />
                    </div>
                  )}

                  {activeTab === 'ai-analysis' && (
                    <div className="h-full overflow-y-auto p-6">
                      <AIAnalysisView
                        analysis={execution?.analysis ?? null}
                        status={execution?.status ?? ''}
                      />
                    </div>
                  )}

                </div>

              </DialogPanel>
            </TransitionChild>
          </div>
        </div>

      </Dialog>
    </Transition>
  );
}
