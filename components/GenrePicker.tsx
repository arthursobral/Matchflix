"use client";

import { useMessages } from "./LocaleProvider";
import styles from "@/app/criar/create.module.css";

/** Valor (não texto) da opção "Todos", igual em qualquer idioma. */
const ALL = "todos";

/** "Todos" é exclusivo; sem nenhum gênero marcado volta a "Todos". */
export function toggleGenre(current: string[], value: string) {
  if (value === ALL) return [ALL];
  const next = current.includes(value) ? current.filter((g) => g !== value) : [...current.filter((g) => g !== ALL), value];
  return next.length ? next : [ALL];
}

type Props = { genres: string[]; onChange: (genres: string[]) => void };

/** Mesmo seletor de Criar Sala (M1), reaproveitado — nenhum controle novo. */
export function GenrePicker({ genres, onChange }: Props) {
  const c = useMessages().create;
  return (
    <div role="group" aria-labelledby="genres-label" className={styles.genreGroup}>
      <div className={styles.groupHead}>
        <p id="genres-label" className={styles.groupLabel}>
          {c.genres.label}
        </p>
        <span className={styles.hint}>{c.genres.hint}</span>
      </div>
      <div className={styles.genres}>
        {c.genres.options.map((o) => (
          <label key={o.value} className={styles.pill}>
            <input type="checkbox" value={o.value} checked={genres.includes(o.value)} onChange={() => onChange(toggleGenre(genres, o.value))} />
            <span>{o.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
