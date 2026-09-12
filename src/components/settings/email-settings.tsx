"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateCurrentUserEmail } from "@/lib/actions/profile";

export function EmailSettings({
  initialEmail,
  language,
}: {
  initialEmail: string;
  language: string;
}) {
  const isUr = language === "ur";
  const router = useRouter();
  const [currentEmail, setCurrentEmail] = useState(initialEmail);
  const [newEmail, setNewEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    setFeedback(null);
    setError(null);
    startTransition(async () => {
      const result = await updateCurrentUserEmail({ newEmail, currentPassword });
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setCurrentEmail(result.email);
      setNewEmail("");
      setCurrentPassword("");
      setFeedback(isUr ? "ای میل اپ ڈیٹ ہوگیا۔" : "Email address updated.");
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <Label>{isUr ? "موجودہ ای میل" : "Current Email"}</Label>
        <Input value={currentEmail} disabled readOnly />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="new-email">{isUr ? "نیا ای میل" : "New Email"}</Label>
          <Input
            id="new-email"
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder={isUr ? "آپ کا نیا ای میل" : "you@yourcompany.com"}
            autoComplete="email"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="current-password">{isUr ? "موجودہ پاس ورڈ" : "Current Password"}</Label>
          <Input
            id="current-password"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder={isUr ? "تصدیق کے لیے" : "To confirm it's you"}
            autoComplete="current-password"
          />
        </div>
      </div>

      <Button onClick={handleSave} disabled={isPending || !newEmail || !currentPassword}>
        <Save className="h-4 w-4" />
        {isPending ? (isUr ? "محفوظ ہو رہا ہے..." : "Saving...") : isUr ? "ای میل تبدیل کریں" : "Change Email"}
      </Button>

      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </p>
      )}
      {feedback && (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300">
          {feedback}
        </p>
      )}
    </div>
  );
}
