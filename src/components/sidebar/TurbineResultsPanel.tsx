import { MapPin, CircleCheck, TriangleAlert, CircleX, TrendingUp, Zap } from 'lucide-react';
import { useProjectStore } from '@/store/useProjectStore';
import { useEYAResults } from '@/hooks/useEYAResults';
import { cn } from '@/lib/utils';

const STATUS_CFG = {
  ok:        { Icon: CircleCheck,    color: 'text-emerald-500', ring: 'border-emerald-200 dark:border-emerald-800',  bg: 'hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20' },
  warning:   { Icon: TriangleAlert,  color: 'text-amber-500',   ring: 'border-amber-200 dark:border-amber-800',     bg: 'hover:bg-amber-50/50 dark:hover:bg-amber-950/20' },
  violation: { Icon: CircleX,        color: 'text-red-500',     ring: 'border-red-200 dark:border-red-800',         bg: 'hover:bg-red-50/50 dark:hover:bg-red-950/20' },
} as const;

export function TurbineResultsPanel() {
  const turbines            = useProjectStore(s => s.turbines);
  const setSelectedTurbineId = useProjectStore(s => s.setSelectedTurbineId);
  const results             = useEYAResults();

  if (turbines.length === 0 || !results) return null;

  const { individualReports, summary } = results;

  const okCount   = turbines.filter(t => t.spacingStatus === 'ok').length;
  const warnCount = turbines.filter(t => t.spacingStatus === 'warning').length;
  const violCount = turbines.filter(t => t.spacingStatus === 'violation').length;

  return (
    <div className="space-y-2.5">

      {/* ── Compliance pill bar ── */}
      <div className={cn(
        'grid gap-1',
        warnCount === 0 && violCount === 0 ? 'grid-cols-1' : 'grid-cols-3'
      )}>
        {warnCount === 0 && violCount === 0 ? (
          <div className="rounded-md bg-emerald-50 dark:bg-emerald-950/30 py-1.5 text-center">
            <p className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
              All {okCount} turbines MNRE-compliant
            </p>
          </div>
        ) : (
          <>
            <div className="rounded-md bg-emerald-50 dark:bg-emerald-950/30 py-1.5 text-center">
              <p className="text-[9px] text-emerald-600 dark:text-emerald-400">OK</p>
              <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300">{okCount}</p>
            </div>
            <div className="rounded-md bg-amber-50 dark:bg-amber-950/30 py-1.5 text-center">
              <p className="text-[9px] text-amber-600 dark:text-amber-400">Warning</p>
              <p className="text-sm font-bold text-amber-700 dark:text-amber-300">{warnCount}</p>
            </div>
            <div className="rounded-md bg-red-50 dark:bg-red-950/30 py-1.5 text-center">
              <p className="text-[9px] text-red-600 dark:text-red-400">Violation</p>
              <p className="text-sm font-bold text-red-700 dark:text-red-300">{violCount}</p>
            </div>
          </>
        )}
      </div>

      {/* ── Plant summary strip ── */}
      <div className="rounded-md border bg-muted/40 px-2.5 py-2 grid grid-cols-2 gap-x-3 gap-y-1">
        <div className="flex items-center gap-1.5">
          <TrendingUp className="w-3.5 h-3.5 text-primary shrink-0" />
          <div>
            <p className="text-[8px] text-muted-foreground leading-tight">Net AEP (P50)</p>
            <p className="text-[11px] font-bold text-foreground leading-tight">
              {(summary.netAepMwh / 1000).toFixed(1)}{' '}
              <span className="text-[9px] font-normal text-muted-foreground">GWh/yr</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <Zap className="w-3.5 h-3.5 text-primary shrink-0" />
          <div>
            <p className="text-[8px] text-muted-foreground leading-tight">Plant Load Factor</p>
            <p className="text-[11px] font-bold text-foreground leading-tight">
              {summary.plf50.toFixed(1)}%
            </p>
          </div>
        </div>
      </div>

      {/* ── Per-turbine list ── */}
      <div className="space-y-1 max-h-72 overflow-y-auto pr-0.5">
        {individualReports.map((report) => {
          const turbine = turbines.find(t => t.id === report.id);
          const status  = turbine?.spacingStatus ?? 'ok';
          const { Icon, color, ring, bg } = STATUS_CFG[status];

          return (
            <button
              key={report.id}
              onClick={() => setSelectedTurbineId(report.id)}
              title="Click to fly to turbine on map"
              className={cn(
                'w-full text-left rounded-md border px-2 py-1.5 transition-colors',
                'flex items-start gap-2',
                ring, bg,
              )}
            >
              {/* Status icon */}
              <Icon className={cn('w-3.5 h-3.5 mt-0.5 shrink-0', color)} />

              {/* Left: ID + coordinates */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[11px] font-bold text-foreground truncate">{report.id}</span>
                  <span className="text-[9px] font-mono text-muted-foreground shrink-0">
                    #{report.rank}
                  </span>
                </div>
                {turbine && (
                  <div className="flex items-center gap-1 mt-0.5">
                    <MapPin className="w-2.5 h-2.5 text-muted-foreground shrink-0" />
                    <span className="text-[9px] font-mono text-muted-foreground truncate">
                      {turbine.lat.toFixed(5)}°&nbsp;{turbine.lng.toFixed(5)}°
                    </span>
                  </div>
                )}
              </div>

              {/* Right: AEP + PLF */}
              <div className="text-right shrink-0">
                <p className="text-[11px] font-bold text-primary leading-tight">
                  {Math.round(report.netAep).toLocaleString()}
                </p>
                <p className="text-[8px] text-muted-foreground leading-tight">MWh/yr</p>
                <p className="text-[9px] font-mono text-muted-foreground mt-0.5">
                  {report.plf.toFixed(1)}% PLF
                </p>
              </div>
            </button>
          );
        })}
      </div>

      <p className="text-[9px] text-muted-foreground text-center">
        Click a turbine to fly to it on the map
      </p>
    </div>
  );
}
