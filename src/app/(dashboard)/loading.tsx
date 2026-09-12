import { NavigationProgress } from "@/components/layout/navigation-progress";

export default function DashboardLoading() {
  return (
    <div role="status" className="flex flex-1 items-center justify-center py-20">
      <NavigationProgress />
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 rounded-full border-4 border-zinc-200 border-t-violet-500 animate-spin" />
        <p className="text-sm text-zinc-400">Loading…</p>
      </div>
    </div>
  );
}
