import React, { useState, useMemo } from 'react';
import { Dialog, DialogPanel, Transition, TransitionChild } from '@headlessui/react';
import { X } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import type { Execution } from '../types';
import { useAuth } from '../context/AuthContext';
import { TerminalView } from './TerminalView';
import { AIAnalysisView } from './AIAnalysisView';
import { ArtifactsView, type IArtifact } from './ArtifactsView';

// ── Constants ─────────────────────────────────────────────────────────────────

const isProduction =
  window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
const API_URL = isProduction ? import.meta.env.VITE_API_URL : 'http://localhost:3000';

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

// ── Component ─────────────────────────────────────────────────────────────────

export function ExecutionDrawer({ executionId, execution, onClose, defaultTab }: ExecutionDrawerProps) {
  const { token } = useAuth();

  // Store the selected tab alongside the executionId it belongs to.
  // When executionId changes (new row clicked), the ownerId mismatch resets
  // the tab to defaultTab with no extra render cycle — no useEffect needed.
  const [tabState, setTabState] = useState<{ ownerId: string | null; tab: DrawerTab }>({
    ownerId: null,
    tab: defaultTab ?? 'terminal',
  });

  const setActiveTab = (tab: DrawerTab) => setTabState({ ownerId: executionId, tab });

  const isOpen = !!executionId;

  // ── Artifacts query — lifted from ArtifactsView so the drawer can inspect ──
  // results to decide whether to show the "Artifacts" tab at all.
  const { data: artifacts = [], isLoading: artifactsLoading } = useQuery<IArtifact[]>({
    queryKey: ['artifacts', executionId, token],
    queryFn: async () => {
      const { data } = await axios.get(
        `${API_URL}/api/executions/${executionId}/artifacts`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      return data.success ? (data.data.artifacts as IArtifact[]) : [];
    },
    enabled: !!token && !!executionId,
    staleTime: 30_000,
  });

  // ── Dynamic tab list ──────────────────────────────────────────────────────
  // - "Terminal"    — always visible.
  // - "Artifacts"  — visible while loading (to show spinner) OR when results exist.
  // - "AI Analysis"— hidden for PASSED runs that have no analysis data.
  const visibleTabs = useMemo<{ id: DrawerTab; label: string }[]>(() => {
    const tabs: { id: DrawerTab; label: string }[] = [
      { id: 'terminal', label: 'Terminal' },
    ];

    if (artifactsLoading || artifacts.length > 0) {
      tabs.push({ id: 'artifacts', label: 'Artifacts' });
    }

    const hasAnalysis = !!execution?.analysis;
    if (execution?.status !== 'PASSED' || hasAnalysis) {
      tabs.push({ id: 'ai-analysis', label: 'AI Analysis' });
    }

    return tabs;
  }, [artifactsLoading, artifacts.length, execution?.status, execution?.analysis]);

  // ── Derive the effective active tab — fully pure, no effects needed ──────
  // 1. If the stored tab belongs to a different executionId, reset to defaultTab.
  // 2. Clamp the result to visibleTabs so a URL param pointing to a hidden tab
  //    (e.g. ?drawerTab=ai-analysis on a PASSED run) safely falls back to terminal.
  const desiredTab: DrawerTab =
    tabState.ownerId === executionId ? tabState.tab : (defaultTab ?? 'terminal');

  const effectiveTab: DrawerTab = visibleTabs.some((t) => t.id === desiredTab)
    ? desiredTab
    : 'terminal';

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
                  {visibleTabs.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors duration-150 cursor-pointer ${
                        effectiveTab === tab.id
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

                  {effectiveTab === 'terminal' && (
                    <TerminalView
                      output={execution?.output}
                      error={execution?.error}
                    />
                  )}

                  {effectiveTab === 'artifacts' && (
                    <div className="h-full overflow-y-auto p-6">
                      <ArtifactsView artifacts={artifacts} isLoading={artifactsLoading} />
                    </div>
                  )}

                  {effectiveTab === 'ai-analysis' && (
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
