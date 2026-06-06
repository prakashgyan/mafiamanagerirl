const PATREON_URL = "https://www.patreon.com/mafiadesk";

const tiers = [
  {
    name: "Villager",
    price: "$3",
    period: "/mo",
    emoji: "🌾",
    description: "You're one of us. Every bit keeps the town alive.",
    perks: ["Eternal gratitude", "Your name in the supporter credits"],
    highlight: false,
  },
  {
    name: "The Informant",
    price: "$5",
    period: "/mo",
    emoji: "🕵️",
    description: "You pass intel to the right people. Help shape what gets built and connect with fellow hosts.",
    perks: ["Everything in Villager", "Submit feature requests directly", "Access to the host community", "Connect with other MafiaDesk hosts"],
    highlight: true,
  },
  {
    name: "Detective",
    price: "$7",
    period: "/mo",
    emoji: "🔍",
    description: "You've investigated and decided I'm not Mafia. Smart.",
    perks: ["Everything in The Informant", "Early access to new features", "Vote on which requests get prioritised"],
    highlight: false,
  },
  {
    name: "Don",
    price: "$15",
    period: "/mo",
    emoji: "🎩",
    description: "The big boss. Your support keeps the whole operation running.",
    perks: ["Everything in Detective", "Direct line to the developer", "Your name prominently credited"],
    highlight: false,
  },
];

const SupportPage = () => {
  return (
    <div className="relative min-h-screen text-slate-100">
      <div className="relative z-10 mx-auto flex w-full max-w-4xl flex-col gap-10 px-6 py-10 lg:py-14">

        {/* Hero */}
        <div className="flex flex-col gap-2">
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-[#f96854]/40 bg-[#f96854]/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-[#f96854]">
            <span aria-hidden>❤️</span> Support MafiaDesk
          </span>
          <h1 className="text-3xl font-semibold text-white sm:text-4xl">
            Keep the nights going
          </h1>
          <p className="mt-1 max-w-xl text-sm leading-relaxed text-slate-400">
            MafiaDesk is a free, passion-built tool for hosting Mafia nights IRL. No ads, no paywalls —
            just a clean dashboard to run your games. If it's made your nights smoother, consider
            supporting it on Patreon.
          </p>
        </div>

        {/* Tier cards */}
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {tiers.map((tier) => (
            <div
              key={tier.name}
              className={`relative flex flex-col gap-4 rounded-2xl border p-6 backdrop-blur-sm transition ${
                tier.highlight
                  ? "border-[#f96854]/50 bg-[#f96854]/10 shadow-lg shadow-[#f96854]/10"
                  : "border-white/10 bg-slate-900/70 shadow-lg shadow-slate-950/50"
              }`}
            >
              {tier.highlight && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full border border-[#f96854]/40 bg-slate-950 px-3 py-0.5 text-[0.65rem] font-semibold uppercase tracking-widest text-[#f96854]">
                  Most popular
                </span>
              )}
              <div className="flex items-center gap-3">
                <span className="text-2xl" aria-hidden>{tier.emoji}</span>
                <div>
                  <p className="font-semibold text-white">{tier.name}</p>
                  <p className="text-xs text-slate-400">
                    <span className="text-lg font-bold text-white">{tier.price}</span>
                    {tier.period}
                  </p>
                </div>
              </div>
              <p className="text-sm text-slate-300">{tier.description}</p>
              <ul className="flex flex-col gap-1.5 text-xs text-slate-400">
                {tier.perks.map((perk) => (
                  <li key={perk} className="flex items-start gap-2">
                    <span className="mt-0.5 text-emerald-400" aria-hidden>✓</span>
                    {perk}
                  </li>
                ))}
              </ul>
              <a
                href={PATREON_URL}
                target="_blank"
                rel="noopener noreferrer"
                className={`mt-auto block rounded-xl py-2.5 text-center text-sm font-semibold transition ${
                  tier.highlight
                    ? "bg-[#f96854] text-white hover:bg-[#ff5a47]"
                    : "border border-white/10 text-slate-300 hover:border-white/20 hover:text-white"
                }`}
              >
                Support on Patreon
              </a>
            </div>
          ))}
        </div>

        {/* Footer note */}
        <p className="text-center text-xs text-slate-500">
          All tiers unlock the same app features — everything in MafiaDesk is free.
          Patreon support just keeps it that way.
        </p>

      </div>
    </div>
  );
};

export default SupportPage;
