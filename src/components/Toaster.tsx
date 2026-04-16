import { useToast } from '@/hooks/use-toast';

export function Toaster() {
  const { toasts } = useToast();

  return (
    <div className="fixed top-4 right-4 z-[200] flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="pointer-events-auto animate-in slide-in-from-top-2 fade-in-0 duration-300 max-w-xs w-full bg-[#1a1a1a] border border-white/10 rounded-xl p-3 shadow-2xl shadow-black/40"
        >
          {t.title && (
            <p className="text-white text-sm font-medium leading-snug">{t.title}</p>
          )}
          {t.description && (
            <p className="text-gray-400 text-xs mt-0.5 leading-relaxed">{t.description}</p>
          )}
        </div>
      ))}
    </div>
  );
}
