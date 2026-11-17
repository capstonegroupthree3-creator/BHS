import React from 'react';

interface RiskBadgeProps {
  status: 'Low' | 'Medium' | 'High' | 'Critical' | string;
  size?: 'sm' | 'md';
  pulse?: boolean;
}

const RiskBadge: React.FC<RiskBadgeProps> = ({ status, size = 'md', pulse = true }) => {
  const styles: Record<string, string> = {
    Low: 'risk-low',
    Medium: 'risk-medium',
    High: 'risk-high',
    Critical: `risk-critical ${pulse ? 'animate-pulse' : ''}`,
  };

  const dots: Record<string, string> = {
    Low: 'bg-green-500',
    Medium: 'bg-amber-500',
    High: 'bg-orange-500',
    Critical: 'bg-red-500',
  };

  const cls = styles[status] ?? 'badge badge-gray';
  const dot = dots[status] ?? 'bg-slate-400';

  return (
    <span className={`${cls} ${size === 'sm' ? 'text-xs py-0.5 px-2' : ''}`}>
      <span className={`inline-block w-1.5 h-1.5 rounded-full ${dot}`} />
      {status}
    </span>
  );
};

export default RiskBadge;
