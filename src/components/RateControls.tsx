import * as Slider from "@radix-ui/react-slider";
import { useEffect, useState } from "react";
import { DEFAULT_RATES, rates as rateData } from "@/lib/data";
import { fmt, int } from "@/lib/format";
import { useIsNarrow } from "@/lib/hooks";
import { useModel, type Rates } from "@/lib/model";
import { InfoDot, Segmented, Term } from "./ui";

export const RATE_LABELS: Record<keyof Rates, { long: string; short: string }> = {
  r55: { long: "Scoring rate with both goalies in (5-on-5)", short: "5-on-5 rate" },
  r65: { long: "Your team's scoring rate with an extra attacker (6-on-5)", short: "Extra-attacker rate" },
  r56: { long: "Opponent's scoring rate against your empty net (5-on-6)", short: "Empty-net rate against" },
};

const SPECS: { key: keyof Rates; min: number; max: number; step: number }[] = [
  { key: "r55", min: 0.5, max: 6, step: 0.05 },
  { key: "r65", min: 2, max: 15, step: 0.05 },
  { key: "r56", min: 5, max: 40, step: 0.1 },
];

function RateInput({ spec }: { spec: (typeof SPECS)[number] }) {
  const { rates, setRates } = useModel();
  const value = rates[spec.key];
  const label = RATE_LABELS[spec.key].long;
  const [text, setText] = useState(value.toFixed(2));
  useEffect(() => {
    setText(value.toFixed(2));
  }, [value]);
  const comp = rateData.components.find((c) => c.key === spec.key)!;
  const commit = (v: number) => {
    if (!Number.isFinite(v)) {
      setText(value.toFixed(2));
      return;
    }
    const clamped = Math.min(spec.max, Math.max(spec.min, v));
    setRates({ ...rates, [spec.key]: Math.round(clamped * 100) / 100 });
    setText(clamped.toFixed(2));
  };
  return (
    <div className="min-w-0">
      <div className="flex items-start justify-between gap-2">
        <label htmlFor={`rate-${spec.key}`} className="text-sm font-medium leading-snug text-ink">
          {label.replace(/ \(.*\)$/, "")}{" "}
          <span className="whitespace-nowrap">{label.match(/\(.*\)$/)?.[0]}</span>
          <InfoDot
            content={
              <>
                <div>Measured from 2025–26 play: {comp.filter.toLowerCase()}.</div>
                <div className="mt-1">
                  {int(comp.goals)} goals in {int(comp.seconds / 3600)} hours = {fmt(comp.rate)} goals per 60 minutes.
                </div>
                <div className="mt-1">Our estimate: {fmt(DEFAULT_RATES[spec.key])}</div>
              </>
            }
          />
        </label>
        <input
          id={`rate-${spec.key}`}
          inputMode="decimal"
          className="w-20 shrink-0 rounded-md border border-line px-2 py-1 text-right text-sm tabular-nums focus:border-brand focus:outline-none"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={() => commit(parseFloat(text))}
          onKeyDown={(e) => e.key === "Enter" && commit(parseFloat(text))}
          aria-label={`${label}, goals per 60 minutes`}
        />
      </div>
      <Slider.Root
        className="relative mt-3 flex h-5 w-full touch-none select-none items-center"
        min={spec.min}
        max={spec.max}
        step={spec.step}
        value={[value]}
        onValueChange={([v]) => setRates({ ...rates, [spec.key]: Math.round(v * 100) / 100 })}
      >
        <Slider.Track className="relative h-1.5 grow rounded-full bg-line">
          <Slider.Range className="absolute h-full rounded-full bg-brand" />
        </Slider.Track>
        <Slider.Thumb
          aria-label={label}
          className="block h-5 w-5 rounded-full border-2 border-brand bg-white shadow focus:outline-none focus:ring-2 focus:ring-brand/40"
        />
      </Slider.Root>
      <div className="mt-1 flex justify-between text-[12px] text-muted">
        <span>{spec.min}</span>
        <span>goals per 60 minutes</span>
        <span>{spec.max}</span>
      </div>
    </div>
  );
}

export function RateControls({ showMode = true }: { showMode?: boolean }) {
  const { rates, mode, setMode, resetRates, isDefault } = useModel();
  const narrow = useIsNarrow();
  const [open, setOpen] = useState(true);
  useEffect(() => {
    setOpen(!narrow);
  }, [narrow]);
  return (
    <div className="rounded-xl border border-line bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-semibold text-ink">Scoring rates you can adjust</h3>
          <p className="text-[13px] text-muted">
            {open
              ? "Defaults are our 2025–26 estimates. Every model number on the site updates as you move them."
              : `Now: ${fmt(rates.r55)} / ${fmt(rates.r65)} / ${fmt(rates.r56)} goals per 60 (5-on-5 / extra attacker / against the empty net).`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {showMode && (
            <Segmented
              label="Objective"
              value={mode}
              onChange={setMode}
              options={[
                { value: "regular", label: "Regular season" },
                { value: "playoff", label: "Playoffs" },
              ]}
            />
          )}
          {isDefault ? (
            <span className="rounded-lg bg-ice px-3 py-1.5 text-[13px] text-muted">Using our estimates</span>
          ) : (
            <button
              type="button"
              onClick={resetRates}
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-brand ring-1 ring-brand/40 hover:bg-brand-light"
            >
              Reset to our estimates
            </button>
          )}
          <button
            type="button"
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-muted ring-1 ring-line hover:bg-ice md:hidden"
          >
            {open ? "Hide sliders" : "Adjust rates"}
          </button>
        </div>
      </div>
      {open && (
        <>
          <div className="mt-4 grid gap-6 md:grid-cols-3">
            {SPECS.map((s) => (
              <RateInput key={s.key} spec={s} />
            ))}
          </div>
          {showMode && (
            <p className="mt-4 text-[13px] text-muted">
              {mode === "regular" ? (
                <>
                  Regular season: the model maximizes <Term id="points" /> (win 2, tie at the horn 1.5, loss 0).
                </>
              ) : (
                <>
                  Playoffs: the model maximizes <Term id="winprob" /> (win 1, tie at the horn 0.5, loss 0), with the same
                  scoring rates.
                </>
              )}
            </p>
          )}
        </>
      )}
    </div>
  );
}
