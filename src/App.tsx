import * as Tooltip from "@radix-ui/react-tooltip";
import { useEffect } from "react";
import { Route, Routes } from "react-router-dom";
import { AppNavLink, usePathname } from "@/lib/nav";
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
  { to: "/about", label: "About" },
];

function ScrollTop() {
  const pathname = usePathname();
  useEffect(() => {
    // Block body on purpose: newer browsers return a Promise from scrollTo, and an effect must not return one.
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export default function App() {
  return (
    <Tooltip.Provider>
      <ModelProvider>
        <ScrollTop />
        <div className="flex min-h-screen flex-col">
        <header className="border-b border-line bg-white/95 backdrop-blur md:sticky md:top-0 md:z-30">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-3 gap-y-2 px-4 py-2 md:py-3">
            <AppNavLink to="/" end className={() => "flex items-center gap-2"}>
              <span aria-hidden className="grid h-8 w-8 place-items-center rounded-lg bg-brand text-sm font-bold text-white">
                6v5
              </span>
              <span>
                <span className="block text-[17px] font-semibold leading-tight text-ink">Pull the Goalie</span>
                <span className="hidden text-[12px] leading-tight text-muted sm:block">When NHL teams pull, and when they should</span>
              </span>
            </AppNavLink>
            <nav className="-mx-1 flex w-full gap-1 overflow-x-auto px-1 pb-1 sm:mx-0 sm:w-auto sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0" aria-label="Main">
              {NAV.map((n) => (
                <AppNavLink
                  key={n.to}
                  to={n.to}
                  end={n.end}
                  className={(active) =>
                    cn(
                      "whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium",
                      active ? "bg-brand text-white" : "text-muted hover:bg-ice hover:text-ink",
                    )
                  }
                >
                  {n.label}
                </AppNavLink>
              ))}
            </nav>
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 md:py-8">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/actual/:sub?" element={<Actual />} />
            <Route path="/model/:sub?" element={<Model />} />
            <Route path="/deeper/:sub?" element={<Deeper />} />
            <Route path="/about/:sub?" element={<About />} />
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
            . Model and analysis: our own. See About for definitions and filters.
          </div>
        </footer>
        </div>
      </ModelProvider>
    </Tooltip.Provider>
  );
}
