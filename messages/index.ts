import { en } from "./en";
import { ptBR } from "./pt-BR";

export type Locale = "pt" | "en";
export const LOCALE_COOKIE = "locale";

/** Mesma estrutura dos textos em português, mas aceitando qualquer frase (o `as const` fixaria as palavras). */
type Widen<T> = T extends string
  ? string
  : T extends (...args: infer A) => infer R
    ? (...args: A) => Widen<R>
    : T extends readonly (infer U)[]
      ? readonly Widen<U>[]
      : T extends object
        ? { readonly [K in keyof T]: Widen<T[K]> }
        : T;

export type Messages = Widen<typeof ptBR>;

export function toLocale(value: string | undefined): Locale {
  return value === "en" ? "en" : "pt";
}

export function messagesFor(locale: Locale): Messages {
  return locale === "en" ? en : ptBR;
}
