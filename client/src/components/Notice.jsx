import { WarningCircle, CheckCircle, Info } from '@phosphor-icons/react';

const ICONS = { error: WarningCircle, success: CheckCircle, info: Info };

export default function Notice({ type = 'info', children }) {
  const Icon = ICONS[type];
  return (
    <div className={`notice notice-${type}`} role={type === 'error' ? 'alert' : 'status'}>
      <Icon size={18} weight="bold" />
      <div>{children}</div>
    </div>
  );
}
