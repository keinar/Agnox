import { Activity, CheckCircle2, Server } from 'lucide-react';
import type { Execution } from '../types';

interface Props {
    executions: Execution[];
}

export const StatsGrid = ({ executions }: Props) => {
    const totalRuns = executions.length;
    const passedRuns = executions.filter(e => e.status === 'PASSED').length;
    const passRate = totalRuns > 0 ? Math.round((passedRuns / totalRuns) * 100) : 0;

    return (
        <div className="stats-grid">
            <StatCard 
                icon={<Activity color="#60a5fa" />} 
                title="Total Runs" 
                value={totalRuns} 
            />
            <StatCard 
                icon={<CheckCircle2 color="#10b981" />} 
                title="Pass Rate" 
                value={`${passRate}%`} 
            />
            <StatCard 
                icon={<Server color="#a78bfa" />} 
                title="Active Services" 
                value="3" 
            />
        </div>
    );
};

// Internal sub-component
const StatCard = ({ icon, title, value }: any) => (
    <div className="stat-card">
        <div className="stat-icon">{icon}</div>
        <div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{title}</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{value}</div>
        </div>
    </div>
);