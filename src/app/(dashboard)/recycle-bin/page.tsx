import { RecycleBinClient } from "@/components/recycle-bin/recycle-bin-client";
import { getRecycleBinItemsForCurrentOrganization } from "@/lib/actions/recycle-bin";
import { getServerLanguage } from "@/lib/i18n-server";

export default async function RecycleBinPage() {
  const [language, items] = await Promise.all([
    getServerLanguage(),
    getRecycleBinItemsForCurrentOrganization(),
  ]);

  const title = language === "ur" ? "ری سائیکل بن" : "Recycle Bin";
  const subtitle =
    language === "ur"
      ? "حذف شدہ ریکارڈز یہاں محفوظ ہیں — بحال کریں یا مستقل حذف کریں۔"
      : "Deleted records are stored here. Restore them or permanently remove them.";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{title}</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">{subtitle}</p>
      </div>
      <RecycleBinClient initialItems={items} />
    </div>
  );
}
