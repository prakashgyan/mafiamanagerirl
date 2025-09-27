import { useCallback, useMemo } from "react";

import type { LogEntry, Player } from "../services/api";

const ROLE_WORD_CLASS_MAP: Record<string, string> = {
  mafia: "text-rose-300 font-semibold",
  villager: "text-emerald-300 font-semibold",
  villagers: "text-emerald-300 font-semibold",
  doctor: "text-emerald-300 font-semibold",
  detective: "text-sky-300 font-semibold",
  jester: "text-fuchsia-300 font-semibold",
};

const KEYWORD_CLASS_MAP: Record<string, string> = {
  successful: "text-emerald-300 font-semibold",
  success: "text-emerald-300 font-semibold",
  failed: "text-rose-300 font-semibold",
  failure: "text-rose-300 font-semibold",
};

const CHIP_ROLE_STYLE: Record<string, { border: string; background: string; text: string }> = {
  mafia: {
    border: "border-rose-500/60",
    background: "bg-rose-500/15",
    text: "text-rose-200",
  },
  villager: {
    border: "border-emerald-400/60",
    background: "bg-emerald-500/10",
    text: "text-emerald-200",
  },
  doctor: {
    border: "border-teal-400/60",
    background: "bg-teal-500/10",
    text: "text-teal-200",
  },
  detective: {
    border: "border-sky-400/60",
    background: "bg-sky-500/10",
    text: "text-sky-200",
  },
  jester: {
    border: "border-fuchsia-400/60",
    background: "bg-fuchsia-500/10",
    text: "text-fuchsia-200",
  },
};

const CHIP_DEFAULT_STYLE = {
  border: "border-slate-600",
  background: "bg-slate-800/70",
  text: "text-slate-200",
};

const CHIP_ELIMINATED_STYLE = {
  border: "border-slate-700",
  background: "bg-slate-900/70",
  text: "text-slate-400",
};

type LogGroup = {
  phase: LogEntry["phase"];
  round: number;
  logs: LogEntry[];
  latestTimestamp: number;
};

type LogsSectionProps = {
  logs: LogEntry[];
  players: Player[];
  title?: string;
  subtitle?: string;
  emptyMessage?: string;
  filterPhaseSwitch?: boolean;
  className?: string;
};

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const buildWholeWordPatterns = (values: string[]): string[] =>
  values
    .map((value) => {
      const trimmed = value.trim();
      if (!trimmed) {
        return "";
      }

      const escaped = escapeRegExp(trimmed);
      const startsWithWord = /\w/.test(trimmed[0] ?? "");
      const endsWithWord = /\w/.test(trimmed[trimmed.length - 1] ?? "");

      const prefix = startsWithWord ? "\\b" : "";
      const suffix = endsWithWord ? "\\b" : "";

      return `${prefix}${escaped}${suffix}`;
    })
    .filter(Boolean);

