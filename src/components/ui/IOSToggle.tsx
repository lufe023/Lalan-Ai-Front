import React from 'react';
import { motion } from 'motion/react';

interface IOSToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  id?: string;
  activeColor?: string; // Optional custom color override or uses var(--primary) / green
}

export const IOSToggle: React.FC<IOSToggleProps> = ({
  checked,
  onChange,
  disabled = false,
  id,
  activeColor = '#22c55e', // iOS default active green or primary
}) => {
  return (
    <button
      type="button"
      id={id}
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
        disabled ? 'opacity-50 cursor-not-allowed' : 'ios-touch'
      } ${
        checked ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-neutral-700'
      }`}
      style={checked ? { backgroundColor: activeColor } : undefined}
    >
      <motion.span
        layout
        transition={{ type: 'spring', stiffness: 600, damping: 35 }}
        className={`pointer-events-none inline-block h-6 w-6 rounded-full bg-white shadow-[0_2px_4px_rgba(0,0,0,0.2)] transform ring-0 transition duration-200 ease-in-out ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  );
};
