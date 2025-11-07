import logoImage from "../assets/logo.png";

type BackdropLogoProps = {
  className?: string;
};

const baseClasses =
  "pointer-events-none select-none absolute -top-10 right-[-2%] z-0 h-auto w-[720px] rotate-0 opacity-20";

const BackdropLogo = ({ className }: BackdropLogoProps) => (
  <img
    src={logoImage}
    alt=""
    aria-hidden
    className={className ? `${baseClasses} ${className}` : baseClasses}
    draggable={false}
  />
);

export default BackdropLogo;
