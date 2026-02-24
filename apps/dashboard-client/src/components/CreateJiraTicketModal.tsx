import React from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import {
    X, Loader2, CheckCircle2, XCircle, ExternalLink,
    ChevronDown, Plus, Ticket,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

// ── Interfaces ────────────────────────────────────────────────────────────────

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

interface IJiraAssignee {
    accountId: string;
    displayName: string;
    emailAddress?: string | null;
    avatarUrl?: string | null;
}

interface ICustomFieldSchema {
    key: string;
    name: string;
    required: boolean;
    schema: { type: string; items?: string; custom?: string };
    allowedValues?: { id: string; value: string }[];
}

interface ICreatedTicket {
    key: string;
    url: string;
}

/** A Jira ticket reference previously saved on the execution document. */
interface IJiraTicketRef {
    ticketKey: string;
    ticketUrl: string;
    createdAt: string;
}

interface CreateJiraTicketModalProps {
    execution: any;
    onClose: () => void;
}

type SubmitState = 'idle' | 'loading' | 'success' | 'error';

/** Which panel the modal currently displays. */
type ModalView = 'existing-tickets' | 'form';

// ── Helpers ───────────────────────────────────────────────────────────────────

const getApiUrl = (): string =>
    window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1'
        ? import.meta.env.VITE_API_URL
        : 'http://localhost:3000';

const resolveRunSource = (): 'LOCAL' | 'CLOUD' => {
    const { hostname } = window.location;
    return hostname === 'localhost' || hostname === '127.0.0.1' ? 'LOCAL' : 'CLOUD';
};

const buildDescription = (execution: any): string => {
    const source = resolveRunSource();
    const lines: string[] = [
        '*Failed Execution Report — Agnox*',
        '',
        `*Run ID:* \`${execution.taskId}\``,
        `*Status:* ${execution.status}`,
        `*Source:* ${source}`,
        `*Environment:* ${execution.config?.environment?.toUpperCase() ?? 'N/A'}`,
        `*Base URL:* ${execution.config?.baseUrl ?? 'N/A'}`,
        `*Docker Image:* ${execution.image ?? 'N/A'}`,
        `*Start Time:* ${execution.startTime ? new Date(execution.startTime).toLocaleString() : 'N/A'}`,
    ];

    if (execution.error) {
        const errorText =
            typeof execution.error === 'object'
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

// ── Shared select / input classes ─────────────────────────────────────────────

const SELECT_CLASS =
    'w-full appearance-none pl-3 pr-8 py-2 text-sm border border-slate-200 rounded-lg ' +
    'bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 ' +
    'focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition';

const INPUT_CLASS =
    'w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-900 ' +
    'placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 ' +
    'focus:border-blue-500 transition';

// ── Component ─────────────────────────────────────────────────────────────────

export function CreateJiraTicketModal({ execution, onClose }: CreateJiraTicketModalProps) {
    const { token } = useAuth();

    // Derive existing tickets from the execution document
    const existingTickets: IJiraTicketRef[] = execution.jiraTickets ?? [];

    // Modal view state — start on the existing-tickets panel if there are linked tickets
    const [view, setView] = React.useState<ModalView>(
        existingTickets.length > 0 ? 'existing-tickets' : 'form',
    );

    // ── Project / issue-type state ────────────────────────────────────────────
    const [projects, setProjects] = React.useState<IJiraProject[]>([]);
    const [issueTypes, setIssueTypes] = React.useState<IJiraIssueType[]>([]);
    const [projectsLoading, setProjectsLoading] = React.useState(true);
    const [issueTypesLoading, setIssueTypesLoading] = React.useState(false);
    const [projectsError, setProjectsError] = React.useState<string | null>(null);

    const [selectedProject, setSelectedProject] = React.useState('');
    const [selectedIssueType, setSelectedIssueType] = React.useState('');

    // ── Assignee state ────────────────────────────────────────────────────────
    const [assignees, setAssignees] = React.useState<IJiraAssignee[]>([]);
    const [assigneesLoading, setAssigneesLoading] = React.useState(false);
    const [selectedAssignee, setSelectedAssignee] = React.useState('');

    // ── Custom fields state ───────────────────────────────────────────────────
    const [customFieldSchemas, setCustomFieldSchemas] = React.useState<ICustomFieldSchema[]>([]);
    const [customFieldValues, setCustomFieldValues] = React.useState<Record<string, string>>({});
    const [customFieldsLoading, setCustomFieldsLoading] = React.useState(false);

    // ── Form fields ───────────────────────────────────────────────────────────
    const [summary, setSummary] = React.useState(`[AAC] Failed Run: ${execution.taskId}`);
    const [description, setDescription] = React.useState(() => buildDescription(execution));

    // ── Submit state ──────────────────────────────────────────────────────────
    const [submitState, setSubmitState] = React.useState<SubmitState>('idle');
    const [submitError, setSubmitError] = React.useState<string | null>(null);
    const [createdTicket, setCreatedTicket] = React.useState<ICreatedTicket | null>(null);

    const authHeaders = React.useMemo(
        () => ({ Authorization: `Bearer ${token}` }),
        [token],
    );

    // ── Fetch projects on mount ───────────────────────────────────────────────
    React.useEffect(() => {
        let cancelled = false;
        const API_URL = getApiUrl();

        (async () => {
            try {
                const res = await axios.get<{ success: boolean; data?: IJiraProject[] }>(
                    `${API_URL}/api/jira/projects`,
                    { headers: authHeaders },
                );
                if (!cancelled && res.data.success && res.data.data) {
                    const fetchedProjects = res.data.data;
                    setProjects(fetchedProjects);
                    if (fetchedProjects.length > 0) {
                        const cached = localStorage.getItem('jira_selected_project');
                        const exists = fetchedProjects.some((p) => p.id === cached);
                        const initial = exists ? cached! : fetchedProjects[0].id;
                        setSelectedProject((prev) => prev || initial);
                    }
                }
            } catch (err: any) {
                if (!cancelled) {
                    setProjectsError(
                        err?.response?.data?.error ?? 'Failed to load Jira projects. Check your integration settings.',
                    );
                }
            } finally {
                if (!cancelled) setProjectsLoading(false);
            }
        })();

        return () => { cancelled = true; };
    }, [authHeaders]);

    // Derive the selected project's key (needed for issue types, assignees + createmeta)
    const selectedProjectKey = React.useMemo(
        () => projects.find((p) => p.id === selectedProject)?.key ?? '',
        [projects, selectedProject],
    );

    // ── Fetch issue types when project changes ────────────────────────────────
    React.useEffect(() => {
        if (!selectedProject) return;

        const currentProject = projects.find((p) => p.id === selectedProject);
        if (!currentProject?.key) return;

        let cancelled = false;
        setIssueTypesLoading(true);
        setIssueTypes([]);
        setSelectedIssueType('');
        const API_URL = getApiUrl();

        (async () => {
            try {
                const res = await axios.get<{ success: boolean; data?: IJiraIssueType[] }>(
                    `${API_URL}/api/jira/issue-types?projectKey=${encodeURIComponent(currentProject.key)}`,
                    { headers: authHeaders },
                );
                if (!cancelled && res.data.success && res.data.data) {
                    const fetchedTypes = res.data.data;
                    setIssueTypes(fetchedTypes);
                    if (fetchedTypes.length > 0) {
                        const cached = localStorage.getItem('jira_selected_issueType');
                        const exists = fetchedTypes.some((t) => t.id === cached);
                        if (exists) {
                            setSelectedIssueType(cached!);
                        }
                    }
                }
            } catch {
                // Non-critical; user can change project to retry
            } finally {
                if (!cancelled) setIssueTypesLoading(false);
            }
        })();

        return () => { cancelled = true; };
    }, [selectedProject, projects, authHeaders]);

    // ── Auto-select first issue type when loaded ──────────────────────────────
    React.useEffect(() => {
        if (issueTypes.length > 0 && !selectedIssueType) {
            setSelectedIssueType(issueTypes[0].id);
        }
    }, [issueTypes, selectedIssueType]);

    // ── Persist selected project to localStorage ──────────────────────────────
    React.useEffect(() => {
        if (selectedProject) {
            localStorage.setItem('jira_selected_project', selectedProject);
        }
    }, [selectedProject]);

    // ── Persist selected issue type to localStorage ───────────────────────────
    React.useEffect(() => {
        if (selectedIssueType) {
            localStorage.setItem('jira_selected_issueType', selectedIssueType);
        }
    }, [selectedIssueType]);

    // ── Persist selected assignee to localStorage ─────────────────────────────
    React.useEffect(() => {
        if (selectedAssignee) {
            localStorage.setItem('jira_selected_assignee', selectedAssignee);
        } else {
            localStorage.removeItem('jira_selected_assignee');
        }
    }, [selectedAssignee]);

    // ── Fetch assignees when project key is known ─────────────────────────────
    React.useEffect(() => {
        if (!selectedProjectKey) return;

        let cancelled = false;
        setAssigneesLoading(true);
        setAssignees([]);
        setSelectedAssignee('');
        const API_URL = getApiUrl();

        (async () => {
            try {
                const res = await axios.get<{ success: boolean; data?: IJiraAssignee[] }>(
                    `${API_URL}/api/jira/assignees?projectKey=${encodeURIComponent(selectedProjectKey)}`,
                    { headers: authHeaders },
                );
                if (!cancelled && res.data.success && res.data.data) {
                    const fetchedAssignees = res.data.data;
                    setAssignees(fetchedAssignees);
                    const cached = localStorage.getItem('jira_selected_assignee');
                    if (cached && fetchedAssignees.some((a) => a.accountId === cached)) {
                        setSelectedAssignee(cached);
                    } else {
                        setSelectedAssignee('');
                    }
                }
            } catch {
                // Assignees are optional; fail silently
            } finally {
                if (!cancelled) setAssigneesLoading(false);
            }
        })();

        return () => { cancelled = true; };
    }, [selectedProjectKey, authHeaders]);

    // ── Fetch custom field schema when project key + issue type are known ──────
    React.useEffect(() => {
        if (!selectedProjectKey || !selectedIssueType) return;

        let cancelled = false;
        setCustomFieldsLoading(true);
        setCustomFieldSchemas([]);
        setCustomFieldValues({});
        const API_URL = getApiUrl();

        (async () => {
            try {
                const res = await axios.get<{ success: boolean; data?: ICustomFieldSchema[] }>(
                    `${API_URL}/api/jira/createmeta` +
                    `?projectKey=${encodeURIComponent(selectedProjectKey)}` +
                    `&issueTypeId=${encodeURIComponent(selectedIssueType)}`,
                    { headers: authHeaders },
                );
                if (!cancelled && res.data.success && res.data.data) {
                    setCustomFieldSchemas(res.data.data);
                }
            } catch {
                // Custom fields are optional; fail silently
            } finally {
                if (!cancelled) setCustomFieldsLoading(false);
            }
        })();

        return () => { cancelled = true; };
    }, [selectedProjectKey, selectedIssueType, authHeaders]);

    // ── Submit handler ────────────────────────────────────────────────────────
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitState('loading');
        setSubmitError(null);
        const API_URL = getApiUrl();

        // Build customFields payload — array-type fields split on comma; the loop
        // only populates the map. The API call happens once after the loop.
        const customFieldsPayload: Record<string, unknown> = {};
        for (const schema of customFieldSchemas) {
            const raw = customFieldValues[schema.key]?.trim() ?? '';
            if (!raw) continue;

            // Rich-text fields require Atlassian Document Format (ADF).
            // Caught by two indicators:
            //   1. schema.type === 'doc'  → paragraph custom fields
            //   2. schema.custom === '...textarea' → plain-textarea custom fields
            //      (Jira returns type 'string' for these, but they still demand ADF in v3)
            const isDocField =
                schema.schema?.type === 'doc' ||
                schema.schema?.custom === 'com.atlassian.jira.plugin.system.customfieldtypes:textarea' ||
                schema.schema?.custom === 'com.atlassian.jira.plugin.system.customfieldtypes:paragraph';

            if (schema.schema?.type === 'array') {
                const parts = raw.split(',').map((s) => s.trim()).filter(Boolean);
                if (Array.isArray(schema.allowedValues) && schema.allowedValues.length > 0) {
                    customFieldsPayload[schema.key] = parts.map((val) => ({ id: val }));
                } else {
                    customFieldsPayload[schema.key] = parts;
                }
            } else if (isDocField) {
                customFieldsPayload[schema.key] = {
                    version: 1,
                    type: 'doc',
                    content: [{ type: 'paragraph', content: [{ type: 'text', text: String(raw) }] }],
                };
            } else if (Array.isArray(schema.allowedValues) && schema.allowedValues.length > 0) {
                // Jira v3 custom select fields expect { id: "<option-id>" }
                customFieldsPayload[schema.key] = { id: raw };
            } else {
                customFieldsPayload[schema.key] = raw;
            }
        }

        try {
            const res = await axios.post<{ success: boolean; data?: ICreatedTicket; error?: string }>(
                `${API_URL}/api/jira/tickets`,
                {
                    projectKey: selectedProjectKey,
                    issueType: selectedIssueType,
                    summary: summary.trim(),
                    description: description.trim(),
                    executionId: execution._id ?? execution.taskId,
                    assigneeId: selectedAssignee || undefined,
                    customFields: Object.keys(customFieldsPayload).length > 0
                        ? customFieldsPayload
                        : undefined,
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

    // ── Backdrop click handler ────────────────────────────────────────────────
    const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (e.target === e.currentTarget) onClose();
    };

    // ── Custom field renderer ─────────────────────────────────────────────────
    const renderCustomField = (schema: ICustomFieldSchema) => {
        const value = customFieldValues[schema.key] ?? '';
        const onChange = (v: string) =>
            setCustomFieldValues((prev) => ({ ...prev, [schema.key]: v }));

        // Mirror the payload builder's isDocField logic so the UI matches the format sent.
        const isDocField =
            schema.schema?.type === 'doc' ||
            schema.schema?.custom === 'com.atlassian.jira.plugin.system.customfieldtypes:textarea' ||
            schema.schema?.custom === 'com.atlassian.jira.plugin.system.customfieldtypes:paragraph';

        const label = (
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                {schema.name}
                {schema.required && <span className="ml-1 text-rose-500">*</span>}
                {schema.schema?.type === 'array' && (!Array.isArray(schema.allowedValues) || schema.allowedValues.length === 0) && (
                    <span className="ml-1 font-normal text-slate-400">(comma-separated)</span>
                )}
            </label>
        );

        if (Array.isArray(schema.allowedValues) && schema.allowedValues.length > 0) {
            return (
                <div key={schema.key}>
                    {label}
                    <div className="relative">
                        <select
                            required={schema.required}
                            value={value}
                            onChange={(e) => onChange(e.target.value)}
                            className={SELECT_CLASS}
                        >
                            <option value="">Select {schema.name}...</option>
                            {schema.allowedValues.map((opt) => (
                                <option key={opt.id} value={opt.id}>{opt.value}</option>
                            ))}
                        </select>
                        <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    </div>
                </div>
            );
        }

        if (schema.schema?.type === 'date') {
            return (
                <div key={schema.key}>
                    {label}
                    <input
                        type="date"
                        required={schema.required}
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        className={INPUT_CLASS}
                    />
                </div>
            );
        }

        if (schema.schema?.type === 'datetime') {
            return (
                <div key={schema.key}>
                    {label}
                    <input
                        type="datetime-local"
                        required={schema.required}
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        className={INPUT_CLASS}
                    />
                </div>
            );
        }

        if (isDocField) {
            return (
                <div key={schema.key}>
                    {label}
                    <textarea
                        rows={4}
                        required={schema.required}
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-y transition"
                    />
                </div>
            );
        }

        return (
            <div key={schema.key}>
                {label}
                <input
                    type="text"
                    required={schema.required}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={schema.schema?.type === 'array' ? 'value1, value2' : ''}
                    className={INPUT_CLASS}
                />
            </div>
        );
    };

    // ── Modal JSX ─────────────────────────────────────────────────────────────

    const modal = (
        <div
            role="button"
            tabIndex={-1}
            aria-label="Close modal"
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 cursor-default"
            onClick={handleBackdropClick}
            onKeyDown={(e) => { if (e.key === 'Escape') handleBackdropClick(e as any); }}
        >
            <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col max-h-[90vh]">

                {/* ── Header ── */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0">
                            {/* Jira logo */}
                            <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white" aria-hidden="true">
                                <path d="M11.53 2c0 2.4 1.97 4.35 4.35 4.35H17.5v1.61C17.5 10.36 19.46 12.3 21.85 12.3V2.85a.85.85 0 0 0-.85-.85H11.53ZM6.77 6.8a4.362 4.362 0 0 0 4.35 4.34h1.62v1.63a4.362 4.362 0 0 0 4.34 4.34V7.65a.85.85 0 0 0-.85-.85H6.77ZM2 11.6c0 2.4 1.97 4.35 4.35 4.35h1.62v1.62C7.97 20.03 9.94 22 12.32 22v-9.54a.85.85 0 0 0-.85-.85L2 11.6Z" />
                            </svg>
                        </div>
                        <div>
                            <h2 className="text-sm font-semibold text-slate-900">
                                {view === 'existing-tickets' ? 'Linked Jira Tickets' : 'Create Jira Ticket'}
                            </h2>
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

                {/* ── Body ── */}
                <div className="overflow-y-auto flex-1 px-6 py-5">

                    {/* ── State: existing tickets list ── */}
                    {view === 'existing-tickets' && (
                        <div className="space-y-3">
                            <p className="text-xs text-slate-500">
                                {existingTickets.length} ticket{existingTickets.length !== 1 ? 's' : ''} already linked to this run.
                            </p>
                            <ul className="space-y-2">
                                {existingTickets.map((t) => (
                                    <li
                                        key={t.ticketKey}
                                        className="flex items-center justify-between px-4 py-3 rounded-xl border border-blue-100 bg-blue-50"
                                    >
                                        <div className="flex items-center gap-2.5">
                                            <Ticket size={15} className="text-blue-500 flex-shrink-0" />
                                            <div>
                                                <span className="text-sm font-semibold text-blue-700">{t.ticketKey}</span>
                                                {t.createdAt && (
                                                    <p className="text-[11px] text-slate-400 mt-0.5">
                                                        {new Date(t.createdAt).toLocaleString()}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                        <a
                                            href={t.ticketUrl}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-white border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            Open <ExternalLink size={11} />
                                        </a>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* ── State: projects loading ── */}
                    {view === 'form' && projectsLoading && (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 size={22} className="animate-spin text-blue-500" />
                            <span className="ml-3 text-sm text-slate-500">Loading Jira projects…</span>
                        </div>
                    )}

                    {/* ── State: projects error ── */}
                    {view === 'form' && !projectsLoading && projectsError && (
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

                    {/* ── State: success ── */}
                    {view === 'form' && submitState === 'success' && createdTicket && (
                        <div className="flex flex-col items-center gap-4 py-8 text-center">
                            <div className="w-14 h-14 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center">
                                <CheckCircle2 size={28} className="text-emerald-600" />
                            </div>
                            <div>
                                <h3 className="text-sm font-semibold text-slate-900">Ticket created!</h3>
                                <p className="text-xs text-slate-500 mt-1">
                                    Your Jira ticket has been created and linked to this run.
                                </p>
                            </div>
                            <a
                                href={createdTicket.url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                            >
                                Open {createdTicket.key} in Jira <ExternalLink size={13} />
                            </a>
                        </div>
                    )}

                    {/* ── State: form ── */}
                    {view === 'form' && !projectsLoading && !projectsError && submitState !== 'success' && (
                        <form id="jira-ticket-form" onSubmit={handleSubmit} className="space-y-4">

                            {/* Project */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-600 mb-1.5" htmlFor="jira-project">
                                    Project
                                </label>
                                <div className="relative">
                                    <select
                                        id="jira-project"
                                        required
                                        value={selectedProject}
                                        onChange={(e) => setSelectedProject(e.target.value)}
                                        className={SELECT_CLASS}
                                    >
                                        {projects.length === 0 && <option value="">No projects found</option>}
                                        {projects.map((p) => (
                                            <option key={p.id} value={p.id}>{p.name} ({p.key})</option>
                                        ))}
                                    </select>
                                    <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                </div>
                            </div>

                            {/* Issue Type */}
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
                                        onChange={(e) => setSelectedIssueType(e.target.value)}
                                        disabled={!selectedProject || issueTypesLoading}
                                        className={SELECT_CLASS}
                                    >
                                        {issueTypesLoading && (
                                            <option value="">Loading issue types...</option>
                                        )}
                                        {!issueTypesLoading && !selectedProject && (
                                            <option value="">Select a project first</option>
                                        )}
                                        {!issueTypesLoading && selectedProject && issueTypes.length === 0 && (
                                            <option value="">No issue types found</option>
                                        )}
                                        {issueTypes.map((t) => (
                                            <option key={t.id} value={t.id}>{t.name}</option>
                                        ))}
                                    </select>
                                    <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                </div>
                            </div>

                            {/* Assignee */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-600 mb-1.5" htmlFor="jira-assignee">
                                    Assignee
                                    <span className="ml-1 font-normal text-slate-400">(optional)</span>
                                    {assigneesLoading && (
                                        <Loader2 size={11} className="inline-block ml-2 animate-spin text-slate-400" />
                                    )}
                                </label>
                                <div className="relative">
                                    <select
                                        id="jira-assignee"
                                        value={selectedAssignee}
                                        onChange={(e) => setSelectedAssignee(e.target.value)}
                                        disabled={assigneesLoading}
                                        className={SELECT_CLASS}
                                    >
                                        <option value="">Unassigned</option>
                                        {assignees.map((a) => (
                                            <option key={a.accountId} value={a.accountId}>
                                                {a.displayName}
                                                {a.emailAddress ? ` (${a.emailAddress})` : ''}
                                            </option>
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
                                    onChange={(e) => setSummary(e.target.value)}
                                    className={INPUT_CLASS}
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
                                    onChange={(e) => setDescription(e.target.value)}
                                    className="w-full px-3 py-2 text-xs font-mono border border-slate-200 rounded-lg bg-slate-50 text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-y transition"
                                />
                            </div>

                            {/* Dynamic custom fields */}
                            {customFieldsLoading && (
                                <div className="flex items-center gap-2 text-xs text-slate-400">
                                    <Loader2 size={12} className="animate-spin" />
                                    Loading custom fields…
                                </div>
                            )}
                            {!customFieldsLoading && customFieldSchemas.length > 0 && (
                                <div className="space-y-4 pt-1 border-t border-slate-100">
                                    <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide pt-1">
                                        Custom Fields
                                    </p>
                                    {customFieldSchemas.map(renderCustomField)}
                                </div>
                            )}

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

                {/* ── Footer ── */}

                {/* Existing-tickets footer */}
                {view === 'existing-tickets' && (
                    <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50 rounded-b-2xl flex-shrink-0">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors"
                        >
                            Close
                        </button>
                        <button
                            type="button"
                            onClick={() => setView('form')}
                            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                        >
                            <Plus size={14} />
                            Create Another Ticket
                        </button>
                    </div>
                )}

                {/* Form footer */}
                {view === 'form' && !projectsLoading && !projectsError && submitState !== 'success' && (
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
                            disabled={submitState === 'loading' || !selectedProject || !selectedIssueType}
                            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                        >
                            {submitState === 'loading' && <Loader2 size={14} className="animate-spin" />}
                            {submitState === 'loading' ? 'Creating…' : 'Create Ticket'}
                        </button>
                    </div>
                )}

                {/* Success footer */}
                {view === 'form' && submitState === 'success' && (
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
