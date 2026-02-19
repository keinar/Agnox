import React from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import { X, Loader2, CheckCircle2, XCircle, ExternalLink, ChevronDown } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface IJiraProject {
    id: string;
    key: string;
    name: string;
}

interface IJiraIssueType {
    id: string;
    name: string;
    iconUrl?: string;
}

interface ICreatedTicket {
    key: string;
    url: string;
}

interface CreateJiraTicketModalProps {
    execution: any;
    onClose: () => void;
}

type SubmitState = 'idle' | 'loading' | 'success' | 'error';

const getApiUrl = () =>
    window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1'
        ? import.meta.env.VITE_API_URL
        : 'http://localhost:3000';

const buildDescription = (execution: any): string => {
    const lines: string[] = [
        '*Failed Execution Report — Agnostic Automation Center*',
        '',
        `*Run ID:* \`${execution.taskId}\``,
        `*Status:* ${execution.status}`,
        `*Environment:* ${execution.config?.environment?.toUpperCase() ?? 'N/A'}`,
        `*Base URL:* ${execution.config?.baseUrl ?? 'N/A'}`,
        `*Docker Image:* ${execution.image ?? 'N/A'}`,
        `*Start Time:* ${execution.startTime ? new Date(execution.startTime).toLocaleString() : 'N/A'}`,
    ];

    if (execution.error) {
        const errorText = typeof execution.error === 'object'
            ? JSON.stringify(execution.error, null, 2)
            : execution.error;
        lines.push('', '*Error Details:*', '{code}', errorText.slice(0, 500), '{code}');
    }

    const logs = execution.output || execution.logs;
    if (logs) {
        const logText = Array.isArray(logs) ? logs.join('\n') : logs;
        const stripped = logText.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '').slice(0, 400);
        lines.push('', '*Log Snippet:*', '{noformat}', stripped, '{noformat}');
    }

    return lines.join('\n');
};

