/**
 * Run Settings Tab
 *
 * Per-project configuration for test execution defaults.
 * Includes a project selector dropdown with inline project creation.
 * Free plan: max 1 project; shows upgrade prompt when limit is reached.
 */

import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

interface Project {
    id: string;
    name: string;
    slug: string;
}

interface RunSettings {
    dockerImage: string;
    targetUrls: {
        dev: string;
        staging: string;
        prod: string;
    };
    defaultTestFolder: string;
}

const EMPTY_SETTINGS: RunSettings = {
    dockerImage: '',
    targetUrls: { dev: '', staging: '', prod: '' },
    defaultTestFolder: '',
};

// ── Shared class strings ───────────────────────────────────────────────────────

const INPUT_CLASS =
    'w-full max-w-lg px-3 py-2.5 text-sm border border-slate-300 dark:border-gh-border-dark rounded-lg ' +
    'bg-white dark:bg-gh-bg-dark text-slate-900 dark:text-slate-200 ' +
    'placeholder-slate-400 dark:placeholder-slate-500 ' +
    'focus:outline-none focus:ring-2 focus:ring-gh-accent dark:focus:ring-gh-accent-dark focus:border-transparent transition ' +
    'box-border';

const SELECT_CLASS =
    'w-full max-w-lg px-3 py-2.5 text-sm border border-slate-300 dark:border-gh-border-dark rounded-lg ' +
    'bg-white dark:bg-gh-bg-dark text-slate-900 dark:text-slate-200 ' +
    'focus:outline-none focus:ring-2 focus:ring-gh-accent dark:focus:ring-gh-accent-dark focus:border-transparent transition cursor-pointer ' +
    'box-border';

// ── Component ──────────────────────────────────────────────────────────────────

