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

const styles = {
    section: {
        marginBottom: '32px',
    } as React.CSSProperties,
    sectionTitle: {
        fontSize: '18px',
        fontWeight: 600,
        color: '#1e293b',
        marginBottom: '16px',
    } as React.CSSProperties,
    sectionDescription: {
        fontSize: '13px',
        color: '#64748b',
        marginBottom: '20px',
        lineHeight: 1.5,
    } as React.CSSProperties,
    fieldGroup: {
        marginBottom: '20px',
    } as React.CSSProperties,
    label: {
        display: 'block',
        fontSize: '14px',
        fontWeight: 500,
        color: '#374151',
        marginBottom: '8px',
    } as React.CSSProperties,
    input: {
        width: '100%',
        maxWidth: '500px',
        padding: '10px 12px',
        fontSize: '14px',
        border: '1px solid #e2e8f0',
        borderRadius: '6px',
        outline: 'none',
        transition: 'border-color 0.2s',
        boxSizing: 'border-box',
    } as React.CSSProperties,
    select: {
        width: '100%',
        maxWidth: '500px',
        padding: '10px 12px',
        fontSize: '14px',
        border: '1px solid #e2e8f0',
        borderRadius: '6px',
        outline: 'none',
        background: '#fff',
        cursor: 'pointer',
        boxSizing: 'border-box',
    } as React.CSSProperties,
    button: {
        padding: '10px 20px',
        fontSize: '14px',
        fontWeight: 600,
        color: '#ffffff',
        background: 'linear-gradient(to right, #4f46e5, #7c3aed)',
        border: 'none',
        borderRadius: '6px',
        cursor: 'pointer',
        transition: 'opacity 0.2s',
    } as React.CSSProperties,
    secondaryButton: {
        padding: '10px 20px',
        fontSize: '14px',
        fontWeight: 500,
        color: '#4f46e5',
        background: '#f1f5f9',
        border: '1px solid #e2e8f0',
        borderRadius: '6px',
        cursor: 'pointer',
        transition: 'all 0.2s',
    } as React.CSSProperties,
    divider: {
        border: 'none',
        borderTop: '1px solid #f1f5f9',
        margin: '28px 0',
    } as React.CSSProperties,
    createRow: {
        display: 'flex',
        gap: '8px',
        alignItems: 'center',
        maxWidth: '500px',
    } as React.CSSProperties,
    upgradeBanner: {
        padding: '12px 16px',
        borderRadius: '8px',
        fontSize: '13px',
        background: '#fefce8',
        color: '#854d0e',
        border: '1px solid #fde68a',
        marginTop: '8px',
    } as React.CSSProperties,
};

