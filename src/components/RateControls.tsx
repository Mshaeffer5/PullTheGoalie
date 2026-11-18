import * as Slider from "@radix-ui/react-slider";
import { useEffect, useState } from "react";
import { DEFAULT_RATES, rates as rateData } from "@/lib/data";
import { useModel, type Rates } from "@/lib/model";
import { fmt, int } from "@/lib/format";
import { InfoDot, Segmented, Term } from "./ui";

const SPECS: { key: keyof Rates; label: string; short: string; min: number; max: number; step: number }[] = [
  { key: "r55", label: "5v5 scoring rate, each team", short: "5v5", min: 0.5, max: 6, step: 0.05 },
  { key: "r65", label: "Pulled offense (6v5)", short: "6v5", min: 2, max: 15, step: 0.05 },
  { key: "r56", label: "Empty-net defense (5v6)", short: "5v6", min: 5, max: 40, step: 0.1 },
];

function RateInput({ spec }: { spec: (typeof SPECS)[number] }) {
  const { rates, setRates } = useModel();
  const value = rates[spec.key];
  const [text, setText] = useState(value.toFixed(2));
  useEffect(() => setText(value.toFixed(2)), [value]);
  const comp = rateData.components.find((c) => c.key === spec.key)!;
  const commit = (v: number) => {
    if (!Number.isFinite(v)) return;
    const clamped = Math.min(spec.max, Math.max(spec.min, v));
    setRates({ ...rates, [spec.key]: Math.round(clamped * 100) / 100 });
  };
  return (
    <div className="min-w-0">
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={`rate-${spec.key}`} className="text-sm font-medium text-ink">
          {spec.label}
          <InfoDot
            content={
              <>
                <div className="font-semibold">{comp.situation}</div>
                <div>{comp.filter}, 2025–26.</div>
                <div className="mt-1">
                  {int(comp.goals)} goals in {int(comp.seconds / 3600)} hours = {fmt(comp.rate)} per 60.
                </div>
                <div className="mt-1">Default: {fmt(DEFAULT_RATES[spec.key])}</div>
              </>
            }
          />
        </label>
        <input
          id={`rate-${spec.key}`}
          inputMode="decimal"
          className="w-20 rounded-md border border-line px-2 py-1 text-right text-sm tabular-nums focus:border-brand focus:outline-none"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={() => commit(parseFloat(text))}
          onKeyDown={(e) => e.key === "Enter" && commit(parseFloat(text))}
          aria-label={`${spec.label}, goals per 60`}
        />
      </div>
      <Slider.Root
        className="relative mt-3 flex h-5 w-full touch-none select-none items-center"
        min={spec.min}
        max={spec.max}
        step={spec.step}
        value={[value]}
        onValueChange={([v]) => setRates({ ...rates, [spec.key]: Math.round(v * 100) / 100 })}
        aria-label={spec.label}
      >
        <Slider.Track className="relative h-1.5 grow rounded-full bg-line">
          <Slider.Range className="absolute h-full rounded-full bg-brand" />
        </Slider.Track>
        <Slider.Thumb className="block h-5 w-5 rounded-full border-2 border-brand bg-white shadow focus:outline-none focus:ring-2 focus:ring-brand/40" />
      </Slider.Root>
      <div className="mt-1 flex justify-between text-[12px] text-muted">
        <span>{spec.min}</span>
        <span>goals per 60</span>
        <span>{spec.max}</span>
      </div>
    </div>
  );
}

export function RateControls({ showMode = true }: { showMode?: boolean }) {
  const { mode, setMode, resetRates, isDefault } = useModel();
  return (
    <div className="rounded-xl border border-line bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold text-ink">Scoring rates (adjustable)</h3>
          <p className="text-[13px] text-muted">
            Defaults are our 2025–26 estimates (see About). Every number on the site recomputes as you move them.
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
          <button
            type="button"
            onClick={resetRates}
            disabled={isDefault}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-brand ring-1 ring-brand/40 hover:bg-brand-light disabled:cursor-default disabled:opacity-40"
          >
            Reset to our estimates
          </button>
        </div>
      </div>
      <div className="grid gap-6 md:grid-cols-3">
        {SPECS.map((s) => (
          <RateInput key={s.key} spec={s} />
        ))}
      </div>
      {showMode && (
        <p className="mt-4 text-[13px] text-muted">
          {mode === "regular" ? (
            <>
              Objective: <Term id="points" /> (win 2, tie at the horn 1.5, loss 0).
            </>
          ) : (
            <>
              Objective: <Term id="winprob" /> (win 1, tie at the horn 0.5, loss 0). Same scoring rates.
            </>
          )}
        </p>
      )}
    </div>
  );
}
