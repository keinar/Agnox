import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface PaginationProps {
    total: number;
    limit: number;
    offset: number;
    onPageChange: (newOffset: number) => void;
    loading?: boolean;
}

// ── Component ─────────────────────────────────────────────────────────────────

export const Pagination: React.FC<PaginationProps> = ({
    total,
    limit,
    offset,
    onPageChange,
    loading = false,
}) => {
    if (total === 0) return null;

    const currentPage = Math.floor(offset / limit) + 1;
    const totalPages  = Math.ceil(total / limit);
    const from        = offset + 1;
    const to          = Math.min(offset + limit, total);
    const hasPrev     = offset > 0;
    const hasNext     = offset + limit < total;

    const btnBase =
        'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg ' +
        'border transition-colors duration-100';

    const btnEnabled =
        'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:border-slate-300 cursor-pointer';

    const btnDisabled =
        'border-slate-100 bg-slate-50 text-slate-300 cursor-not-allowed';

    return (
        <div
            className={`
                flex items-center justify-between px-1 pt-3 mt-1
                transition-opacity duration-150 ${loading ? 'opacity-50 pointer-events-none' : ''}
            `}
        >
            {/* Results summary */}
            <span className="text-xs text-slate-500">
                Showing{' '}
                <span className="font-semibold text-slate-700">{from}–{to}</span>
                {' '}of{' '}
                <span className="font-semibold text-slate-700">{total}</span>
                {' '}result{total !== 1 ? 's' : ''}
            </span>

            {/* Navigation */}
            <div className="flex items-center gap-2">
                <button
                    type="button"
                    disabled={!hasPrev}
                    onClick={() => hasPrev && onPageChange(Math.max(0, offset - limit))}
                    className={`${btnBase} ${hasPrev ? btnEnabled : btnDisabled}`}
                    aria-label="Previous page"
                >
                    <ChevronLeft size={13} />
                    Previous
                </button>

                <span className="px-3 py-1.5 text-xs font-semibold text-slate-600 bg-slate-100 rounded-lg border border-slate-200 select-none">
                    {currentPage} / {totalPages}
                </span>

                <button
                    type="button"
                    disabled={!hasNext}
                    onClick={() => hasNext && onPageChange(offset + limit)}
                    className={`${btnBase} ${hasNext ? btnEnabled : btnDisabled}`}
                    aria-label="Next page"
                >
                    Next
                    <ChevronRight size={13} />
                </button>
            </div>
        </div>
    );
};
