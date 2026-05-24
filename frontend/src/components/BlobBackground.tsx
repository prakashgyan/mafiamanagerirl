const BlobBackground = () => (
  <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-slate-950">
    <div className="animate-blob-1 absolute left-[5%] top-[5%] h-48 w-48 rounded-full bg-sky-500/10 blur-3xl sm:h-72 sm:w-72 lg:h-[420px] lg:w-[420px] xl:h-[560px] xl:w-[560px]" />
    <div className="animate-blob-2 animation-delay-6000 absolute right-[4%] top-[30%] h-40 w-40 rounded-full bg-indigo-500/[0.08] blur-3xl sm:h-64 sm:w-64 lg:h-80 lg:w-80 xl:h-[400px] xl:w-[400px]" />
    <div className="animate-blob-3 animation-delay-12000 absolute bottom-[4%] left-[38%] h-36 w-36 rounded-full bg-emerald-400/10 blur-3xl sm:h-56 sm:w-56 lg:h-72 lg:w-72 xl:h-80 xl:w-80" />
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.08),_transparent_55%)]" />
  </div>
);

export default BlobBackground;
