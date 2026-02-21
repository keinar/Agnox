import React from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { Loader2, ImageOff, Download } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

// ── Types ──────────────────────────────────────────────────────────────────────

interface IArtifact {
  type: 'image' | 'video' | 'file';
  name: string;
  url: string;
}

interface ArtifactsViewProps {
  taskId: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const isProduction =
  window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
const API_URL = isProduction ? import.meta.env.VITE_API_URL : 'http://localhost:3000';

// ── Component ──────────────────────────────────────────────────────────────────

export function ArtifactsView({ taskId }: ArtifactsViewProps) {
  const { token } = useAuth();

  const { data: artifacts = [], isLoading } = useQuery<IArtifact[]>({
    queryKey: ['artifacts', taskId, token],
    queryFn: async () => {
      const { data } = await axios.get(
        `${API_URL}/api/executions/${taskId}/artifacts`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      return data.success ? (data.data.artifacts as IArtifact[]) : [];
    },
    enabled: !!token && !!taskId,
    staleTime: 30_000,
  });

  // ── Loading state ───────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 py-20">
        <Loader2 size={28} className="animate-spin text-blue-500 dark:text-blue-400" />
        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
          Loading artifacts&hellip;
        </p>
      </div>
    );
  }

  // ── Empty state ─────────────────────────────────────────────────────────────
  if (artifacts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-32 rounded-lg border border-dashed border-slate-200 dark:border-gh-border-dark gap-2">
        <ImageOff size={20} className="text-slate-400 dark:text-slate-500" />
        <p className="text-sm text-slate-400 dark:text-slate-500">
          No artifacts generated for this run.
        </p>
      </div>
    );
  }

  // ── Gallery ─────────────────────────────────────────────────────────────────
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {artifacts.map((artifact) => (
        <ArtifactCard key={artifact.name} artifact={artifact} />
      ))}
    </div>
  );
}

// ── ArtifactCard ───────────────────────────────────────────────────────────────

function ArtifactCard({ artifact }: { artifact: IArtifact }) {
  const typeBadgeClass =
    artifact.type === 'image'
      ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400'
      : artifact.type === 'video'
        ? 'bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400'
        : 'bg-slate-100 text-slate-600 dark:bg-gh-bg-dark dark:text-slate-400';

  return (
    <div className="rounded-lg border border-slate-200 dark:border-gh-border-dark overflow-hidden bg-white dark:bg-gh-bg-subtle-dark">
      {/* Card header */}
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-slate-100 dark:border-gh-border-dark">
        <p className="font-mono text-xs text-slate-600 dark:text-slate-300 truncate" title={artifact.name}>
          {artifact.name}
        </p>
        <span className={`shrink-0 text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${typeBadgeClass}`}>
          {artifact.type}
        </span>
      </div>

      {/* Card media */}
      {artifact.type === 'image' && (
        <img
          src={API_URL + artifact.url}
          alt={artifact.name}
          className="w-full object-contain max-h-64 bg-slate-50 dark:bg-gh-bg-dark"
        />
      )}

      {artifact.type === 'video' && (
        <video
          src={API_URL + artifact.url}
          controls
          className="w-full max-h-64 bg-black"
        />
      )}

      {artifact.type === 'file' && (
        <div className="flex items-center justify-center p-6">
          <a
            href={API_URL + artifact.url}
            download
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-gh-bg-dark dark:hover:bg-gh-accent-dark text-slate-700 dark:text-slate-200 text-sm font-medium transition-colors duration-150"
          >
            <Download size={15} />
            Download {artifact.name.split('/').pop()}
          </a>
        </div>
      )}
    </div>
  );
}
