import React from 'react';
import type { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: number | string;
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
  trend?: 'up' | 'down' | 'neutral';
  trendLabel?: string;
  onClick?: () => void;
}

const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  icon: Icon,
  iconBg,
  iconColor,
  trend,
  trendLabel,
  onClick,
}) => {
  return (
    <div
      className={`stat-card animate-fade-in ${onClick ? 'cursor-pointer hover:scale-105' : ''} transition-transform`}
      onClick={onClick}
    >
      <div className={`stat-card-icon ${iconBg}`}>
        <Icon className={`w-6 h-6 ${iconColor}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wider truncate">{title}</p>
        <p className="text-2xl font-bold text-slate-900 mt-0.5">{value}</p>
        {trendLabel && (
          <p className={`text-xs mt-1 flex items-center gap-1 font-medium ${
            trend === 'up' ? 'text-red-500' :
            trend === 'down' ? 'text-green-500' :
            'text-slate-400'
          }`}>
            {trend === 'up' && '↑'}
            {trend === 'down' && '↓'}
            {trendLabel}
          </p>
        )}
      </div>
    </div>
  );
};

export default StatCard;
