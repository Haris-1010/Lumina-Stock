import { Globe } from "lucide-react";
import { Button } from "@/components/ui/button";

export function StorefrontEnterpriseGate() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center space-y-4 max-w-md mx-auto">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-100 dark:bg-violet-900/30">
        <Globe className="h-7 w-7 text-violet-600 dark:text-violet-400" />
      </div>
      <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Public Storefront Builder</h2>
      <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
        Launch an AI-generated public website for your business — complete with product catalog,
        about section, features, and contact info. Available on the Enterprise plan.
      </p>
      <Button asChild>
        <a href="mailto:sales@lumina-stock.com?subject=Lumina%20Stock%20Enterprise%20Plan%20Request">
          Contact Sales to Upgrade
        </a>
      </Button>
    </div>
  );
}
