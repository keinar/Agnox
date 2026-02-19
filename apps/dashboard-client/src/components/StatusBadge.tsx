import React from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Sparkles, Clock, Play } from 'lucide-react';

interface Props {
    status: string;
}

interface BadgeConfig {
    icon: React.ElementType;
    className: string;
    iconClassName?: string;
}

const STATUS_CONFIG: Record<string, BadgeConfig> = {
    PASSED:    { icon: CheckCircle2,  className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    FAILED:    { icon: XCircle,       className: 'bg-rose-50 text-rose-700 border-rose-200' },
    ERROR:     { icon: XCircle,       className: 'bg-rose-50 text-rose-700 border-rose-200' },
    RUNNING:   { icon: Play,          className: 'bg-amber-50 text-amber-700 border-amber-200',   iconClassName: 'animate-spin' },
    PENDING:   { icon: Clock,         className: 'bg-amber-50 text-amber-700 border-amber-200',   iconClassName: 'animate-pulse' },
    ANALYZING: { icon: Sparkles,      className: 'bg-purple-50 text-purple-700 border-purple-200', iconClassName: 'animate-pulse' },
    UNSTABLE:  { icon: AlertTriangle, className: 'bg-amber-50 text-amber-700 border-amber-200' },
};

const DEFAULT_CONFIG: BadgeConfig = {
    icon: Clock,
    className: 'bg-slate-100 text-slate-600 border-slate-200',
};

export const StatusBadge = ({ status }: Props) => {
    const config = STATUS_CONFIG[status] ?? DEFAULT_CONFIG;
    const Icon = config.icon;

    return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${config.className}`}>
            <Icon size={13} className={config.iconClassName} />
            {status}
        </span>
    );
};
