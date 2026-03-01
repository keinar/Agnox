import React, { useMemo } from 'react';

import { Bot, Sparkles, AlertTriangle, Loader2, Lightbulb, CheckCircle2, Info } from 'lucide-react';



// ── Types ──────────────────────────────────────────────────────────────────────



interface AIAnalysisViewProps {

  analysis: string | null | undefined;

  status: string;

}



// ── Section metadata helper ───────────────────────────────────────────────────



type SectionKind = 'root' | 'fix' | 'info' | 'default';



/** Strip emoji and leading/trailing whitespace for keyword matching. */

function stripEmoji(s: string): string {

  return s.replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, '').trim();

}



function getSectionKind(title: string): SectionKind {

  const t = stripEmoji(title).toLowerCase();

  if (t.includes('root cause') || t.includes('error') || t.includes('failure')) return 'root';

  if (

    t.includes('fix') ||

    t.includes('solution') ||

    t.includes('suggested') ||

    t.includes('recommendation')

  )

    return 'fix';

  if (t.includes('summary') || t.includes('overview') || t.includes('context')) return 'info';

  return 'default';

}



const SECTION_STYLES: Record<

  SectionKind,

  { wrapper: string; icon: React.ReactNode; title: string; border: string }

> = {

  root: {

    wrapper: 'bg-rose-50/70 dark:bg-rose-950/20 border border-rose-200/80 dark:border-rose-800/40',

    icon: <AlertTriangle size={15} className="text-rose-500 dark:text-rose-400 shrink-0" />,

    title: 'text-rose-700 dark:text-rose-300',

    border: 'border-b border-rose-200/60 dark:border-rose-800/40',

  },

  fix: {

    wrapper:

      'bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-800/40',

    icon: <CheckCircle2 size={15} className="text-emerald-500 dark:text-emerald-400 shrink-0" />,

    title: 'text-emerald-700 dark:text-emerald-300',

    border: 'border-b border-emerald-200/60 dark:border-emerald-800/40',

  },

  info: {

    wrapper:

      'bg-blue-50/70 dark:bg-blue-950/20 border border-blue-200/80 dark:border-blue-800/40',

    icon: <Info size={15} className="text-blue-500 dark:text-blue-400 shrink-0" />,

    title: 'text-blue-700 dark:text-blue-300',

    border: 'border-b border-blue-200/60 dark:border-blue-800/40',

  },

  default: {

    wrapper:

      'bg-slate-50/80 dark:bg-slate-800/30 border border-slate-200/80 dark:border-slate-700/40',

    icon: <Lightbulb size={15} className="text-slate-400 dark:text-slate-500 shrink-0" />,

    title: 'text-slate-700 dark:text-slate-200',

    border: 'border-b border-slate-200/60 dark:border-slate-700/40',

  },

};



// ── Markdown → JSX parser ─────────────────────────────────────────────────────



interface MarkdownSection {

  kind: 'section';

  kind2: SectionKind;

  title: string;

  lines: string[];

}

interface MarkdownLine {

  kind: 'line';

  raw: string;

}

type MarkdownNode = MarkdownSection | MarkdownLine;



/** Detect any H2 or H3 heading (## or ###) */