export function RunSettingsTab() {
    const { token, user } = useAuth();

    // Project state
    const [projects, setProjects] = useState<Project[]>([]);
    const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
    const [newProjectName, setNewProjectName] = useState('');
    const [creatingProject, setCreatingProject] = useState(false);
    const [projectLimitReached, setProjectLimitReached] = useState(false);
    const [projectLimitMessage, setProjectLimitMessage] = useState('');

    // Settings state
    const [settings, setSettings] = useState<RunSettings>({ ...EMPTY_SETTINGS });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // Fetch projects on mount
    useEffect(() => {
        fetchProjects();
    }, []);

    // Fetch settings when selected project changes
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

                // Auto-select the first project if available
                if (projectList.length > 0 && !selectedProjectId) {
                    setSelectedProjectId(projectList[0].id);
                }
            }
        } catch (error: any) {
            console.error('Failed to fetch projects:', error);
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
        } catch (error: any) {
            console.error('Failed to fetch settings:', error);
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
                { headers: { Authorization: `Bearer ${token}` } }
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
                { headers: { Authorization: `Bearer ${token}` } }
            );

            if (response.data.success) {
                setSettings(response.data.settings);
                setMessage({ type: 'success', text: 'Run settings saved successfully' });
                setTimeout(() => setMessage(null), 3000);
            }
        } catch (error: any) {
            console.error('Failed to save settings:', error);
            setMessage({
                type: 'error',
                text: error.response?.data?.error || 'Failed to save settings',
            });
        } finally {
            setSaving(false);
        }
    }

    if (loading) {
        return <div style={{ color: '#6b7280', fontSize: '14px' }}>Loading run settings...</div>;
    }

    return (
        <div>
            {/* Status Message */}
            {message && (
                <div style={{
                    padding: '12px 16px',
                    borderRadius: '8px',
                    marginBottom: '16px',
                    fontSize: '14px',
                    background: message.type === 'success' ? '#ecfdf5' : '#fef2f2',
                    color: message.type === 'success' ? '#047857' : '#b91c1c',
                    border: `1px solid ${message.type === 'success' ? '#a7f3d0' : '#fecaca'}`,
                }}>
                    {message.text}
                </div>
            )}

            {/* Project Selector Section */}
            <div style={styles.section}>
                <h2 style={styles.sectionTitle}>Project</h2>
                <p style={styles.sectionDescription}>
                    Select a project to configure its test execution defaults. These settings pre-fill the Launch Modal.
                </p>

                {projects.length > 0 ? (
                    <div style={styles.fieldGroup}>
                        <label style={styles.label}>Active Project</label>
                        <select
                            value={selectedProjectId || ''}
                            onChange={(e) => setSelectedProjectId(e.target.value)}
                            style={styles.select}
                        >
                            {projects.map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                        </select>
                    </div>
                ) : (
                    <div style={styles.fieldGroup}>
                        <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '12px' }}>
                            No projects yet. Create your first project to configure run settings.
                        </p>
                    </div>
                )}

                {/* Create Project */}
                {!projectLimitReached && (
                    <div style={styles.fieldGroup}>
                        <label style={styles.label}>
                            {projects.length === 0 ? 'Create Your First Project' : 'Add Another Project'}
                        </label>
                        <div style={styles.createRow}>
                            <input
                                type="text"
                                value={newProjectName}
                                onChange={(e) => setNewProjectName(e.target.value)}
                                placeholder="e.g. My E2E Tests"
                                style={{ ...styles.input, flex: 1, maxWidth: 'none' }}
                                onKeyDown={(e) => e.key === 'Enter' && handleCreateProject()}
                            />
                            <button
                                onClick={handleCreateProject}
                                disabled={creatingProject || !newProjectName.trim()}
                                style={{
                                    ...styles.secondaryButton,
                                    opacity: creatingProject || !newProjectName.trim() ? 0.5 : 1,
                                    cursor: creatingProject || !newProjectName.trim() ? 'not-allowed' : 'pointer',
                                    whiteSpace: 'nowrap',
                                }}
                            >
                                {creatingProject ? 'Creating...' : 'Create'}
                            </button>
                        </div>
                    </div>
                )}

                {/* Plan Limit Banner */}
                {projectLimitReached && (
                    <div style={styles.upgradeBanner}>
                        ⚡ {projectLimitMessage}.{' '}
                        <a href="/settings?tab=billing" style={{ color: '#92400e', fontWeight: 600 }}>
                            Upgrade your plan
                        </a>{' '}
                        to add more projects.
                    </div>
                )}
            </div>

            {/* Settings Form — only shown when a project is selected */}
            {selectedProjectId && (
                <>
                    <hr style={styles.divider} />

                    <div style={styles.section}>
                        <h2 style={styles.sectionTitle}>Execution Defaults</h2>
                        <p style={styles.sectionDescription}>
                            These values pre-fill the Launch Modal when triggering a new test run.
                        </p>

                        {/* Docker Image */}
                        <div style={styles.fieldGroup}>
                            <label style={styles.label}>Docker Image</label>
                            <input
                                type="text"
                                value={settings.dockerImage}
                                onChange={(e) => setSettings(prev => ({ ...prev, dockerImage: e.target.value }))}
                                placeholder="e.g. myorg/playwright-tests:latest"
                                style={styles.input}
                            />
                        </div>

                        {/* Target URLs */}
                        <div style={styles.fieldGroup}>
                            <label style={styles.label}>DEV URL</label>
                            <input
                                type="text"
                                value={settings.targetUrls.dev}
                                onChange={(e) => setSettings(prev => ({
                                    ...prev,
                                    targetUrls: { ...prev.targetUrls, dev: e.target.value },
                                }))}
                                placeholder="e.g. https://dev.myapp.com"
                                style={styles.input}
                            />
                        </div>

                        <div style={styles.fieldGroup}>
                            <label style={styles.label}>Staging URL</label>
                            <input
                                type="text"
                                value={settings.targetUrls.staging}
                                onChange={(e) => setSettings(prev => ({
                                    ...prev,
                                    targetUrls: { ...prev.targetUrls, staging: e.target.value },
                                }))}
                                placeholder="e.g. https://staging.myapp.com"
                                style={styles.input}
                            />
                        </div>

                        <div style={styles.fieldGroup}>
                            <label style={styles.label}>Production URL</label>
                            <input
                                type="text"
                                value={settings.targetUrls.prod}
                                onChange={(e) => setSettings(prev => ({
                                    ...prev,
                                    targetUrls: { ...prev.targetUrls, prod: e.target.value },
                                }))}
                                placeholder="e.g. https://myapp.com"
                                style={styles.input}
                            />
                        </div>

                        {/* Default Test Folder */}
                        <div style={styles.fieldGroup}>
                            <label style={styles.label}>Default Test Folder</label>
                            <input
                                type="text"
                                value={settings.defaultTestFolder}
                                onChange={(e) => setSettings(prev => ({ ...prev, defaultTestFolder: e.target.value }))}
                                placeholder="e.g. tests/e2e"
                                style={styles.input}
                            />
                        </div>

                        {/* Save Button */}
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            style={{
                                ...styles.button,
                                opacity: saving ? 0.5 : 1,
                                cursor: saving ? 'not-allowed' : 'pointer',
                            }}
                        >
                            {saving ? 'Saving...' : 'Save Settings'}
                        </button>
                    </div>
                </>
            )}
        </div>
    );
}
