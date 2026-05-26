/** Lightweight inline SVG spinner for use inside buttons or tight layouts. */
export const SpinnerIcon = ({ className = "h-4 w-4" }: { className?: string }) => (
  <svg
    className={`animate-spin ${className}`}
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    aria-hidden
  >
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path
      className="opacity-75"
      fill="currentColor"
      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
    />
  </svg>
);

type SpinnerProps = {
  message?: string;
  fullScreen?: boolean;
};

const Spinner = ({ message = "Loading...", fullScreen = true }: SpinnerProps) => {
  const content = (
    <div className="flex flex-col items-center gap-3">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-700 border-t-sky-400" />
      <p className="text-sm text-slate-400">{message}</p>
    </div>
  );

  if (!fullScreen) {
    return <div className="flex items-center justify-center py-10">{content}</div>;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-100">
      {content}
    </div>
  );
};

export default Spinner;