export function CreateJiraTicketModal({ execution, onClose }: CreateJiraTicketModalProps) {
    const { token } = useAuth();

    const [projects, setProjects] = React.useState<IJiraProject[]>([]);
    const [issueTypes, setIssueTypes] = React.useState<IJiraIssueType[]>([]);
    const [projectsLoading, setProjectsLoading] = React.useState(true);
    const [issueTypesLoading, setIssueTypesLoading] = React.useState(false);
    const [projectsError, setProjectsError] = React.useState<string | null>(null);

    const [selectedProject, setSelectedProject] = React.useState('');
    const [selectedIssueType, setSelectedIssueType] = React.useState('');
    const [summary, setSummary] = React.useState(`[AAC] Failed Run: ${execution.taskId}`);
    const [description, setDescription] = React.useState(() => buildDescription(execution));

    const [submitState, setSubmitState] = React.useState<SubmitState>('idle');
    const [submitError, setSubmitError] = React.useState<string | null>(null);
    const [createdTicket, setCreatedTicket] = React.useState<ICreatedTicket | null>(null);

    const authHeaders = React.useMemo(
        () => ({ Authorization: `Bearer ${token}` }),
        [token],
    );

    // Fetch projects on mount
    React.useEffect(() => {
        let cancelled = false;
        const API_URL = getApiUrl();

        const fetchProjects = async () => {
            try {
                const res = await axios.get<{ success: boolean; data?: IJiraProject[] }>(
                    `${API_URL}/api/jira/projects`,
                    { headers: authHeaders },
                );
                if (!cancelled && res.data.success && res.data.data) {
                    setProjects(res.data.data);
                    if (res.data.data.length > 0) {
                        setSelectedProject(res.data.data[0].id);
                    }
                }
            } catch (err: any) {
                if (!cancelled) {
                    const msg = err?.response?.data?.error ?? 'Failed to load Jira projects. Check your integration settings.';
                    setProjectsError(msg);
                }
            } finally {
                if (!cancelled) setProjectsLoading(false);
            }
        };

        fetchProjects();
        return () => { cancelled = true; };
    }, [authHeaders]);

    // Fetch issue types when project changes
    React.useEffect(() => {
        if (!selectedProject) return;

        let cancelled = false;
        setIssueTypesLoading(true);
        setIssueTypes([]);
        setSelectedIssueType('');
        const API_URL = getApiUrl();

        const fetchIssueTypes = async () => {
            try {
                const res = await axios.get<{ success: boolean; data?: IJiraIssueType[] }>(
                    `${API_URL}/api/jira/issue-types?projectId=${encodeURIComponent(selectedProject)}`,
                    { headers: authHeaders },
                );
                if (!cancelled && res.data.success && res.data.data) {
                    setIssueTypes(res.data.data);
                    if (res.data.data.length > 0) {
                        setSelectedIssueType(res.data.data[0].id);
                    }
                }
            } catch {
                // Non-critical; user can still submit without pre-selected type
            } finally {
                if (!cancelled) setIssueTypesLoading(false);
            }
        };

        fetchIssueTypes();
        return () => { cancelled = true; };
    }, [selectedProject, authHeaders]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitState('loading');
        setSubmitError(null);
        const API_URL = getApiUrl();

        const selectedProjectObj = projects.find(p => p.id === selectedProject);

        try {
            const res = await axios.post<{ success: boolean; data?: ICreatedTicket; error?: string }>(
                `${API_URL}/api/jira/tickets`,
                {
                    projectId: selectedProject,
                    projectKey: selectedProjectObj?.key,
                    issueType: selectedIssueType,
                    summary: summary.trim(),
                    description: description.trim(),
                    executionId: execution._id,
                    taskId: execution.taskId,
                },
                { headers: authHeaders },
            );

            if (res.data.success && res.data.data) {
                setCreatedTicket(res.data.data);
                setSubmitState('success');
            } else {
                throw new Error(res.data.error ?? 'Unexpected response from server.');
            }
        } catch (err: any) {
            const msg = err?.response?.data?.error ?? err?.message ?? 'Failed to create Jira ticket.';
            setSubmitError(msg);
            setSubmitState('error');
        }
    };

    const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (e.target === e.currentTarget) onClose();
    };

    const modal = (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4"
            onClick={handleBackdropClick}
        >
            <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0">
                            <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white" aria-hidden="true">
                                <path d="M11.53 2c0 2.4 1.97 4.35 4.35 4.35H17.5v1.61C17.5 10.36 19.46 12.3 21.85 12.3V2.85a.85.85 0 0 0-.85-.85H11.53ZM6.77 6.8a4.362 4.362 0 0 0 4.35 4.34h1.62v1.63a4.362 4.362 0 0 0 4.34 4.34V7.65a.85.85 0 0 0-.85-.85H6.77ZM2 11.6c0 2.4 1.97 4.35 4.35 4.35h1.62v1.62C7.97 20.03 9.94 22 12.32 22v-9.54a.85.85 0 0 0-.85-.85L2 11.6Z"/>
                            </svg>
                        </div>
                        <div>
                            <h2 className="text-sm font-semibold text-slate-900">Create Jira Ticket</h2>
                            <p className="text-xs text-slate-400 font-mono">{execution.taskId}</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                        aria-label="Close"
                    >
                        <X size={16} />
                    </button>
                </div>

                {/* Body */}
                <div className="overflow-y-auto flex-1 px-6 py-5">
                    {/* Loading projects */}
                    {projectsLoading && (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 size={22} className="animate-spin text-indigo-500" />
                            <span className="ml-3 text-sm text-slate-500">Loading Jira projects…</span>
                        </div>
                    )}

                    {/* Projects error */}
                    {!projectsLoading && projectsError && (
                        <div className="flex items-start gap-2 rounded-lg px-3 py-3 bg-rose-50 border border-rose-200 text-rose-700 text-sm">
                            <XCircle size={15} className="flex-shrink-0 mt-0.5" />
                            <div>
                                <p className="font-semibold">Could not load projects</p>
                                <p className="text-xs mt-0.5">{projectsError}</p>
                                <a
                                    href="/settings?tab=integrations"
                                    className="text-xs underline mt-1 inline-block text-rose-600 hover:text-rose-800"
                                >
                                    Go to Integration Settings →
                                </a>
                            </div>
                        </div>
                    )}

                    {/* Success state */}
                    {submitState === 'success' && createdTicket && (
                        <div className="flex flex-col items-center gap-4 py-8 text-center">
                            <div className="w-14 h-14 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center">
                                <CheckCircle2 size={28} className="text-emerald-600" />
                            </div>
                            <div>
                                <h3 className="text-sm font-semibold text-slate-900">Ticket created!</h3>
                                <p className="text-xs text-slate-500 mt-1">
                                    Your Jira ticket has been created successfully.
                                </p>
                            </div>
                            <a
                                href={createdTicket.url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                            >
                                Open {createdTicket.key} in Jira
                                <ExternalLink size={13} />
                            </a>
                        </div>
                    )}

                    {/* Form */}
                    {!projectsLoading && !projectsError && submitState !== 'success' && (
                        <form id="jira-ticket-form" onSubmit={handleSubmit} className="space-y-4">
                            {/* Project selector */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-600 mb-1.5" htmlFor="jira-project">
                                    Project
                                </label>
                                <div className="relative">
                                    <select
                                        id="jira-project"
                                        required
                                        value={selectedProject}
                                        onChange={e => setSelectedProject(e.target.value)}
                                        className="w-full appearance-none pl-3 pr-8 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                                    >
                                        {projects.length === 0 && <option value="">No projects found</option>}
                                        {projects.map(p => (
                                            <option key={p.id} value={p.id}>{p.name} ({p.key})</option>
                                        ))}
                                    </select>
                                    <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                </div>
                            </div>

                            {/* Issue Type selector */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-600 mb-1.5" htmlFor="jira-issue-type">
                                    Issue Type
                                    {issueTypesLoading && (
                                        <Loader2 size={11} className="inline-block ml-2 animate-spin text-slate-400" />
                                    )}
                                </label>
                                <div className="relative">
                                    <select
                                        id="jira-issue-type"
                                        required
                                        value={selectedIssueType}
                                        onChange={e => setSelectedIssueType(e.target.value)}
                                        disabled={issueTypesLoading || issueTypes.length === 0}
                                        className="w-full appearance-none pl-3 pr-8 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition"
                                    >
                                        {issueTypes.length === 0 && !issueTypesLoading && (
                                            <option value="">Select a project first</option>
                                        )}
                                        {issueTypes.map(t => (
                                            <option key={t.id} value={t.id}>{t.name}</option>
                                        ))}
                                    </select>
                                    <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                </div>
                            </div>

                            {/* Summary */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-600 mb-1.5" htmlFor="jira-summary">
                                    Summary
                                </label>
                                <input
                                    id="jira-summary"
                                    type="text"
                                    required
                                    maxLength={255}
                                    value={summary}
                                    onChange={e => setSummary(e.target.value)}
                                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                                />
                            </div>

                            {/* Description */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-600 mb-1.5" htmlFor="jira-description">
                                    Description
                                    <span className="ml-1 font-normal text-slate-400">(Jira Wiki Markup)</span>
                                </label>
                                <textarea
                                    id="jira-description"
                                    rows={8}
                                    value={description}
                                    onChange={e => setDescription(e.target.value)}
                                    className="w-full px-3 py-2 text-xs font-mono border border-slate-200 rounded-lg bg-slate-50 text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-y transition"
                                />
                            </div>

                            {/* Submit error */}
                            {submitState === 'error' && submitError && (
                                <div className="flex items-start gap-2 rounded-lg px-3 py-2.5 bg-rose-50 border border-rose-200 text-rose-700 text-sm">
                                    <XCircle size={15} className="flex-shrink-0 mt-0.5" />
                                    <span>{submitError}</span>
                                </div>
                            )}
                        </form>
                    )}
                </div>

                {/* Footer */}
                {!projectsLoading && !projectsError && submitState !== 'success' && (
                    <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50 rounded-b-2xl flex-shrink-0">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            form="jira-ticket-form"
                            disabled={submitState === 'loading' || !selectedProject}
                            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                        >
                            {submitState === 'loading' && <Loader2 size={14} className="animate-spin" />}
                            {submitState === 'loading' ? 'Creating…' : 'Create Ticket'}
                        </button>
                    </div>
                )}

                {/* Footer for success state */}
                {submitState === 'success' && (
                    <div className="flex justify-center px-6 py-4 border-t border-slate-100 bg-slate-50 rounded-b-2xl flex-shrink-0">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors"
                        >
                            Close
                        </button>
                    </div>
                )}
            </div>
        </div>
    );

    return createPortal(modal, document.body);
}
