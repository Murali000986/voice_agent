import { CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { useUiStore } from '@/store/uiStore';

export function ToastHost() {
  const { toasts, dismissToast } = useUiStore();

  return (
    <div className="fixed bottom-6 right-6 z-[90] flex flex-col gap-2 w-[340px] pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto rounded-2xl border bg-white/95 backdrop-blur shadow-xl px-4 py-3 flex items-start gap-3 animate-toast-in ${
            t.type === 'error'
              ? 'border-rose-100'
              : t.type === 'success'
                ? 'border-emerald-100'
                : 'border-slate-200'
          }`}
        >
          {t.type === 'error' ? (
            <XCircle size={16} className="mt-0.5 text-rose-500 shrink-0" />
          ) : t.type === 'success' ? (
            <CheckCircle2 size={16} className="mt-0.5 text-emerald-500 shrink-0" />
          ) : (
            <Info size={16} className="mt-0.5 text-blue-500 shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-900">{t.title}</p>
            {t.description && <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{t.description}</p>}
          </div>
          <button className="text-slate-400 hover:text-slate-700" onClick={() => dismissToast(t.id)}>
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
