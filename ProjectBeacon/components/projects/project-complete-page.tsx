import Link from "next/link";

type ProjectCompletePageProps = {
  projectId: string;
  projectName: string;
  completedTaskCount: number;
  projectDurationDays: number;
  completedAtLabel: string;
};

const CONFETTI_STYLE = [
  { left: "8%", top: "14%", delay: "0s", duration: "4.8s" },
  { left: "17%", top: "6%", delay: "0.7s", duration: "5.3s" },
  { left: "27%", top: "11%", delay: "1.2s", duration: "4.6s" },
  { left: "38%", top: "8%", delay: "0.3s", duration: "5.7s" },
  { left: "49%", top: "4%", delay: "1.6s", duration: "5.1s" },
  { left: "62%", top: "10%", delay: "0.9s", duration: "4.9s" },
  { left: "71%", top: "7%", delay: "1.9s", duration: "5.4s" },
  { left: "82%", top: "12%", delay: "0.5s", duration: "4.7s" },
  { left: "91%", top: "6%", delay: "1.1s", duration: "5.2s" },
];

function formatTaskCountLabel(value: number): string {
  return `${value} task${value === 1 ? "" : "s"}`;
}

export function ProjectCompletePage({
  projectId,
  projectName,
  completedTaskCount,
  projectDurationDays,
  completedAtLabel,
}: ProjectCompletePageProps) {
  return (
    <section className="relative overflow-hidden rounded-3xl border border-violet-800/30 bg-[#120f1c] px-5 py-10 text-slate-100 shadow-[0_30px_80px_rgba(9,6,20,0.65)] sm:px-8 sm:py-14">
      <style>{`
        @keyframes project-complete-confetti-fall {
          0% {
            transform: translateY(-8vh) rotate(0deg);
            opacity: 0.95;
          }
          100% {
            transform: translateY(92vh) rotate(320deg);
            opacity: 0;
          }
        }
      `}</style>

      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {CONFETTI_STYLE.map((piece, index) => (
          <span
            key={`confetti-${piece.left}-${index}`}
            className={`absolute h-2.5 w-2.5 rounded-sm ${
              index % 3 === 0
                ? "bg-violet-400/70"
                : index % 3 === 1
                  ? "bg-amber-300/70"
                  : "bg-fuchsia-300/70"
            }`}
            style={{
              left: piece.left,
              top: piece.top,
              animationName: "project-complete-confetti-fall",
              animationDuration: piece.duration,
              animationTimingFunction: "linear",
              animationIterationCount: "infinite",
              animationDelay: piece.delay,
            }}
          />
        ))}
      </div>

      <div className="relative mx-auto flex w-full max-w-4xl flex-col items-center text-center">
        <article className="w-full rounded-3xl border border-violet-700/35 bg-[#1a1726]/95 p-7 shadow-[0_0_30px_rgba(98,47,175,0.2)] sm:p-10">
          <div className="mx-auto grid h-20 w-20 place-items-center rounded-full border border-violet-400/35 bg-violet-500/15">
            <svg
              aria-hidden="true"
              className="h-10 w-10 text-violet-300"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path d="M9 12l2 2 4-4" />
              <path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
          </div>

          <h1 className="mt-6 text-3xl font-black tracking-tight text-white sm:text-5xl">
            Mission <span className="text-violet-400">Accomplished</span>
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base text-slate-300 sm:text-xl">
            {projectName} is complete. Excellent work team.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              className="rounded-xl bg-violet-600 px-6 py-3 text-sm font-bold text-white transition hover:bg-violet-500"
              href={`/projects/${projectId}/board?view=completed`}
            >
              Back to Board
            </Link>
          </div>
        </article>

        <section className="mt-8 grid w-full max-w-3xl grid-cols-1 gap-4 md:grid-cols-2">
          <article className="rounded-2xl border border-violet-700/35 bg-[#1a1726]/90 p-6 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              Total Tasks Finished
            </p>
            <p className="mt-2 text-4xl font-black text-violet-300">
              {completedTaskCount}
            </p>
            <p className="mt-1 text-sm text-slate-400">
              {formatTaskCountLabel(completedTaskCount)}
            </p>
            <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-800">
              <div className="h-full w-full bg-violet-500" />
            </div>
          </article>

          <article className="rounded-2xl border border-violet-700/35 bg-[#1a1726]/90 p-6 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              Project Duration
            </p>
            <p className="mt-2 text-4xl font-black text-white">
              {projectDurationDays}
              <span className="ml-1 text-xl font-semibold text-slate-400">
                Days
              </span>
            </p>
            <p className="mt-1 text-sm text-slate-400">
              Completed {completedAtLabel}
            </p>
            <div className="mt-4 flex items-center justify-center gap-1">
              <span className="h-2 w-2 rounded-full bg-violet-400" />
              <span className="h-2 w-2 rounded-full bg-violet-400/60" />
              <span className="h-2 w-2 rounded-full bg-violet-400/30" />
            </div>
          </article>
        </section>
      </div>
    </section>
  );
}
