import React from 'react';

interface PageContentProps {
  /** The scrollable page content */
  children: React.ReactNode;
  /** Extra Tailwind classes applied to the inner max-width wrapper */
  className?: string;
  /** Remove horizontal padding (e.g. for full-bleed sections) */
  noPadding?: boolean;
}

/**
 * PageContent — shared wrapper for every screen's scrollable body.
 *
 * Handles:
 *  - overflow-y-auto + hide-scrollbar  (replaces the per-screen scroll div)
 *  - Horizontal padding (responsive)
 *  - Max-width cap so content never stretches uncomfortably on large monitors
 *    (lg: 1024px → xl: 1152px → 2xl: 1280px)
 *
 * Usage in any screen:
 *   <PageContent className="space-y-4 pt-1">
 *     ...cards, lists, etc.
 *   </PageContent>
 */
export const PageContent: React.FC<PageContentProps> = ({
  children,
  className = '',
  noPadding = false,
}) => {
  const innerClass = [
    'w-full mx-auto',
    noPadding ? '' : 'px-4 lg:px-8',
    'max-w-none lg:[max-width:90%]',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="flex-1 overflow-y-auto hide-scrollbar pb-6 lg:pb-8">
      <div className={innerClass}>{children}</div>
    </div>
  );
};
