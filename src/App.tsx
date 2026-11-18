import * as Tooltip from "@radix-ui/react-tooltip";
import { useEffect } from "react";
import { NavLink, Route, Routes, useLocation } from "react-router-dom";
import { cn } from "@/components/ui";
import { ModelProvider } from "@/lib/model";
import Home from "@/pages/Home";
import Actual from "@/pages/Actual";
import Model from "@/pages/Model";
import Deeper from "@/pages/Deeper";
import About from "@/pages/About";

const NAV = [
  { to: "/", label: "Overview", end: true },
  { to: "/actual", label: "When teams pull" },
  { to: "/model", label: "The model" },
  { to: "/deeper", label: "Deeper dives" },
  { to: "/about", label: "About & method" },
];

function ScrollTop() {
  const { pathname } = useLocation();
  useEffect(() => window.scrollTo(0, 0), [pathname]);
  return null;
}

export default function App() {
  return (
    <Tooltip.Provider>
      <ModelProvider>
        <ScrollTop />
        <header className="sticky top-0 z-30 border-b border-line bg-white/95 backdrop-blur">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
            <NavLink to="/" className="flex items-center gap-2">
              <span aria-hidden className="grid h-8 w-8 place-items-center rounded-lg bg-brand text-sm font-bold text-white">
                6v5
              </span>
              <span>
                <span className="block text-[17px] font-semibold leading-tight text-ink">Pull the Goalie</span>
                <span className="block text-[12px] leading-tight text-muted">When NHL teams pull, and when they should</span>
              </span>
            </NavLink>
            <nav className="flex flex-wrap gap-1" aria-label="Main">
              {NAV.map((n) => (
                <NavLink
                  key={n.to}
                  to={n.to}
                  end={n.end}
                  className={({ isActive }) =>
                    cn(
                      "rounded-lg px-3 py-1.5 text-sm font-medium",
                      isActive ? "bg-brand text-white" : "text-muted hover:bg-ice hover:text-ink",
                    )
                  }
                >
                  {n.label}
                </NavLink>
              ))}
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-8">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/actual/:sub?" element={<Actual />} />
            <Route path="/model/:sub?" element={<Model />} />
            <Route path="/deeper/:sub?" element={<Deeper />} />
            <Route path="/about" element={<About />} />
            <Route path="*" element={<Home />} />
          </Routes>
        </main>
        <footer className="border-t border-line bg-white">
          <div className="mx-auto max-w-6xl px-4 py-6 text-[13px] text-muted">
            Data: NHL play-by-play and shift data as prepared for Columbia Business School B8131 Sports Analytics
            (2010–11 through games of November 7, 2026); team summaries from{" "}
            <a className="text-brand underline" href="https://moneypuck.com" target="_blank" rel="noreferrer">
              MoneyPuck.com
            </a>
            . Model and analysis: our own. See About &amp; method for definitions and filters.
          </div>
        </footer>
      </ModelProvider>
    </Tooltip.Provider>
  );
}
