import * as Tooltip from "@radix-ui/react-tooltip";
import { clsx } from "clsx";
import type { ReactNode } from "react";
import { AppNavLink, useSubTab } from "@/lib/nav";
import { GLOSSARY } from "@/lib/glossary";

export function cn(...a: Parameters<typeof clsx>) {
  return clsx(...a);
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("rounded-xl border border-line bg-white p-5 shadow-sm", className)}>{children}</div>;
}

export function SectionTitle({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <div className="mb-3">
      <h2 className="text-xl font-semibold text-ink">{children}</h2>
      {sub && <div className="mt-1 max-w-3xl space-y-2 text-[15px] text-muted">{sub}</div>}
    </div>
  );
}

export function SubTabs({ base, tabs }: { base: string; tabs: { id: string; label: string }[] }) {
  const current = useSubTab() ?? tabs[0].id;
  return (
    <nav className="mb-5 flex flex-wrap gap-2 border-b border-line pb-3" aria-label="Sections">
      {tabs.map((t, i) => (
        <AppNavLink
          key={t.id}
          to={i === 0 ? base : `${base}/${t.id}`}
          end
          className={() =>
            cn(
              "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
              current === t.id ? "bg-brand text-white" : "bg-white text-muted ring-1 ring-line hover:bg-ice hover:text-ink",
            )
          }
        >
          {t.label}
        </AppNavLink>
      ))}
    </nav>
  );
}

export function Tip({ content, children }: { content: ReactNode; children: ReactNode }) {
  return (
    <Tooltip.Root delayDuration={150}>
      <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          side="top"
          sideOffset={6}
          className="z-50 max-w-xs rounded-lg bg-ink px-3 py-2 text-[13px] leading-snug text-white shadow-lg"
        >
          {content}
          <Tooltip.Arrow className="fill-ink" />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

/** A glossary term with a dotted underline and a hover definition. */
export function Term({ id, children }: { id: keyof typeof GLOSSARY; children?: ReactNode }) {
  const g = GLOSSARY[id];
  return (
    <Tip
      content={
        <>
          <span className="font-semibold">{g.term}.</span> {g.def}
        </>
      }
    >
      <span tabIndex={0} className="cursor-help border-b border-dotted border-muted">
        {children ?? g.term.toLowerCase()}
      </span>
    </Tip>
  );
}

export function InfoDot({ content }: { content: ReactNode }) {
  return (
    <Tip content={content}>
      <button
        type="button"
        aria-label="More information"
        className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-line align-middle text-[10px] font-bold text-muted"
      >
        i
      </button>
    </Tip>
  );
}

export function Segmented<T extends string | number>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-lg bg-ice p-1 ring-1 ring-line">
      {options.map((o) => (
        <button
          key={String(o.value)}
          role="radio"
          aria-checked={value === o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-md px-3 py-1 text-sm font-medium transition-colors",
            value === o.value ? "bg-white text-ink shadow-sm ring-1 ring-line" : "text-muted hover:text-ink",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Stat({ label, value, sub, accent }: { label: ReactNode; value: ReactNode; sub?: ReactNode; accent?: boolean }) {
  return (
    <div className={cn("rounded-xl border p-4", accent ? "border-brand/30 bg-brand-light/40" : "border-line bg-white")}>
      <div className="text-[13px] font-medium uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-1 text-3xl font-semibold tabular-nums text-ink">{value}</div>
      {sub && <div className="mt-1 text-sm text-muted">{sub}</div>}
    </div>
  );
}

export function Note({ children }: { children: ReactNode }) {
  return <p className="mt-2 text-[13px] leading-relaxed text-muted">{children}</p>;
}

export function Callout({ children, tone = "info" }: { children: ReactNode; tone?: "info" | "finding" }) {
  return (
    <div
      className={cn(
        "rounded-xl border-l-4 px-4 py-3 text-[15px]",
        tone === "finding" ? "border-brand bg-brand-light/50 text-ink" : "border-line bg-ice text-ink",
      )}
    >
      {children}
    </div>
  );
}
