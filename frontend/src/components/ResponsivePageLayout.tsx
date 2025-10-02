import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";

import { useIsCompact } from "../hooks/useBreakpoint";

export type ResponsivePageLayoutProps = {
  children: ReactNode;
  hero?: ReactNode;
  actions?: ReactNode;
  title?: ReactNode;
  subtitle?: ReactNode;
  backLabel?: string;
  onBackClick?: () => void;
  backgroundClassName?: string;
  contentClassName?: string;
  stickyFooter?: ReactNode;
  disableBackButton?: boolean;
};

const defaultBackground =
  "pointer-events-none absolute inset-0 overflow-hidden [mask-image:radial-gradient(circle_at_top,_rgba(15,23,42,0.28),_transparent_60%)]";

const ResponsivePageLayout = ({
  children,
  hero,
  actions,
  title,
  subtitle,
  backLabel = "Back",
  onBackClick,
  backgroundClassName,
  contentClassName,
  stickyFooter,
  disableBackButton,
}: ResponsivePageLayoutProps) => {
  const isCompact = useIsCompact("md");
  const navigate = useNavigate();

  const handleBack = () => {
    if (disableBackButton) return;
    if (onBackClick) {
      onBackClick();
      return;
    }
    navigate(-1);
  };

  return (
    <div className="relative min-h-screen bg-slate-950 text-slate-100">
      <div className={`${defaultBackground} ${backgroundClassName ?? ""}`} aria-hidden />
      <div className="relative z-10 flex min-h-screen flex-col">
        <div className="flex-1">
          <div className={`mx-auto w-full max-w-screen-3xl px-4 pb-20 pt-6 sm:px-6 md:px-8 ${contentClassName ?? ""}`}>
            <header className="mb-6 flex flex-col gap-4 sm:mb-10 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-col gap-4">
                {!disableBackButton && (
                  <button
                    type="button"
                    onClick={handleBack}
                    className="inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-200 transition hover:border-sky-400 hover:text-sky-200"
                  >
                    <span aria-hidden>←</span>
                    {backLabel}
                  </button>
                )}
                {(title || subtitle) && (
                  <div className="space-y-2">
                    {typeof title === "string" ? <h1>{title}</h1> : title}
                    {subtitle && (
                      <p className="max-w-2xl text-sm text-slate-300">
                        {typeof subtitle === "string" ? subtitle : subtitle}
                      </p>
                    )}
                  </div>
                )}
                {hero}
              </div>
              {actions && (
                <div className={`flex ${isCompact ? "flex-col gap-2" : "flex-row gap-3"}`}>{actions}</div>
              )}
            </header>
            <main className="space-y-6 md:space-y-8">{children}</main>
          </div>
        </div>
        {stickyFooter && (
          <footer className="sticky bottom-0 z-20 border-t border-white/10 bg-slate-950/90 px-4 py-3 shadow-inset-top sm:px-6 md:px-8">
            {stickyFooter}
          </footer>
        )}
      </div>
    </div>
  );
};

export default ResponsivePageLayout;
