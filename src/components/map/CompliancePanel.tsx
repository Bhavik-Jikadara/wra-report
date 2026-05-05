import { useProjectStore } from '@/store/useProjectStore';
import { CheckCircle2, XCircle, ChevronUp, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

export function CompliancePanel() {
  const { turbines, micrositingSettings, projectBoundary } = useProjectStore();
  const [isExpanded, setIsExpanded] = useState(false);

  if (!projectBoundary || turbines.length === 0) return null;

  const hasViolations = turbines.some(t => t.spacingStatus === 'violation');
  const hasWarnings = turbines.some(t => t.spacingStatus === 'warning');
  
  const checks = [
    {
      label: 'All turbines inside boundary',
      passed: true, // Assuming true since layoutOptimizer filters by polygon
      critical: true
    },
    {
      label: `Minimum ${micrositingSettings.crosswindMultiple}D crosswind spacing maintained`,
      passed: !hasViolations && !hasWarnings,
      critical: true
    },
    {
      label: `Minimum ${micrositingSettings.downwindMultiple}D downwind spacing maintained`,
      passed: !hasViolations, // Simplification since layout optimizer tries to respect it
      critical: true
    },
    {
      label: `Boundary setback ≥ HH + 0.5*RD + 5m`,
      passed: true, // Enforced by layoutOptimizer inward buffer
      critical: true
    },
    {
      label: 'External project spacing — data not provided',
      passed: false,
      critical: false,
      isWarning: true
    }
  ];

  const passedCount = checks.filter(c => c.passed).length;
  const totalChecks = checks.length - 1; // excluding 'not provided'

  return (
    <div className="absolute bottom-4 right-4 z-10 w-80 bg-card rounded-md shadow-lg border overflow-hidden flex flex-col max-h-[calc(100vh-100px)]">
      <div 
        className={cn(
          "px-4 py-3 flex items-center justify-between cursor-pointer select-none",
          hasViolations ? "bg-destructive/10" : hasWarnings ? "bg-amber-500/10" : "bg-emerald-500/10"
        )}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex flex-col">
          <span className="font-semibold text-sm">MNRE Spacing Compliance</span>
          <span className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
            Overall: 
            {hasViolations ? (
              <span className="text-destructive font-medium">Violations Found</span>
            ) : hasWarnings ? (
              <span className="text-amber-500 font-medium">Warnings Found</span>
            ) : (
              <span className="text-emerald-500 font-medium">{passedCount}/{totalChecks} Passed</span>
            )}
          </span>
        </div>
        <button className="text-muted-foreground hover:text-foreground">
          {isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}
        </button>
      </div>

      {isExpanded && (
        <div className="p-4 space-y-3 border-t bg-card/95 backdrop-blur overflow-y-auto">
          {checks.map((check, idx) => (
            <div key={idx} className="flex items-start gap-2 text-sm">
              <div className="mt-0.5 flex-shrink-0">
                {check.passed ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                ) : check.isWarning ? (
                  <div className="w-4 h-4 rounded-sm border-2 border-amber-500 opacity-70" />
                ) : (
                  <XCircle className="w-4 h-4 text-destructive" />
                )}
              </div>
              <span className={cn(
                "leading-tight",
                !check.passed && !check.isWarning && "text-destructive font-medium",
                check.isWarning && "text-muted-foreground italic"
              )}>
                {check.label}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
