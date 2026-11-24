import React from 'react';

export interface VitalLogoProps {
  className?: string;
  size?: number;
  title?: string;
}

/**
 * WORK VITAL Monochrome V-Prism Geometric Mark
 * Paired with PORTFOLIO ASSET's minimalist monochrome geometric prism identity.
 */
export function VitalLogo({ className = 'w-7 h-7 text-slate-900', size, title }: VitalLogoProps) {
  return (
    <svg
      viewBox="0 0 28 28"
      width={size}
      height={size}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      data-testid="vital-logo-mark"
    >
      {/* Left Primary Prism Arm */}
      <path d="M2.8 5.2H7.8L14 18.6V24.6L2.8 5.2Z" fill="currentColor" />
      {/* Right Faceted Prism Arm */}
      <path d="M25.2 5.2H20.2L14 18.6V24.6L25.2 5.2Z" fill="currentColor" fillOpacity="0.42" />
      {/* Center Crown Prism Diamond */}
      <path d="M14 4.6L16.3 7.8L14 11L11.7 7.8L14 4.6Z" fill="currentColor" />
    </svg>
  );
}