const InlinePlayerChip = ({ player }: { player: Player }) => {
  const roleKey = player.role?.toLowerCase() ?? "";
  const style = player.is_alive ? CHIP_ROLE_STYLE[roleKey] ?? CHIP_DEFAULT_STYLE : CHIP_ELIMINATED_STYLE;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${style.border} ${style.background} ${style.text} mr-1`}
    >
      <span>{player.name}</span>
      {player.role && (
        <span className="text-[10px] uppercase tracking-wide text-slate-200/80">{player.role}</span>
      )}
    </span>
  );
};

const formatTime = (timestamp: string) =>
  new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

const LogsSection = ({
  logs,
  players,
  title = "Logs",
  subtitle,
  emptyMessage = "No actions logged yet.",
  filterPhaseSwitch = true,
  className,
}: LogsSectionProps) => {
  const { playerNameMap, highlightRegex } = useMemo(() => {
    const map = new Map<string, Player>();
    const rawNames: string[] = [];

    for (const player of players) {
      const trimmed = player.name.trim();
      if (!trimmed) {
        continue;
      }
      map.set(trimmed.toLowerCase(), player);
      rawNames.push(trimmed);
    }

    rawNames.sort((a, b) => b.length - a.length);

    const roleWords = Object.keys(ROLE_WORD_CLASS_MAP);
    const keywordWords = Object.keys(KEYWORD_CLASS_MAP);

    const patternParts: string[] = [];
    const namePatterns = buildWholeWordPatterns(rawNames);
    if (namePatterns.length > 0) {
      patternParts.push(...namePatterns);
    }
    const rolePatterns = buildWholeWordPatterns(roleWords);
    if (rolePatterns.length > 0) {
      patternParts.push(...rolePatterns);
    }
    const keywordPatterns = buildWholeWordPatterns(keywordWords);
    if (keywordPatterns.length > 0) {
      patternParts.push(...keywordPatterns);
    }

  const combined = Array.from(new Set(patternParts.filter(Boolean))).join("|");
    const regex = combined ? new RegExp(`(${combined})`, "giu") : null;

    return { playerNameMap: map, highlightRegex: regex };
  }, [players]);

  const groupedLogs = useMemo(() => {
    if (!logs || logs.length === 0) {
      return [] as LogGroup[];
    }

    const orderedLogs = [...logs].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    const relevantLogs = filterPhaseSwitch
      ? orderedLogs.filter((log) => !/phase\s+switched/i.test(log.message))
      : orderedLogs;

    const groups: LogGroup[] = [];
    const map = new Map<string, LogGroup>();

    for (const log of relevantLogs) {
      const key = `${log.phase}-${log.round}`;
      let group = map.get(key);

      if (!group) {
        group = {
          phase: log.phase,
          round: log.round,
          logs: [],
          latestTimestamp: 0,
        };
        map.set(key, group);
        groups.push(group);
      }

      group.logs.push(log);
      const timestampValue = new Date(log.timestamp).getTime();
      if (timestampValue > group.latestTimestamp) {
        group.latestTimestamp = timestampValue;
      }
    }

    for (const group of groups) {
      group.logs.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    }

    groups.sort((a, b) => b.latestTimestamp - a.latestTimestamp);

    return groups;
  }, [logs, filterPhaseSwitch]);

  const renderRichMessage = useCallback(
    (message: string) => {
      if (!message.trim()) {
        return <span className="text-slate-400 italic">No details provided.</span>;
      }

      if (!highlightRegex) {
        return message;
      }

      const fragments = message.split(highlightRegex);

      return fragments.map((fragment, index) => {
        if (!fragment) {
          return null;
        }

        const trimmed = fragment.trim();
        const normalized = trimmed.toLowerCase();

        if (playerNameMap.has(normalized)) {
          return <InlinePlayerChip key={`player-${index}-${normalized}`} player={playerNameMap.get(normalized)!} />;
        }

        const alphaOnly = trimmed.replace(/[^a-z]/gi, "").toLowerCase();

        if (alphaOnly && ROLE_WORD_CLASS_MAP[alphaOnly]) {
          return (
            <span key={`role-${index}-${alphaOnly}`} className={ROLE_WORD_CLASS_MAP[alphaOnly]}>
              {fragment}
            </span>
          );
        }

        if (alphaOnly && KEYWORD_CLASS_MAP[alphaOnly]) {
          return (
            <span key={`keyword-${index}-${alphaOnly}`} className={KEYWORD_CLASS_MAP[alphaOnly]}>
              {fragment}
            </span>
          );
        }

        return <span key={`text-${index}`}>{fragment}</span>;
      });
    },
    [highlightRegex, playerNameMap]
  );

  const containerClasses = [
    "rounded-2xl border border-slate-800 bg-slate-900/60 p-6",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <section className={containerClasses}>
      <header className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-semibold">{title}</h2>
        {subtitle ? <span className="text-sm text-slate-400">{subtitle}</span> : null}
      </header>
      <div className="space-y-4">
        {groupedLogs.length === 0 && <p className="text-sm text-slate-400">{emptyMessage}</p>}
        {groupedLogs.map((group) => {
          const label = `${group.phase === "day" ? "Day" : "Night"} ${group.round}`;
          const lastUpdated = group.latestTimestamp
            ? new Date(group.latestTimestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
            : null;

          return (
            <div
              key={`${group.phase}-${group.round}`}
              className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/70 px-4 py-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold uppercase tracking-wide text-slate-200">{label}</span>
                  <span className="rounded-full bg-slate-800/80 px-2 py-0.5 text-[11px] uppercase tracking-wide text-slate-400">
                    {group.logs.length} {group.logs.length === 1 ? "entry" : "entries"}
                  </span>
                </div>
                {lastUpdated && (
                  <span className="text-xs uppercase tracking-wide text-slate-500">Last update {lastUpdated}</span>
                )}
              </div>
              <ul className="space-y-2">
                {group.logs.map((log) => (
                  <li
                    key={log.id}
                    className="flex items-center gap-3 rounded-lg border border-slate-800/80 bg-slate-900/60 px-3 py-2"
                  >
                    <span className="h-2 w-2 flex-shrink-0 rounded-full bg-slate-500" />
                    <div className="flex flex-wrap items-center gap-2 text-sm leading-relaxed text-slate-200">
                      <span className="text-[11px] uppercase tracking-wide text-slate-500">{formatTime(log.timestamp)}</span>
                      <span className="flex flex-wrap items-center gap-1">{renderRichMessage(log.message)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
};

export default LogsSection;
