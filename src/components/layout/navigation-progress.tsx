/** Rendered only by the route's Suspense loading fallback. */
export function NavigationProgress() {
  return (
    <div
      role="progressbar"
      aria-label="Loading page"
      data-navigation-progress
      className="pointer-events-none fixed inset-x-0 top-0 z-[9999] h-[3px] overflow-hidden bg-emerald-500/20"
    >
      <div className="h-full w-full animate-pulse bg-emerald-500 motion-reduce:animate-none" />
    </div>
  );
}
