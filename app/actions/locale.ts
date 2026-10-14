"use server";

import { cookies } from "next/headers";
import { LOCALE_COOKIE, toLocale } from "@/messages";

/** Grava o idioma escolhido no seletor por 1 ano. */
export async function setLocale(locale: string) {
  (await cookies()).set(LOCALE_COOKIE, toLocale(locale), { maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
}
