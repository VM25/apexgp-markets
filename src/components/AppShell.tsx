import React from "react";

interface AppShellProps {
  commandBar: React.ReactNode;
  workspaceNav: React.ReactNode;
  /** Slim mobile-only playback strip, shown under the command bar (<768). */
  mobilePlayback?: React.ReactNode;
  leftRail: React.ReactNode;
  main: React.ReactNode;
  deskPanel: React.ReactNode;
  ticker: React.ReactNode;
  /** Fixed bottom navigation, shown only <768 (component self-hides >=768). */
  mobileTabBar?: React.ReactNode;
  /** Overlay layer: drawers + sheets. Rendered above the grid. */
  overlays?: React.ReactNode;
  atmosphereClass?: string;
  rootClassName?: string;
}

/**
 * Pure layout grid for the terminal (responsive shell modes — Wave B).
 *
 * Rows: command bar / workspace nav / mobile playback / body / ticker / mobile tab bar.
 * Rows that render display:none content (nav <768, playback >=768, tab bar >=768)
 * collapse to 0 height via the `auto` track.
 *
 * Body columns (CSS-first, no JS conditional rendering):
 * - LeftRail aside: inline only >=1280 (xl); becomes a left Drawer below that.
 * - Main: always present, min-w-0 so it is the only content scroll region.
 * - DeskPanel aside: inline only >=1024 (lg); becomes a right Drawer 768-1023
 *   and a bottom sheet <768.
 *
 * Semantic regions preserved: header / nav / aside / main / aside / footer.
 */
export default function AppShell({
  commandBar,
  workspaceNav,
  mobilePlayback,
  leftRail,
  main,
  deskPanel,
  ticker,
  mobileTabBar,
  overlays,
  atmosphereClass = "",
  rootClassName = "",
}: AppShellProps) {
  return (
    <div
      className={`h-dvh grid grid-rows-[auto_auto_auto_1fr_auto_auto] grid-cols-[minmax(0,1fr)] overflow-hidden bg-carbon-black font-mono text-body-sm text-slate-400 select-none antialiased ${atmosphereClass} ${rootClassName}`}
    >
      <header className="shrink-0 min-w-0">{commandBar}</header>

      {/* Workspace tab strip — hidden on mobile (MobileTabBar replaces it). */}
      <nav className="shrink-0 min-w-0 hidden md:block">{workspaceNav}</nav>

      {/* Mobile-only playback strip. */}
      <div className="shrink-0 min-w-0 md:hidden" data-orient-target="playback">{mobilePlayback}</div>

      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] min-h-0 min-w-0 overflow-hidden">
        {/* LeftRail: inline only >=1280. */}
        <aside className="min-h-0 overflow-hidden hidden xl:flex xl:w-[200px] min-[1440px]:w-56">
          {leftRail}
        </aside>

        <main className="min-h-0 min-w-0 overflow-y-auto bg-carbon-light telemetry-grid p-3">
          {main}
        </main>

        {/* DeskPanel: inline only >=1024. */}
        <aside
          data-orient-target="desk"
          className="min-h-0 overflow-hidden hidden lg:flex lg:w-[288px] xl:w-[300px] min-[1440px]:w-[336px] bg-carbon-dark border-l border-white/5 p-3"
        >
          {deskPanel}
        </aside>
      </div>

      <footer className="shrink-0 min-w-0" data-orient-target="commentary">{ticker}</footer>

      {mobileTabBar}

      {overlays}
    </div>
  );
}
