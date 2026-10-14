"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { setLocale } from "@/app/actions/locale";
import { useLocale, useMessages } from "./LocaleProvider";

/** O botão "Brasil · PT" do cabeçalho: alterna entre português e inglês. */
export function LocaleToggle({ className }: { className?: string }) {
  const locale = useLocale();
  const t = useMessages();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      className={className}
      aria-label={t.nav.switchLocale}
      aria-busy={pending}
      onClick={() =>
        startTransition(async () => {
          await setLocale(locale === "en" ? "pt" : "en");
          router.refresh();
        })
      }
    >
      {t.nav.locale}
    </button>
  );
}