export function RunSettingsTab() {
    const { token } = useAuth();

    const [projects, setProjects] = useState<Project[]>([]);
    const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
    const [newProjectName, setNewProjectName] = useState('');
    const [creatingProject, setCreatingProject] = useState(false);
    const [projectLimitReached, setProjectLimitReached] = useState(false);
    const [projectLimitMessage, setProjectLimitMessage] = useState('');

    const [settings, setSettings] = useState<RunSettings>({ ...EMPTY_SETTINGS });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    useEffect(() => { fetchProjects(); }, []);

    useEffect(() => {
        if (selectedProjectId) {
            fetchSettings(selectedProjectId);
        } else {
            setSettings({ ...EMPTY_SETTINGS });
        }
    }, [selectedProjectId]);

    async function fetchProjects() {
        try {
            const response = await axios.get(`${API_URL}/api/projects`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (response.data.success) {
                const projectList: Project[] = response.data.projects;
                setProjects(projectList);
                if (projectList.length > 0 && !selectedProjectId) {
                    setSelectedProjectId(projectList[0].id);
                }
            }
        } catch (error: any) {
            setMessage({
                type: 'error',
                text: error.response?.data?.error || 'Failed to load projects',
            });
        } finally {
            setLoading(false);
        }
    }

    async function fetchSettings(projectId: string) {
        try {
            const response = await axios.get(`${API_URL}/api/projects/${projectId}/settings`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (response.data.success) {
                setSettings(response.data.settings);
            }
        } catch {
            setSettings({ ...EMPTY_SETTINGS });
        }
    }

    async function handleCreateProject() {
        if (!newProjectName.trim()) return;

        setCreatingProject(true);
        setMessage(null);
        setProjectLimitReached(false);

        try {
            const response = await axios.post(
                `${API_URL}/api/projects`,
                { name: newProjectName.trim() },
                { headers: { Authorization: `Bearer ${token}` } },
            );
            if (response.data.success) {
                const created = response.data.project;
                setProjects(prev => [created, ...prev]);
                setSelectedProjectId(created.id);
                setNewProjectName('');
                setMessage({ type: 'success', text: `Project "${created.name}" created` });
                setTimeout(() => setMessage(null), 3000);
            }
        } catch (error: any) {
            if (error.response?.status === 403) {
                setProjectLimitReached(true);
                setProjectLimitMessage(error.response.data.error || 'Project limit reached');
            } else {
                setMessage({
                    type: 'error',
                    text: error.response?.data?.error || 'Failed to create project',
                });
            }
        } finally {
            setCreatingProject(false);
        }
    }

    async function handleSave() {
        if (!selectedProjectId) return;

        setSaving(true);
        setMessage(null);

        try {
            const response = await axios.put(
                `${API_URL}/api/projects/${selectedProjectId}/settings`,
                settings,
                { headers: { Authorization: `Bearer ${token}` } },
            );
            if (response.data.success) {
                setSettings(response.data.settings);
                setMessage({ type: 'success', text: 'Run settings saved successfully' });
                setTimeout(() => setMessage(null), 3000);
            }
        } catch (error: any) {
            setMessage({
                type: 'error',
                text: error.response?.data?.error || 'Failed to save settings',
            });
        } finally {
            setSaving(false);
        }
    }

    if (loading) {
        return <p className="text-sm text-slate-500 dark:text-slate-400">Loading run settings...</p>;
    }

    return (
        <div>
            {/* Feedback banner */}
            {message && (
                <div className={`mb-4 px-4 py-3 rounded-lg text-sm border ${
                    message.type === 'success'
                        ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400'
                        : 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400'
                }`}>
                    {message.text}
                </div>
            )}

            {/* ── Project Selector ──────────────────────────────────────────────── */}
            <section className="mb-8">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-1">Project</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-5">
                    Select a project to configure its test execution defaults. These settings pre-fill the Launch Modal.
                </p>

                {projects.length > 0 && (
                    <div className="mb-5">
                        <label htmlFor="active-project" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                            Active Project
                        </label>
                        <select
                            id="active-project"
                            value={selectedProjectId || ''}
                            onChange={(e) => setSelectedProjectId(e.target.value)}
                            className={SELECT_CLASS}
                        >
                            {projects.map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                        </select>
                    </div>
                )}

                {projects.length === 0 && (
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                        No projects yet. Create your first project to configure run settings.
                    </p>
                )}

                {/* Create project row */}
                {!projectLimitReached && (
                    <div className="mb-5">
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                            {projects.length === 0 ? 'Create Your First Project' : 'Add Another Project'}
                        </label>
                        <div className="flex gap-2 items-center max-w-lg">
                            <input
                                type="text"
                                value={newProjectName}
                                onChange={(e) => setNewProjectName(e.target.value)}
                                placeholder="e.g. My E2E Tests"
                                className={`flex-1 min-w-0 px-3 py-2.5 text-sm border border-slate-300 dark:border-gh-border-dark rounded-lg bg-white dark:bg-gh-bg-dark text-slate-900 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-gh-accent dark:focus:ring-gh-accent-dark focus:border-transparent transition`}
                                onKeyDown={(e) => e.key === 'Enter' && handleCreateProject()}
                            />
                            <button
                                onClick={handleCreateProject}
                                disabled={creatingProject || !newProjectName.trim()}
                                className="px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-gh-bg-dark border border-slate-300 dark:border-gh-border-dark rounded-lg hover:bg-slate-50 dark:hover:bg-gh-bg-subtle-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer whitespace-nowrap"
                            >
                                {creatingProject ? 'Creating...' : 'Create'}
                            </button>
                        </div>
                    </div>
                )}

                {/* Plan limit banner */}
                {projectLimitReached && (
                    <div className="mt-2 px-4 py-3 rounded-lg text-sm bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                        ⚡ {projectLimitMessage}.{' '}
                        <a
                            href="/settings?tab=billing"
                            className="font-semibold underline hover:no-underline"
                        >
                            Upgrade your plan
                        </a>{' '}
                        to add more projects.
                    </div>
                )}
            </section>

            {/* ── Execution Defaults ─────────────────────────────────────────────── */}
            {selectedProjectId && (
                <>
                    <hr className="border-0 border-t border-slate-200 dark:border-gh-border-dark my-7" />

                    <section className="mb-8">
                        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-1">
                            Execution Defaults
                        </h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mb-5">
                            These values pre-fill the Launch Modal when triggering a new test run.
                        </p>

                        {/* Docker Image */}
                        <div className="mb-5">
                            <label htmlFor="rs-docker-image" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                Docker Image
                            </label>
                            <input
                                id="rs-docker-image"
                                type="text"
                                value={settings.dockerImage}
                                onChange={(e) => setSettings(prev => ({ ...prev, dockerImage: e.target.value }))}
                                placeholder="e.g. myorg/playwright-tests:latest"
                                className={INPUT_CLASS}
                            />
                        </div>

                        {/* DEV URL */}
                        <div className="mb-5">
                            <label htmlFor="rs-dev-url" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                DEV URL
                            </label>
                            <input
                                id="rs-dev-url"
                                type="text"
                                value={settings.targetUrls.dev}
                                onChange={(e) => setSettings(prev => ({
                                    ...prev,
                                    targetUrls: { ...prev.targetUrls, dev: e.target.value },
                                }))}
                                placeholder="e.g. https://dev.myapp.com"
                                className={INPUT_CLASS}
                            />
                        </div>

                        {/* Staging URL */}
                        <div className="mb-5">
                            <label htmlFor="rs-staging-url" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                Staging URL
                            </label>
                            <input
                                id="rs-staging-url"
                                type="text"
                                value={settings.targetUrls.staging}
                                onChange={(e) => setSettings(prev => ({
                                    ...prev,
                                    targetUrls: { ...prev.targetUrls, staging: e.target.value },
                                }))}
                                placeholder="e.g. https://staging.myapp.com"
                                className={INPUT_CLASS}
                            />
                        </div>

                        {/* Production URL */}
                        <div className="mb-5">
                            <label htmlFor="rs-prod-url" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                Production URL
                            </label>
                            <input
                                id="rs-prod-url"
                                type="text"
                                value={settings.targetUrls.prod}
                                onChange={(e) => setSettings(prev => ({
                                    ...prev,
                                    targetUrls: { ...prev.targetUrls, prod: e.target.value },
                                }))}
                                placeholder="e.g. https://myapp.com"
                                className={INPUT_CLASS}
                            />
                        </div>

                        {/* Default Test Folder */}
                        <div className="mb-5">
                            <label htmlFor="rs-test-folder" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                Default Test Folder
                            </label>
                            <input
                                id="rs-test-folder"
                                type="text"
                                value={settings.defaultTestFolder}
                                onChange={(e) => setSettings(prev => ({ ...prev, defaultTestFolder: e.target.value }))}
                                placeholder="e.g. tests/e2e"
                                className={INPUT_CLASS}
                            />
                        </div>

                        {/* Save button */}
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="px-5 py-2.5 text-sm font-semibold text-white bg-gh-accent dark:bg-gh-accent-dark hover:opacity-90 rounded-lg transition-opacity cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {saving ? 'Saving...' : 'Save Settings'}
                        </button>
                    </section>
                </>
            )}
        </div>
    );
}
