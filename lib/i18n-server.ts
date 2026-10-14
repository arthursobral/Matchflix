import { cookies } from "next/headers";
import { LOCALE_COOKIE, messagesFor, toLocale, type Locale, type Messages } from "@/messages";

/** Idioma escolhido no seletor (cookie), lido no servidor: a página já chega no idioma certo. */
export async function getLocale(): Promise<Locale> {
  return toLocale((await cookies()).get(LOCALE_COOKIE)?.value);
}

export async function getMessages(): Promise<Messages> {
  return messagesFor(await getLocale());
}
