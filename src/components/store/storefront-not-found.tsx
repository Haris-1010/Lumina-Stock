export function StorefrontNotFound() {
  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center px-4">
      <div className="text-center space-y-4 max-w-md">
        <div className="text-6xl">🏪</div>
        <h1 className="text-2xl font-bold text-zinc-900">Store Not Found</h1>
        <p className="text-zinc-500 text-sm">
          This storefront is not available or has not been published yet.
        </p>
        <p className="text-xs text-zinc-400">
          Powered by{" "}
          <a href="https://luminastocks.com" className="underline hover:text-zinc-600">
            Lumina Stock
          </a>
        </p>
      </div>
    </div>
  );
}
