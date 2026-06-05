import type { LucideIcon } from 'lucide-react';

interface Props {
  title: string;
  value: string | number;
  delta?: string;
  deltaTone?: 'up' | 'down' | 'neutral';
  icon: LucideIcon;
  accent?: string;
}

export default function StatCard({
  title,
  value,
  delta,
  deltaTone = 'neutral',
  icon: Icon,
  accent = 'from-indigo-500 to-purple-600',
}: Props) {
  const toneClass =
    deltaTone === 'up'
      ? 'text-emerald-600 bg-emerald-50'
      : deltaTone === 'down'
        ? 'text-rose-600 bg-rose-50'
        : 'text-slate-600 bg-slate-100';

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{value}</p>
        </div>
        <div className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${accent} text-white shadow-sm`}>
          <Icon size={20} />
        </div>
      </div>
      {delta && (
        <div className="mt-4 flex items-center gap-2 text-xs">
          <span className={`rounded-full px-2 py-0.5 font-semibold ${toneClass}`}>{delta}</span>
          <span className="text-slate-400">so với tuần trước</span>
        </div>
      )}
    </div>
  );
}
