import { useUIStore } from '../../stores/uiStore';
import { cx } from './ui';

export function Toasts() {
  const toasts = useUIStore((s) => s.toasts);
  const dismiss = useUIStore((s) => s.dismissToast);
  if (!toasts.length) return null;
  return (
    <div className="pointer-events-none absolute inset-x-0 top-12 z-50 flex flex-col items-center gap-1.5 px-4">
      {toasts.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => dismiss(t.id)}
          role={t.kind === 'error' ? 'alert' : 'status'}
          className={cx(
            'pointer-events-auto max-w-sm rounded-lg px-3 py-2 text-[12.5px] font-medium shadow-sm backdrop-blur-md',
            t.kind === 'error' ? 'bg-overlay text-danger' : 'bg-accent text-accent-fg',
          )}
        >
          {t.message}
        </button>
      ))}
    </div>
  );
}
