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
