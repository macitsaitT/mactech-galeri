import React from 'react';
import { Info } from 'lucide-react';

// ✅ Stat kartı — başlık, değer, ikon, opsiyonel subtitle ve ⓘ tooltip
export const StatCard = ({ title, value, icon: Icon, color = 'default', subtitle, tooltip }) => {
  const colorClasses = {
    default: 'bg-card border-border',
    primary: 'bg-primary/10 border-primary/30',
    success: 'bg-success/10 border-success/30',
    warning: 'bg-warning/10 border-warning/30',
    destructive: 'bg-destructive/10 border-destructive/30',
  };
  const iconColors = {
    default: 'text-muted-foreground',
    primary: 'text-primary',
    success: 'text-success',
    warning: 'text-warning',
    destructive: 'text-destructive',
  };
  const slug = title.toLowerCase().replace(/\s+/g, '-');
  return (
    <div className={`border rounded-xl p-4 ${colorClasses[color]}`} data-testid={`stat-${slug}`}>
      <div className="flex items-center justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1 mb-1">
            <p className="text-[10px] text-muted-foreground uppercase font-medium truncate">{title}</p>
            {tooltip && (
              <span title={tooltip} className="inline-flex" data-testid={`stat-tooltip-${slug}`}>
                <Info size={11} className="text-muted-foreground/70 hover:text-primary transition-colors cursor-help" />
              </span>
            )}
          </div>
          <p className="font-heading font-bold text-lg sm:text-2xl tabular-nums truncate">{value}</p>
          {subtitle && <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{subtitle}</p>}
        </div>
        <div className={`p-2 sm:p-3 rounded-lg bg-background/50 flex-shrink-0 ${iconColors[color]}`}>
          <Icon size={20} className="sm:w-6 sm:h-6" />
        </div>
      </div>
    </div>
  );
};

export default StatCard;
