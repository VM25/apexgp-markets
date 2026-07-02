import React from "react";

interface AppShellProps {
  commandBar: React.ReactNode;
  workspaceNav: React.ReactNode;
  leftRail: React.ReactNode;
  main: React.ReactNode;
  deskPanel: React.ReactNode;
  ticker: React.ReactNode;
  atmosphereClass?: string;
  rootClassName?: string;
}

/**
 * Pure layout grid for the terminal.
 * - h-dvh, four rows: command bar / workspace nav / body / ticker.
 * - Body is a 3-column grid (left rail / main / desk panel), min-h-0 so <main>
 *   is the only scroll region for tab content.
 * Semantic regions preserved: header / nav / aside / main / aside / footer.
 */
export default function AppShell({
  commandBar,
  workspaceNav,
  leftRail,
  main,
  deskPanel,
  ticker,
  atmosphereClass = "",
  rootClassName = "",
}: AppShellProps) {
  return (
    <div
      className={`h-dvh grid grid-rows-[auto_auto_1fr_auto] grid-cols-[minmax(0,1fr)] overflow-hidden bg-carbon-black font-mono text-body-sm text-slate-400 select-none antialiased ${atmosphereClass} ${rootClassName}`}
    >
      <header className="shrink-0 min-w-0">{commandBar}</header>

      <nav className="shrink-0 min-w-0">{workspaceNav}</nav>

      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] min-h-0 min-w-0 overflow-hidden">
        <aside className="min-h-0 overflow-hidden flex">{leftRail}</aside>

        <main className="min-h-0 min-w-0 overflow-y-auto bg-carbon-light telemetry-grid p-3">
          {main}
        </main>

        <aside className="min-h-0 overflow-hidden flex w-[320px] xl:w-[336px] bg-carbon-dark border-l border-white/5 p-3">
          {deskPanel}
        </aside>
      </div>

      <footer className="shrink-0">{ticker}</footer>
    </div>
  );
}
