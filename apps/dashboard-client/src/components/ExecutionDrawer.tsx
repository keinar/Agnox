import React, { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogPanel, Transition, TransitionChild } from '@headlessui/react';
import {
  X, FileText, BarChart2, Loader2, Bug,
  Github, Gitlab, Cloud, GitBranch, GitCommit, GitPullRequest, ExternalLink,
  ChevronDown, ChevronRight,
} from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import type { Execution } from '../types';
import { useAuth } from '../context/AuthContext';
import { TerminalView } from './TerminalView';
import { AIAnalysisView } from './AIAnalysisView';
import { ArtifactsView, type IArtifact } from './ArtifactsView';
import { CreateJiraTicketModal } from './CreateJiraTicketModal';

// ── Constants ─────────────────────────────────────────────────────────────────

const isProduction =
  window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
const _viteApiUrl = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '');
const API_URL: string = isProduction ? (_viteApiUrl ?? window.location.origin) : 'http://localhost:3000';

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
  const queryClient = useQueryClient();
  const [fetchingReport, setFetchingReport] = useState(false);
  const [showJiraModal, setShowJiraModal] = useState(false);
  const [ciContextOpen, setCiContextOpen] = useState(true);

  // ── Log-history hydration ────────────────────────────────────────────────
  // Fetches the full accumulated log buffer from the server and seeds the
  // React Query cache. Runs on three occasions:
  //   1. Drawer opens for a new executionId (executionId dependency changes).
  //   2. Browser tab regains focus (visibilitychange → 'visible').
  //   3. token changes (e.g. after a silent re-auth).
  //
  // Intentionally not gated on execution.status so that completed executions
  // also re-hydrate correctly when the drawer is reopened. The /logs endpoint
  // returns the Redis live-buffer for RUNNING executions and the MongoDB
  // output field for completed ones — the same call covers both cases.
  //
  // The cache is only updated when the server payload is longer than what is
  // already stored, so an in-flight socket stream is never regressed.
  useEffect(() => {
    if (!executionId || !token) return;

    // Extract the fetch into a named function so both the initial call and
    // the visibilitychange handler can reuse it without duplication.
    const fetchLogs = (): AbortController => {
      const controller = new AbortController();
      axios
        .get(`${API_URL}/api/executions/${executionId}/logs`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        })
        .then(({ data }) => {
          const historical: string = data?.data?.output ?? '';
          if (!historical) return;

          // Seed every matching executions query in the cache. The existing
          // socket handler in useExecutions will continue appending incremental
          // chunks to this pre-hydrated output string — no duplicate connection.
          queryClient.setQueriesData(
            { queryKey: ['executions'], exact: false },
            (old: any) => {
              if (!old?.executions) return old;
              return {
                ...old,
                executions: old.executions.map((ex: Execution) =>
                  ex.taskId === executionId &&
                  ((ex as any).output?.length ?? 0) < historical.length
                    ? { ...ex, output: historical }
                    : ex,
                ),
              };
            },
          );
        })
        .catch(() => {
          // Non-critical: the socket will still stream future log chunks.
        });
      return controller;
    };

    // Initial hydration when the drawer opens.
    let controller = fetchLogs();

    // Re-hydrate whenever the browser tab regains focus. This recovers log
    // chunks that the Socket.io stream may have missed while the tab was hidden.
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        controller.abort();
        controller = fetchLogs();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      controller.abort();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [executionId, token, queryClient]);

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
    refetchInterval: () => {
      // Poll every 3 seconds if the parent execution is still running or analyzing
      if (execution?.status === 'RUNNING' || execution?.status === 'ANALYZING') return 3000;
      return false;
    },
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
    if (execution?.status !== 'ERROR' && (execution?.status !== 'PASSED' || hasAnalysis)) {
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

  const isFinished = execution && new Set(['PASSED', 'FAILED', 'UNSTABLE']).has(execution.status);
  const LOCAL_INDICATORS = ['localhost', '127.0.0.1', 'host.docker.internal'];
  const isRunLocal = execution ? [
    (execution as any).environment,
    (execution as any).config?.baseUrl,
    (execution as any).baseUrl,
    (execution as any).meta?.baseUrl,
  ].some((v: any) => v && LOCAL_INDICATORS.some((indicator) => v.includes(indicator))) : false;

  const isDashboardCloud = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
  const areReportsInaccessible = isDashboardCloud && isRunLocal;

  const getBaseUrl = () => {
    if ((execution as any)?.reportsBaseUrl) return (execution as any).reportsBaseUrl.replace(/\/$/, '');
    const envBaseUrl = import.meta.env.VITE_API_URL;
    if (envBaseUrl) return envBaseUrl.replace(/\/$/, '');
    return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      ? 'http://localhost:3000' : `https://api.${window.location.hostname}`;
  };

  const baseUrl = getBaseUrl();
  const htmlReportUrl = execution ? `${baseUrl}/${execution.taskId}/native-report/index.html` : '';
  const allureReportUrl = execution ? `${baseUrl}/${execution.taskId}/allure-report/index.html` : '';

  const handleViewReport = async (reportUrl: string) => {
    if (!executionId) return;
    const win = window.open('about:blank', '_blank');
    setFetchingReport(true);
    try {
      const apiBase = import.meta.env.VITE_API_URL || '';
      const res = await fetch(`${apiBase}/api/executions/${executionId}/report-token`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const token = json?.data?.token;
      if (!token) throw new Error('No token in response');
      const url = `${reportUrl}?token=${encodeURIComponent(token)}`;
      if (win) win.location.href = url;
      else window.open(url, '_blank');
    } catch (err) {
      console.error('[report-token] Failed:', err);
      if (win) win.location.href = reportUrl;
      else window.open(reportUrl, '_blank');
    } finally {
      setFetchingReport(false);
    }
  };

  const iconBtnBase = 'flex items-center justify-center w-8 h-8 rounded-lg border transition-colors cursor-pointer';

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
              <DialogPanel className="relative flex h-full flex-col bg-white dark:bg-gh-bg-dark border-l border-slate-200 dark:border-gh-border-dark shadow-2xl w-full max-w-full md:w-[600px] lg:w-[896px]">

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
                  <div className="flex items-center gap-2">
                    {/* Analyzing spinner */}
                    {execution?.status === 'ANALYZING' && (
                      <div
                        role="status"
                        aria-label="AI Analysis in progress"
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800"
                      >
                        <Loader2 size={12} className="animate-spin" />
                        <span>Analyzing...</span>
                      </div>
                    )}

                    {/* Create / View Jira Ticket button — FAILED/ERROR/UNSTABLE */}
                    {execution && (execution.status === 'FAILED' || execution.status === 'ERROR' || execution.status === 'UNSTABLE') && (() => {
                      const hasTickets = ((execution as any).jiraTickets?.length ?? 0) > 0;
                      return (
                        <button
                          onClick={() => setShowJiraModal(true)}
                          title={hasTickets ? `${(execution as any).jiraTickets.length} Jira ticket(s) linked — click to view or create another` : 'Create Jira Ticket'}
                          aria-label={hasTickets ? 'View or create Jira ticket' : 'Create Jira Ticket'}
                          className={`${iconBtnBase} ${hasTickets
                            ? 'text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/40 border-blue-300 dark:border-blue-700 hover:bg-blue-200 dark:hover:bg-blue-900/60'
                            : 'text-blue-500 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-950/50'
                            }`}
                        >
                          <Bug size={16} />
                        </button>
                      );
                    })()}

                    {/* Report links */}
                    {execution && isFinished && (
                      <>
                        {areReportsInaccessible ? (
                          <span
                            title="Reports available locally"
                            className="text-[10px] text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded cursor-help"
                          >
                            Local Reports
                          </span>
                        ) : (
                          <>
                            {execution.hasNativeReport === true && (
                              <button
                                type="button"
                                disabled={fetchingReport}
                                title="HTML Report"
                                aria-label="Open HTML Report"
                                onClick={() => handleViewReport(htmlReportUrl)}
                                className={`${iconBtnBase} text-blue-500 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-950/50 disabled:opacity-50 disabled:cursor-wait`}
                              >
                                {fetchingReport ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
                              </button>
                            )}
                            {execution.hasAllureReport === true && (
                              <button
                                type="button"
                                disabled={fetchingReport}
                                title="Allure Report"
                                aria-label="Open Allure Report"
                                onClick={() => handleViewReport(allureReportUrl)}
                                className={`${iconBtnBase} text-emerald-500 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-950/50 disabled:opacity-50 disabled:cursor-wait`}
                              >
                                {fetchingReport ? <Loader2 size={16} className="animate-spin" /> : <BarChart2 size={16} />}
                              </button>
                            )}
                          </>
                        )}
                      </>
                    )}

                    <button
                      onClick={onClose}
                      aria-label="Close drawer"
                      className="ml-2 flex shrink-0 items-center justify-center w-8 h-8 rounded-lg text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors duration-150 cursor-pointer"
                    >
                      <X size={18} />
                    </button>
                  </div>
                </div>

                {/* ── CI Context panel — only for external-ci runs ──────── */}
                {(execution as any)?.source === 'external-ci' && (() => {
                  const ci = (execution as any)?.ingestMeta?.ciContext;
                  const CI_PROVIDER_ICONS: Record<string, React.ElementType> = {
                    github: Github, gitlab: Gitlab, azure: Cloud,
                    jenkins: Cloud, local: Cloud,
                  };
                  const ProviderIcon = ci?.source ? (CI_PROVIDER_ICONS[ci.source] ?? Cloud) : Cloud;
                  const providerLabel: Record<string, string> = {
                    github: 'GitHub', gitlab: 'GitLab', azure: 'Azure DevOps',
                    jenkins: 'Jenkins', local: 'Local',
                  };

                  return (
                    <div className="shrink-0 border-b border-violet-100 dark:border-violet-900/50 bg-violet-50/60 dark:bg-violet-950/20">
                      {/* Collapsible header */}
                      <button
                        type="button"
                        onClick={() => setCiContextOpen((v) => !v)}
                        className="w-full flex items-center justify-between px-6 py-2.5 cursor-pointer group"
                      >
                        <div className="flex items-center gap-2">
                          <ProviderIcon size={14} className="text-violet-600 dark:text-violet-400 shrink-0" />
                          <span className="text-xs font-semibold text-violet-700 dark:text-violet-300 uppercase tracking-wide">
                            CI Context
                            {ci?.source && (
                              <span className="ml-1.5 font-normal normal-case text-violet-500 dark:text-violet-400">
                                — {providerLabel[ci.source] ?? ci.source}
                              </span>
                            )}
                          </span>
                        </div>
                        {ciContextOpen
                          ? <ChevronDown size={14} className="text-violet-400 dark:text-violet-500 group-hover:text-violet-600 dark:group-hover:text-violet-300 transition-colors" />
                          : <ChevronRight size={14} className="text-violet-400 dark:text-violet-500 group-hover:text-violet-600 dark:group-hover:text-violet-300 transition-colors" />
                        }
                      </button>

                      {/* Collapsible body */}
                      {ciContextOpen && (
                        <div className="px-6 pb-3 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">

                          {ci?.repository && (
                            <div className="flex items-start gap-2 min-w-0">
                              <ProviderIcon size={12} className="text-violet-400 dark:text-violet-500 mt-0.5 shrink-0" />
                              <div className="min-w-0">
                                <p className="text-[10px] font-medium text-violet-400 dark:text-violet-500 uppercase tracking-wide mb-0.5">Repository</p>
                                <p className="text-xs text-slate-700 dark:text-slate-300 font-medium truncate">{ci.repository}</p>
                              </div>
                            </div>
                          )}

                          {ci?.branch && (
                            <div className="flex items-start gap-2 min-w-0">
                              <GitBranch size={12} className="text-violet-400 dark:text-violet-500 mt-0.5 shrink-0" />
                              <div className="min-w-0">
                                <p className="text-[10px] font-medium text-violet-400 dark:text-violet-500 uppercase tracking-wide mb-0.5">Branch</p>
                                <p className="text-xs text-slate-700 dark:text-slate-300 font-mono truncate">{ci.branch}</p>
                              </div>
                            </div>
                          )}

                          {ci?.prNumber && (
                            <div className="flex items-start gap-2 min-w-0">
                              <GitPullRequest size={12} className="text-violet-400 dark:text-violet-500 mt-0.5 shrink-0" />
                              <div className="min-w-0">
                                <p className="text-[10px] font-medium text-violet-400 dark:text-violet-500 uppercase tracking-wide mb-0.5">Pull Request</p>
                                <p className="text-xs text-slate-700 dark:text-slate-300 font-mono">#{ci.prNumber}</p>
                              </div>
                            </div>
                          )}

                          {ci?.commitSha && (
                            <div className="flex items-start gap-2 min-w-0">
                              <GitCommit size={12} className="text-violet-400 dark:text-violet-500 mt-0.5 shrink-0" />
                              <div className="min-w-0">
                                <p className="text-[10px] font-medium text-violet-400 dark:text-violet-500 uppercase tracking-wide mb-0.5">Commit</p>
                                <p className="text-xs text-slate-700 dark:text-slate-300 font-mono truncate" title={ci.commitSha}>
                                  {ci.commitSha.slice(0, 12)}
                                </p>
                              </div>
                            </div>
                          )}

                          {ci?.runUrl && (
                            <div className="flex items-start gap-2 min-w-0 sm:col-span-2">
                              <ExternalLink size={12} className="text-violet-400 dark:text-violet-500 mt-0.5 shrink-0" />
                              <div className="min-w-0">
                                <p className="text-[10px] font-medium text-violet-400 dark:text-violet-500 uppercase tracking-wide mb-0.5">CI Job URL</p>
                                <a
                                  href={ci.runUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium truncate block max-w-xs"
                                >
                                  {ci.runUrl}
                                </a>
                              </div>
                            </div>
                          )}

                          {!ci && (
                            <p className="text-xs text-violet-400 dark:text-violet-500 italic sm:col-span-2">
                              No CI context metadata available for this run.
                            </p>
                          )}

                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* ── Tab bar ───────────────────────────────────────────── */}
                <div className="flex items-center gap-1 px-6 border-b border-slate-200 dark:border-gh-border-dark shrink-0">
                  {visibleTabs.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors duration-150 cursor-pointer ${effectiveTab === tab.id
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

      {showJiraModal && execution && (
        <CreateJiraTicketModal
          execution={execution}
          onClose={() => setShowJiraModal(false)}
        />
      )}
    </Transition>
  );
}
