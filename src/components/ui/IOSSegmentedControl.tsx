import React from 'react';
import { motion } from 'motion/react';

export interface SegmentOption<T extends string> {
  id: T;
  label: string;
  icon?: React.ReactNode;
  badge?: number;
}

interface IOSSegmentedControlProps<T extends string> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  id?: string;
  size?: 'sm' | 'md';
}

export function IOSSegmentedControl<T extends string>({
  options,
  value,
  onChange,
  id,
  size = 'md',
}: IOSSegmentedControlProps<T>) {
  return (
    <div
      id={id}
      className={`relative flex items-center p-1 rounded-xl bg-slate-200/80 dark:bg-neutral-800/90 border border-slate-300/40 dark:border-neutral-700/50 select-none ${
        size === 'sm' ? 'h-8 text-xs' : 'h-10 text-xs'
      }`}
    >
      {options.map(option => {
        const isSelected = value === option.id;

        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onChange(option.id)}
            className={`relative flex-1 flex items-center justify-center gap-1.5 font-semibold transition-colors duration-150 z-10 rounded-lg h-full ios-touch cursor-pointer ${
              isSelected
                ? 'text-slate-900 dark:text-white font-bold'
                : 'text-slate-600 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            {isSelected && (
              <motion.div
                layoutId={`segmented-active-pill-${id || 'default'}`}
                className="absolute inset-0 bg-white dark:bg-neutral-700 rounded-lg shadow-sm -z-10"
                transition={{ type: 'spring', stiffness: 500, damping: 35 }}
              />
            )}

            {option.icon && <span className="shrink-0">{option.icon}</span>}
            <span className="truncate">{option.label}</span>

            {option.badge !== undefined && option.badge > 0 && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-[var(--primary)] text-white">
                {option.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
