import { Check, Circle, FileText, Globe2, Layers3, Search, Sparkles, WandSparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

const STEPS = [
  { title: 'Open website', icon: Globe2, match: /safe to open|opening the website/i },
  { title: 'Read useful pages', icon: Search, match: /reading|finding useful pages/i },
  { title: 'Prepare agent plan', icon: FileText, match: /organizing|research complete|agent plan|profile/i },
  { title: 'Build call flow', icon: Layers3, match: /workflow|call flow|node graph|generating/i },
  { title: 'Save your agent', icon: Sparkles, match: /saving|finalizing|saved/i },
];

export function WebsiteBuildProgress({ phase, progress, websiteUrl }: { phase: string | null; progress?: number | null; websiteUrl?: string | null }) {
  const activeIndex = Math.max(0, STEPS.findIndex((step) => step.match.test(phase || '')));
  const isWebsiteBuild = /website|research|plan|workflow|call flow|agent|profile|saving/i.test(phase || '');
  const pageCount = phase?.match(/\((\d+\/\d+)\)/)?.[1];
  const pagePath = phase?.match(/Reading\s+(\S+)/i)?.[1];
  let siteLabel = 'Your business website';
  try { if (websiteUrl) siteLabel = new URL(websiteUrl).hostname.replace(/^www\./, ''); } catch { /* Keep the friendly fallback label. */ }
  const displayProgress = Math.min(99, Math.max(5, progress ?? (8 + activeIndex * 19 + (pageCount ? 8 : 0))));

  if (!isWebsiteBuild) {
    return <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm"><div className="mb-2 flex items-center gap-2"><span className="flex size-7 items-center justify-center rounded-md bg-blue-50 text-blue-700"><WandSparkles size={14} className="animate-pulse" /></span><div><p className="text-[10px] font-semibold uppercase text-blue-700">Conductor is thinking</p><p className="text-[12px] font-medium text-slate-700">{phase || 'Preparing your request…'}</p></div></div><div className="h-1 overflow-hidden rounded-full bg-slate-100"><div className="h-full w-1/3 origin-left animate-pulse rounded-full bg-blue-600" /></div></div>;
  }

  return (
    <div className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm animate-in fade-in slide-in-from-bottom-2">
      <div className="border-b border-slate-100 bg-slate-50 p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.16em] text-blue-700"><span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-60" /><span className="relative inline-flex h-2 w-2 rounded-full bg-blue-600" /></span>Live research</div>
          <span className="text-[10px] font-semibold tabular-nums text-slate-400">{Math.round(displayProgress)}%</span>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-slate-200/90 bg-white/90 px-2.5 py-2 shadow-sm">
          <div className="flex gap-1"><span className="h-1.5 w-1.5 rounded-full bg-rose-300" /><span className="h-1.5 w-1.5 rounded-full bg-amber-300" /><span className="h-1.5 w-1.5 rounded-full bg-emerald-300" /></div>
          <span className="mx-1 h-4 w-px bg-slate-200" />
          <Globe2 size={12} className="shrink-0 text-blue-600" />
          <span className="min-w-0 flex-1 truncate text-[11px] font-semibold text-slate-700">{siteLabel}{pagePath && pagePath !== '/' ? <span className="font-normal text-slate-400">{pagePath}</span> : null}</span>
          <span className="shrink-0 rounded-md bg-emerald-50 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-700">Public site</span>
        </div>
        <div className="mt-3 flex items-start gap-2.5">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white shadow-sm"><WandSparkles size={15} className="animate-pulse" /></span>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold text-slate-900">{activeIndex >= 3 ? 'Designing your voice agent' : 'Learning about your business'}</p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">{phase || 'Opening the website and finding useful details…'}</p>
          </div>
          {pageCount && <span className="shrink-0 rounded-full bg-blue-50 px-2 py-1 text-[9px] font-semibold text-blue-700">{pageCount}</span>}
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-200/70">
          <div className="h-full origin-left rounded-full bg-blue-600 transition-transform duration-200" style={{ transform: `scaleX(${displayProgress / 100})` }} />
        </div>
      </div>
      <div className="p-3.5">
      <ol className="grid grid-cols-5 gap-1">
        {STEPS.map((step, index) => {
          const Icon = step.icon;
          const done = index < activeIndex;
          const active = index === activeIndex;
          return (
            <li key={step.title} className={`flex flex-col items-center gap-1 text-center text-[9px] leading-tight ${done || active ? 'text-blue-700' : 'text-slate-400'}`}>
              <span className={cn('flex size-6 items-center justify-center rounded-full', done ? 'bg-emerald-50 text-emerald-600' : active ? 'bg-blue-50 text-blue-700 ring-2 ring-blue-100' : 'bg-slate-50 text-slate-300')}>
                {done ? <Check size={12} /> : active ? <Icon size={12} className="animate-pulse" /> : <Circle size={11} />}
              </span>
              {step.title}
            </li>
          );
        })}
      </ol>
      </div>
    </div>
  );
}
