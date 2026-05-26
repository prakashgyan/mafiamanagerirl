type EmptyStateProps = {
  icon: string;
  title?: string;
  message: string;
  action?: React.ReactNode;
  className?: string;
};

/**
 * Reusable empty-state placeholder used when a list has no items.
 */
const EmptyState = ({ icon, title, message, action, className = "" }: EmptyStateProps) => (
  <div
    className={`flex flex-col items-center gap-3 rounded-2xl border border-dashed border-slate-700 bg-slate-950/40 py-10 text-center ${className}`}
  >
    <span className="text-4xl" aria-hidden>{icon}</span>
    {title && <p className="text-sm font-semibold text-slate-200">{title}</p>}
    <p className="text-sm text-slate-400">{message}</p>
    {action}
  </div>
);

export default EmptyState;
