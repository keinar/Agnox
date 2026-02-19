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
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <StatCard
                icon={<Activity size={20} className="text-blue-500" />}
                title="Total Runs"
                value={totalRuns}
            />
            <StatCard
                icon={<CheckCircle2 size={20} className="text-emerald-500" />}
                title="Pass Rate"
                value={`${passRate}%`}
            />
            <StatCard
                icon={<Server size={20} className="text-violet-500" />}
                title="Active Services"
                value="3"
            />
        </div>
    );
};

interface StatCardProps {
    icon: React.ReactNode;
    title: string;
    value: string | number;
}

const StatCard = ({ icon, title, value }: StatCardProps) => (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex items-center gap-4">
        <div className="flex-shrink-0 w-11 h-11 rounded-xl bg-slate-50 flex items-center justify-center">
            {icon}
        </div>
        <div>
            <div className="text-sm text-slate-500">{title}</div>
            <div className="text-2xl font-bold text-slate-900">{value}</div>
        </div>
    </div>
);
