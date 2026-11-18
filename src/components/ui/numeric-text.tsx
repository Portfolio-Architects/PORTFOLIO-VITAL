import React from 'react';

export interface NumericTextProps {
  value: number | string;
  unit?: string;
  localeFormat?: boolean;
  className?: string;
}

export const NumericText = React.memo(function NumericText({
  value,
  unit,
  localeFormat = true,
  className = '',
}: NumericTextProps) {
  const formatted =
    typeof value === 'number' && localeFormat ? value.toLocaleString('ko-KR') : String(value);

  return (
    <span className={`font-mono tabular-nums tracking-tight ${className}`}>
      {formatted}
      {unit ? <span className="ml-0.5 font-sans">{unit}</span> : null}
    </span>
  );
});
