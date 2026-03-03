import { useState, useRef, useEffect, useCallback, FormEvent } from 'react';
import axios from 'axios';
import {
    Send, Bot, User, BarChart2, Loader2, Plus, MessageSquare, Clock, Menu, X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// ── Types ─────────────────────────────────────────────────────────────────────

interface IChartData {
    type: 'bar' | 'line' | 'pie';
    title: string;
    labels: string[];
    values: number[];
}

interface IMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    chartData?: IChartData;
    isLoading?: boolean;
}

interface ISessionSummary {
    conversationId: string;
    title: string;
    updatedAt: string;
}

// ── Mini bar chart (pure CSS/HTML — no extra dependency) ──────────────────────

function InlineBarChart({ data }: { data: IChartData }) {
    const max = Math.max(...data.values, 1);

    return (
        <div className="mt-3 p-4 rounded-xl bg-slate-50 dark:bg-gh-bg-dark border border-slate-200 dark:border-gh-border-dark overflow-x-auto">
            <div className="flex items-center gap-2 mb-3">
                <BarChart2 size={14} className="text-blue-500" />
                <span className="text-[12px] font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wide">
                    {data.title}
                </span>
            </div>
            <div className="flex flex-col gap-2 min-w-0">
                {data.labels.map((label, idx) => {
                    const value = data.values[idx] ?? 0;
                    const pct = Math.round((value / max) * 100);
                    const display = Number.isInteger(value) ? value.toLocaleString() : value.toFixed(2);
                    return (
                        <div key={label} className="flex items-center gap-3">
                            <span
                                className="text-[11px] text-slate-500 dark:text-slate-400 text-right shrink-0"
                                style={{ width: '90px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                                title={label}
                            >
                                {label}
                            </span>
                            <div className="flex-1 flex items-center gap-2 min-w-0">
                                <div className="flex-1 h-5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden min-w-[40px]">
                                    <div
                                        className="h-full bg-blue-500 dark:bg-blue-400 rounded-full transition-all duration-500"
                                        style={{ width: `${pct}%` }}
                                    />
                                </div>
                                <span className="text-[11px] font-medium text-slate-600 dark:text-slate-300 shrink-0 w-10 text-right">
                                    {display}
                                </span>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// ── Message bubble ─────────────────────────────────────────────────────────────

function MessageBubble({ message }: { message: IMessage }) {
    const isUser = message.role === 'user';

    if (message.isLoading) {
        return (
            <div className="flex items-end gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                    <Bot size={16} className="text-blue-600 dark:text-blue-400" />
                </div>
                <div className="max-w-[90%] md:max-w-[70%] rounded-2xl rounded-bl-sm px-4 py-3 bg-white dark:bg-gh-bg-subtle-dark border border-slate-200 dark:border-gh-border-dark shadow-sm">
                    <div className="flex items-center gap-2 text-slate-400 dark:text-slate-500">
                        <Loader2 size={14} className="animate-spin" />
                        <span className="text-[13px]">Analysing your data…</span>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={`flex items-end gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
            <div
                className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${isUser
                        ? 'bg-slate-200 dark:bg-slate-700'
                        : 'bg-blue-100 dark:bg-blue-900'
                    }`}
            >
                {isUser
                    ? <User size={16} className="text-slate-600 dark:text-slate-300" />
                    : <Bot size={16} className="text-blue-600 dark:text-blue-400" />
                }
            </div>
            <div
                className={`max-w-[90%] md:max-w-[70%] rounded-2xl px-4 py-3 text-[14px] leading-relaxed shadow-sm ${isUser
                        ? 'bg-blue-600 text-white rounded-br-sm'
                        : 'bg-white dark:bg-gh-bg-subtle-dark text-slate-800 dark:text-gh-text-dark border border-slate-200 dark:border-gh-border-dark rounded-bl-sm'
                    }`}
            >
                <p className="whitespace-pre-wrap">{message.content}</p>
                {message.chartData && message.chartData.labels.length > 0 && (
                    <InlineBarChart data={message.chartData} />
                )}
            </div>
        </div>
    );
}

// ── Empty state ────────────────────────────────────────────────────────────────

const SUGGESTED_QUESTIONS = [
    'How many test executions passed last week?',
    'Which test group has the highest failure rate?',
    'Show me a breakdown of execution statuses this month.',
    'What is the average execution duration per group?',
];

function EmptyState({ onSuggest }: { onSuggest: (q: string) => void }) {
    return (
        <div className="flex flex-col items-center justify-center flex-1 gap-4 px-6 text-center">
            <div className="w-16 h-16 rounded-2xl bg-blue-50 dark:bg-blue-950/30 flex items-center justify-center">
                <Bot size={32} className="text-blue-500" />
            </div>
            <div>
                <h2 className="text-[15px] font-semibold text-slate-800 dark:text-gh-text-dark mb-1">
                    Ask AI about your test quality
                </h2>
                <p className="text-[13px] text-slate-500 dark:text-slate-400 max-w-sm">
                    Ask questions in plain English — the AI will query your execution data and
                    summarise the results for you.
                </p>
            </div>
            <div className="flex flex-col gap-2 w-full max-w-sm">
                {SUGGESTED_QUESTIONS.map((q) => (
                    <button
                        key={q}
                        onClick={() => onSuggest(q)}
                        className="px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-gh-bg-subtle-dark border border-slate-200 dark:border-gh-border-dark text-[12px] text-slate-600 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-blue-950/20 hover:border-blue-200 dark:hover:border-blue-800 hover:text-blue-700 dark:hover:text-blue-300 transition-colors text-left"
                    >
                        {q}
                    </button>
                ))}
            </div>
        </div>
    );
}

// ── History sidebar ────────────────────────────────────────────────────────────

function HistorySidebar({
    sessions,
    isLoading,
    activeId,
    onSelect,
    onNewChat,
    isOpen,
    onClose,
}: {
    sessions: ISessionSummary[];
    isLoading: boolean;
    activeId: string | null;
    onSelect: (id: string) => void;
    onNewChat: () => void;
    isOpen: boolean;
    onClose: () => void;
}) {
    const fmt = (iso: string) => {
        const d = new Date(iso);
        const now = new Date();
        const diffMs = now.getTime() - d.getTime();
        const diffDays = Math.floor(diffMs / 86_400_000);
        if (diffDays === 0) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 7) return `${diffDays}d ago`;
        return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    };

    return (
        <>
            {/* Mobile backdrop */}
            {isOpen && (
                <div
                    className="fixed inset-0 z-20 bg-black/40 md:hidden"
                    onClick={onClose}
                    aria-hidden="true"
                />
            )}

            <aside
                className={[
                    // Base
                    'flex-shrink-0 flex flex-col bg-white dark:bg-gh-bg-dark border-r border-slate-200 dark:border-gh-border-dark',
                    // Mobile: fixed overlay that slides in from left
                    'fixed inset-y-0 left-0 z-30 w-72 transition-transform duration-300 md:translate-x-0 md:static md:w-64 md:z-auto',
                    isOpen ? 'translate-x-0' : '-translate-x-full',
                ].join(' ')}
            >
                {/* Header */}
                <div className="px-3 pt-4 pb-3 border-b border-slate-100 dark:border-gh-border-dark">
                    {/* Mobile close button */}
                    <div className="flex items-center justify-between mb-2 md:hidden">
                        <span className="text-[13px] font-semibold text-slate-700 dark:text-gh-text-dark">Chat History</span>
                        <button
                            onClick={onClose}
                            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-gh-bg-subtle-dark transition-colors"
                            aria-label="Close sidebar"
                        >
                            <X size={18} />
                        </button>
                    </div>
                    <button
                        onClick={() => { onNewChat(); onClose(); }}
                        className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-[13px] font-medium transition-colors"
                    >
                        <Plus size={15} />
                        New Chat
                    </button>
                </div>

                {/* Session list */}
                <div className="flex-1 overflow-y-auto px-2 py-2">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 size={18} className="animate-spin text-slate-400" />
                        </div>
                    ) : sessions.length === 0 ? (
                        <div className="flex flex-col items-center gap-2 py-8 px-4 text-center">
                            <MessageSquare size={20} className="text-slate-300 dark:text-slate-600" />
                            <p className="text-[12px] text-slate-400 dark:text-slate-500">
                                No previous conversations
                            </p>
                        </div>
                    ) : (
                        sessions.map((s) => (
                            <button
                                key={s.conversationId}
                                onClick={() => { onSelect(s.conversationId); onClose(); }}
                                className={`w-full text-left px-3 py-2.5 rounded-lg mb-0.5 transition-colors group ${activeId === s.conversationId
                                        ? 'bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300'
                                        : 'text-slate-700 dark:text-gh-text-dark hover:bg-slate-50 dark:hover:bg-gh-bg-subtle-dark'
                                    }`}
                            >
                                <p className="text-[12px] font-medium leading-snug truncate">{s.title}</p>
                                <div className="flex items-center gap-1 mt-0.5">
                                    <Clock size={10} className="text-slate-400 dark:text-slate-500 flex-shrink-0" />
                                    <span className="text-[10px] text-slate-400 dark:text-slate-500">
                                        {fmt(s.updatedAt)}
                                    </span>
                                </div>
                            </button>
                        ))
                    )}
                </div>
            </aside>
        </>
    );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export function ChatPage() {
    const { token } = useAuth();

    // Chat state
    const [messages, setMessages] = useState<IMessage[]>([]);
    const [input, setInput] = useState('');
    const [conversationId, setConversationId] = useState<string | null>(null);
    const [isSending, setIsSending] = useState(false);

    // Sidebar state
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    // History state
    const [sessions, setSessions] = useState<ISessionSummary[]>([]);
    const [isHistoryLoading, setIsHistoryLoading] = useState(true);
    const [isLoadingConv, setIsLoadingConv] = useState(false);

    const bottomRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    // ── Fetch history on mount ─────────────────────────────────────────────────
    const fetchHistory = useCallback(async () => {
        try {
            const res = await axios.get(`${API_URL}/api/ai/chat/history`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            setSessions(res.data.data?.sessions ?? []);
        } catch {
            // Non-fatal — sidebar just stays empty
        } finally {
            setIsHistoryLoading(false);
        }
    }, [token]);

    useEffect(() => { fetchHistory(); }, [fetchHistory]);

    // ── Auto-scroll ────────────────────────────────────────────────────────────
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // ── New chat ───────────────────────────────────────────────────────────────
    const handleNewChat = () => {
        setMessages([]);
        setConversationId(null);
        setInput('');
        inputRef.current?.focus();
    };

    // ── Load a historical conversation ─────────────────────────────────────────
    const handleSelectConversation = async (id: string) => {
        if (id === conversationId || isLoadingConv) return;
        setIsLoadingConv(true);
        setMessages([]);
        try {
            const res = await axios.get(`${API_URL}/api/ai/chat/${id}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const { history } = res.data.data as {
                conversationId: string;
                history: Array<{ role: 'user' | 'assistant'; content: string; chartData?: IChartData }>;
            };
            setConversationId(id);
            setMessages(
                history.map((h) => ({
                    id: crypto.randomUUID(),
                    role: h.role,
                    content: h.content,
                    chartData: h.chartData,
                })),
            );
        } catch {
            setMessages([{
                id: crypto.randomUUID(),
                role: 'assistant',
                content: 'Could not load this conversation. Please try again.',
            }]);
        } finally {
            setIsLoadingConv(false);
        }
    };

    // ── Send message ───────────────────────────────────────────────────────────
    const handleSubmit = async (e: FormEvent | null, overrideText?: string) => {
        if (e) e.preventDefault();
        const trimmed = (overrideText ?? input).trim();
        if (!trimmed || isSending) return;

        const userMsg: IMessage = {
            id: crypto.randomUUID(),
            role: 'user',
            content: trimmed,
        };
        const loadingMsg: IMessage = {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: '',
            isLoading: true,
        };

        setMessages((prev) => [...prev, userMsg, loadingMsg]);
        setInput('');
        setIsSending(true);

        try {
            const res = await axios.post(
                `${API_URL}/api/ai/chat`,
                { message: trimmed, ...(conversationId ? { conversationId } : {}) },
                { headers: { Authorization: `Bearer ${token}` } },
            );
            const { answer, conversationId: returnedId, chartData } = res.data.data;

            const isNewConversation = !conversationId;
            if (isNewConversation) setConversationId(returnedId);

            const assistantMsg: IMessage = {
                id: crypto.randomUUID(),
                role: 'assistant',
                content: answer,
                chartData: chartData ?? undefined,
            };
            setMessages((prev) => [...prev.filter((m) => !m.isLoading), assistantMsg]);

            // Refresh history after the first turn of a new conversation
            if (isNewConversation) {
                await fetchHistory();
            } else {
                // Update the existing session's snippet in the sidebar
                setSessions((prev) =>
                    prev.map((s) =>
                        s.conversationId === returnedId
                            ? { ...s, updatedAt: new Date().toISOString() }
                            : s,
                    ),
                );
            }
        } catch (err: unknown) {
            const errorText =
                axios.isAxiosError(err) && err.response?.data?.error
                    ? err.response.data.error
                    : 'Something went wrong. Please try again.';
            setMessages((prev) => [
                ...prev.filter((m) => !m.isLoading),
                { id: crypto.randomUUID(), role: 'assistant', content: errorText },
            ]);
        } finally {
            setIsSending(false);
            inputRef.current?.focus();
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit(null);
        }
    };

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="flex h-full max-h-[calc(100vh-64px)] bg-gh-bg-subtle dark:bg-gh-bg-dark overflow-hidden">

            {/* ── Left: history sidebar ─────────────────────────────────────── */}
            <HistorySidebar
                sessions={sessions}
                isLoading={isHistoryLoading}
                activeId={conversationId}
                onSelect={handleSelectConversation}
                onNewChat={handleNewChat}
                isOpen={isSidebarOpen}
                onClose={() => setIsSidebarOpen(false)}
            />

            {/* ── Right: chat view ──────────────────────────────────────────── */}
            <div className="flex flex-col flex-1 min-w-0 overflow-hidden">

                {/* Header */}
                <div className="flex-shrink-0 px-4 md:px-6 py-4 border-b border-slate-200 dark:border-gh-border-dark bg-white dark:bg-gh-bg-dark">
                    <div className="flex items-center gap-3">
                        {/* Mobile: hamburger menu toggle */}
                        <button
                            className="block md:hidden p-1.5 -ml-1 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-gh-bg-subtle-dark transition-colors"
                            onClick={() => setIsSidebarOpen(true)}
                            aria-label="Open chat history"
                        >
                            <Menu size={20} />
                        </button>
                        <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-950/40 flex items-center justify-center">
                            <Bot size={20} className="text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                            <h1 className="text-[15px] font-semibold text-slate-900 dark:text-gh-text-dark">
                                AI Quality Assistant
                            </h1>
                            <p className="text-[12px] text-slate-500 dark:text-slate-400">
                                {conversationId
                                    ? 'Continuing conversation — context preserved'
                                    : 'Ask questions about your test execution data'
                                }
                            </p>
                        </div>
                    </div>
                </div>

                {/* Message list */}
                <div className="flex-1 overflow-y-auto px-6 py-6 flex flex-col gap-4">
                    {isLoadingConv ? (
                        <div className="flex items-center justify-center flex-1 gap-2 text-slate-400">
                            <Loader2 size={20} className="animate-spin" />
                            <span className="text-[13px]">Loading conversation…</span>
                        </div>
                    ) : messages.length === 0 ? (
                        <EmptyState onSuggest={(q) => { setInput(q); inputRef.current?.focus(); }} />
                    ) : (
                        messages.map((msg) => <MessageBubble key={msg.id} message={msg} />)
                    )}
                    <div ref={bottomRef} />
                </div>

                {/* Input bar */}
                <div className="flex-shrink-0 px-3 py-3 md:px-6 md:py-4 border-t border-slate-200 dark:border-gh-border-dark bg-white dark:bg-gh-bg-dark">
                    <form onSubmit={(e) => handleSubmit(e)} className="flex items-end gap-2 md:gap-3">
                        <textarea
                            ref={inputRef}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Ask about your test quality data…"
                            rows={1}
                            maxLength={1000}
                            disabled={isSending || isLoadingConv}
                            className="flex-1 resize-none rounded-xl border border-slate-300 dark:border-gh-border-dark bg-white dark:bg-gh-bg-subtle-dark text-[14px] text-slate-800 dark:text-gh-text-dark placeholder-slate-400 dark:placeholder-slate-500 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 transition-colors disabled:opacity-50"
                            style={{ minHeight: '48px', maxHeight: '160px' }}
                        />
                        <button
                            type="submit"
                            disabled={isSending || isLoadingConv || input.trim().length === 0}
                            className="flex-shrink-0 w-11 h-11 flex items-center justify-center rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white transition-colors"
                            aria-label="Send message"
                        >
                            {isSending
                                ? <Loader2 size={18} className="animate-spin" />
                                : <Send size={18} />
                            }
                        </button>
                    </form>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-2">
                        AI may make mistakes. Always verify critical data directly in your dashboard.
                    </p>
                </div>
            </div>
        </div>
    );
}
