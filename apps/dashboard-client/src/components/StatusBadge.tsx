import { CheckCircle2, XCircle, Play, Clock } from 'lucide-react';

interface Props {
    status: string;
}

export const StatusBadge = ({ status }: Props) => {
    const config = {
        PASSED: { icon: CheckCircle2, className: 'passed' },
        FAILED: { icon: XCircle, className: 'failed' },
        RUNNING: { icon: Play, className: 'running' },
    }[status] || { icon: Clock, className: 'running' };

    const Icon = config.icon;

    return (
        <div className={`badge ${config.className}`}>
            <Icon size={14} />
            {status}
        </div>
    );
};