function isHeading(line: string): false | { depth: 2 | 3; title: string } {

  const m3 = line.match(/^### (.+)/);

  if (m3) return { depth: 3, title: m3[1].replace(/\*\*/g, '').trim() };

  const m2 = line.match(/^## (.+)/);

  if (m2) return { depth: 2, title: m2[1].replace(/\*\*/g, '').trim() };

  return false;

}



function parseMarkdown(text: string): MarkdownNode[] {

  const lines = text.split('\n');

  const nodes: MarkdownNode[] = [];

  let current: MarkdownSection | null = null;



  for (const line of lines) {

    const heading = isHeading(line);

    if (heading) {

      if (current) nodes.push(current);

      current = {

        kind: 'section',

        kind2: getSectionKind(heading.title),

        title: heading.title,

        lines: [],

      };

    } else if (current) {

      current.lines.push(line);

    } else {

      nodes.push({ kind: 'line', raw: line });

    }

  }

  if (current) nodes.push(current);

  return nodes;

}



// ── Inline rich-text renderer ─────────────────────────────────────────────────



/** Renders **bold** and `code` spans inline. */

function InlineText({ text }: { text: string }): React.ReactElement {

  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);

  if (parts.length === 1) return <>{text}</>;

  return (

    <span>

      {parts.map((part) => {

        if (part.startsWith('**') && part.endsWith('**')) {

          return (

            <span key={`b:${part}`} className="font-semibold text-slate-900 dark:text-slate-100">

              {part.slice(2, -2)}

            </span>

          );

        }

        if (part.startsWith('`') && part.endsWith('`')) {

          return (

            <code

              key={`c:${part}`}

              className="px-1.5 py-0.5 rounded-md text-[0.78rem] font-mono bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700"

            >

              {part.slice(1, -1)}

            </code>

          );

        }

        return part;

      })}

    </span>

  );

}



// ── Section body renderer ─────────────────────────────────────────────────────



function SectionLines({ lines, kind }: { lines: string[]; kind: SectionKind }): React.ReactNode {

  // Bullet dot colour per section kind

  const dotCls =

    kind === 'root'

      ? 'bg-rose-400 dark:bg-rose-500'

      : kind === 'fix'

        ? 'bg-emerald-400 dark:bg-emerald-500'

        : kind === 'info'

          ? 'bg-blue-400 dark:bg-blue-500'

          : 'bg-slate-400 dark:bg-slate-500';



  // Number badge colour per section kind

  const numBadgeCls =

    kind === 'root'

      ? 'bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-700/50'

      : kind === 'fix'

        ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-700/50'

        : kind === 'info'

          ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-700/50'

          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700';



  return lines.map((line) => {

    if (line.trim() === '') return null;



    // Numbered list  "1. …"

    const numMatch = line.match(/^\s*(\d+)\.\s+(.+)/);

    if (numMatch) {

      return (

        <div key={line} className="flex gap-3 items-start py-1">

          <span

            className={`mt-0.5 shrink-0 min-w-[1.4rem] h-[1.4rem] flex items-center justify-center rounded-full text-[11px] font-bold border ${numBadgeCls}`}

          >

            {numMatch[1]}

          </span>

          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed m-0 flex-1">

            <InlineText text={numMatch[2]} />

          </p>

        </div>

      );

    }



    // Bullet list  "* …"  "- …"  "• …"

    if (/^\s*[\*\-•]\s/.test(line)) {

      const content = line.replace(/^\s*[\*\-•]\s/, '');

      return (

        <div key={line} className="flex gap-3 items-start py-1">

          <span className={`mt-[9px] shrink-0 w-1.5 h-1.5 rounded-full ${dotCls}`} />

          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed m-0 flex-1">

            <InlineText text={content} />

          </p>

        </div>

      );

    }



    // Plain paragraph

    return (

      <p key={line} className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">

        <InlineText text={line} />

      </p>

    );

  });

}



// ── Top-level markdown renderer ───────────────────────────────────────────────



function renderMarkdown(text: string): React.ReactNode {

  const nodes = parseMarkdown(text);



  return (

    <div className="flex flex-col gap-3">

      {nodes.map((node) => {

        if (node.kind === 'line') {

          if (!node.raw.trim()) return null;

          return (

            <p key={node.raw} className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">

              <InlineText text={node.raw} />

            </p>

          );

        }



        const s = SECTION_STYLES[node.kind2];

        return (

          <div key={node.title} className={`rounded-xl overflow-hidden ${s.wrapper}`}>

            {/* Section header */}

            <div className={`flex items-center gap-2 px-4 py-3 ${s.border}`}>

              {s.icon}

              <h3 className={`text-sm font-semibold m-0 ${s.title}`}>{node.title}</h3>

            </div>

            {/* Section body */}

            <div className="px-4 py-3 flex flex-col gap-1">

              <SectionLines lines={node.lines} kind={node.kind2} />

            </div>

          </div>

        );

      })}

    </div>

  );

}



// ── Loading dots animation ────────────────────────────────────────────────────



const LOADING_DOTS = [

  { id: 'dot-0', delay: '0s' },

  { id: 'dot-1', delay: '0.15s' },

  { id: 'dot-2', delay: '0.30s' },

] as const;



function LoadingDots() {

  return (

    <span className="inline-flex items-end gap-0.5 ml-0.5 h-4">

      {LOADING_DOTS.map(({ id, delay }) => (

        <span

          key={id}

          className="w-1 h-1 rounded-full bg-blue-400 dark:bg-blue-500 animate-bounce"

          style={{ animationDelay: delay, animationDuration: '0.9s' }}

        />

      ))}

    </span>

  );

}



// ── Component ──────────────────────────────────────────────────────────────────



export function AIAnalysisView({ analysis, status }: AIAnalysisViewProps) {

  const isAnalyzing = status === 'ANALYZING';

  const isUnstable = status === 'UNSTABLE';



  const renderedContent = useMemo(

    () => (analysis ? renderMarkdown(analysis) : null),

    [analysis],

  );



  // ── Loading state ─────────────────────────────────────────────────────────

  if (isAnalyzing) {

    return (

      <div className="flex flex-col items-center justify-center h-full gap-6 py-20">

        {/* Pulsing ring */}

        <div className="relative flex items-center justify-center">

          <span className="absolute w-16 h-16 rounded-full bg-blue-400/20 dark:bg-blue-500/20 animate-ping" />

          <div className="relative flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-violet-600 shadow-lg shadow-blue-500/30">

            <Loader2 size={22} className="animate-spin text-white" />

          </div>

        </div>

        <div className="text-center">

          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 flex items-center justify-center gap-1">

            AI is analysing your run<LoadingDots />

          </p>

          <p className="mt-1 text-xs text-slate-400 dark:text-slate-500 max-w-xs leading-relaxed">

            Gemini 2.5 Flash is processing the execution logs and identifying root causes.

          </p>

        </div>

      </div>

    );

  }



  // ── Empty state ───────────────────────────────────────────────────────────

  if (!analysis) {

    return (

      <div className="flex flex-col items-center justify-center h-40 gap-3 rounded-xl border border-dashed border-slate-200 dark:border-slate-700/60 bg-slate-50/50 dark:bg-slate-800/20">

        <Bot size={22} className="text-slate-300 dark:text-slate-600" />

        <p className="text-sm text-slate-400 dark:text-slate-500">

          No AI analysis available for this run.

        </p>

      </div>

    );

  }



  // ── Analysis content ──────────────────────────────────────────────────────

  return (

    <div className="flex flex-col gap-5">



      {/* ── Header card ──────────────────────────────────────────────────── */}

      <div

        className={`relative overflow-hidden rounded-xl px-5 py-4 border ${isUnstable

          ? 'bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/20 border-amber-200/70 dark:border-amber-700/40'

          : 'bg-gradient-to-r from-rose-50 to-pink-50 dark:from-rose-950/30 dark:to-pink-950/20 border-rose-200/70 dark:border-rose-700/40'

          }`}

      >

        {/* Decorative blurred orb */}

        <div

          aria-hidden

          className={`pointer-events-none absolute -top-6 -right-6 w-24 h-24 rounded-full blur-2xl opacity-40 ${isUnstable ? 'bg-amber-400' : 'bg-rose-400'

            }`}

        />



        <div className="relative flex items-center gap-4">

          {/* Icon */}

          <div

            className={`flex items-center justify-center w-11 h-11 rounded-xl shadow-md shrink-0 ${isUnstable

              ? 'bg-gradient-to-br from-amber-400 to-orange-500 shadow-amber-300/40 dark:shadow-amber-700/30'

              : 'bg-gradient-to-br from-rose-500 to-pink-600 shadow-rose-300/40 dark:shadow-rose-700/30'

              }`}

          >

            <Bot size={20} className="text-white" />

          </div>



          {/* Text */}

          <div className="flex-1 min-w-0">

            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 m-0">

              AI Root Cause Analysis

              <Sparkles

                size={13}

                className="text-blue-400 dark:text-blue-300 animate-pulse shrink-0"

              />

            </h3>

            <p className="text-xs text-slate-500 dark:text-slate-400 m-0 mt-0.5">

              Powered by{' '}

              <span className="font-medium text-slate-600 dark:text-slate-300">

                Gemini 2.5 Flash

              </span>

            </p>

          </div>



          {/* Status badge */}

          <span

            className={`hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold shrink-0 ${isUnstable

              ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-700/50'

              : 'bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-700/50'

              }`}

          >

            <span

              className={`w-1.5 h-1.5 rounded-full ${isUnstable ? 'bg-amber-500' : 'bg-rose-500'}`}

            />

            {isUnstable ? 'Unstable' : 'Failed'}

          </span>

        </div>

      </div>



      {/* ── Analysis body ─────────────────────────────────────────────────── */}

      <div>{renderedContent}</div>



    </div>

  );

}
