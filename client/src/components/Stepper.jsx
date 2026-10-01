import { Minus, Plus } from '@phosphor-icons/react';

export default function Stepper({ value, min = 1, max, onChange, size, label = 'الكمية' }) {
  return (
    <div className={`stepper ${size === 'sm' ? 'sm' : ''}`} role="group" aria-label={label}>
      <button type="button" className="icon-btn" onClick={() => onChange(value + 1)} disabled={max !== undefined && value >= max} aria-label="زيادة">
        <Plus size={16} />
      </button>
      <output aria-live="polite">{value}</output>
      <button type="button" className="icon-btn" onClick={() => onChange(value - 1)} disabled={value <= min} aria-label="إنقاص">
        <Minus size={16} />
      </button>
    </div>
  );
}
