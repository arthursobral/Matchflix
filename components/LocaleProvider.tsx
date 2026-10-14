"use client";

import { createContext, useContext, type ReactNode } from "react";
import { messagesFor, type Locale, type Messages } from "@/messages";

const LocaleContext = createContext<Locale>("pt");

/** Entrega o idioma (lido do cookie no layout, no servidor) aos componentes do navegador. */
export function LocaleProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

export function useLocale(): Locale {
  return useContext(LocaleContext);
}

export function useMessages(): Messages {
  return messagesFor(useContext(LocaleContext));
}
