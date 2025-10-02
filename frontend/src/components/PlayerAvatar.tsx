import { normalizeAvatar } from "../utils/avatarOptions";

type AvatarSize = "xs" | "sm" | "md" | "lg";

type PlayerAvatarProps = {
  value?: string | null;
  fallbackLabel?: string;
  size?: AvatarSize;
  className?: string;
};

const SIZE_CLASS_MAP: Record<AvatarSize, string> = {
  xs: "text-xs h-6 w-6",
  sm: "text-sm h-8 w-8",
  md: "text-lg h-12 w-12",
  lg: "text-2xl h-16 w-16",
};

const getFallback = (label?: string) => {
  if (!label) return "🙂";
  const trimmed = label.trim();
  if (!trimmed) return "🙂";
  return trimmed.charAt(0).toUpperCase();
};

const PlayerAvatar = ({ value, fallbackLabel, size = "md", className }: PlayerAvatarProps) => {
  const normalized = normalizeAvatar(value);
  const display = normalized ?? getFallback(fallbackLabel);

  return (
    <span
      className={[
        "inline-flex items-center justify-center rounded-full border border-white/10 bg-slate-900/60 text-white shadow-sm shadow-black/20",
        SIZE_CLASS_MAP[size],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <span aria-hidden className="leading-none">
        {display}
      </span>
    </span>
  );
};

export default PlayerAvatar;
