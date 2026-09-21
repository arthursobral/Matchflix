"use client";

import { useState } from "react";
import { Button } from "@/components/Button";
import { ptBR as t } from "@/messages/pt-BR";
import styles from "./create.module.css";

const c = t.create;

/** "Todos" é exclusivo; sem nenhum gênero marcado volta a "Todos". */
function toggleGenre(current: string[], value: string) {
  if (value === c.genres.all) return [c.genres.all];
  const next = current.includes(value)
    ? current.filter((g) => g !== value)
    : [...current.filter((g) => g !== c.genres.all), value];
  return next.length ? next : [c.genres.all];
}

export function CreateRoom() {
  const [name, setName] = useState<string>(c.roomName.defaultValue);
  const [mode, setMode] = useState<string>(c.mode.options[0].value);
  const [genres, setGenres] = useState<string[]>([c.genres.all]);

  return (
    <main className={styles.main}>
      <section className={styles.intro}>
        <p className="eyebrow">{c.eyebrow}</p>
        <h1>{c.title}</h1>
        <p className={`${styles.lead} desktop-only`}>{c.lead}</p>
        <p className={`${styles.lead} mobile-only`}>{c.leadMobile}</p>

        <aside className={`${styles.ticket} desktop-only`} aria-label={c.ticket.eyebrow}>
          <p className="eyebrow">{c.ticket.eyebrow}</p>
          <p className={styles.ticketName}>{name.trim() || c.ticket.emptyName}</p>
          <ul>
            <li>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M20 21v-2a4 4 0 0 0-3-4M16 3a4 4 0 0 1 0 8" />
              </svg>
              {c.ticket.perks[0]}
            </li>
            <li>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="m5 12 4 4L19 6" />
              </svg>
              {c.ticket.perks[1]}
            </li>
          </ul>
          <p className={styles.ticketNote}>{c.ticket.note}</p>
        </aside>
      </section>

      <div className={styles.form}>
        <div className={styles.field}>
          <label htmlFor="room-name">{c.roomName.label}</label>
          <input
            id="room-name"
            className={styles.control}
            value={name}
            maxLength={c.roomName.maxLength}
            onChange={(e) => setName(e.target.value)}
            autoComplete="off"
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="room-country">{c.country.label}</label>
          <div className={styles.selectWrap}>
            <select id="room-country" className={styles.control} defaultValue={c.country.options[0].value}>
              {c.country.options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div role="group" aria-labelledby="mode-label" className={styles.modeGroup}>
          <p id="mode-label" className={styles.groupLabel}>
            {c.mode.label}
          </p>
          <div className={styles.modes}>
            {c.mode.options.map((o) => (
              <label key={o.value} className={styles.pill}>
                <input
                  type="radio"
                  name="mode"
                  value={o.value}
                  checked={mode === o.value}
                  onChange={() => setMode(o.value)}
                />
                <span>{o.label}</span>
              </label>
            ))}
          </div>
        </div>

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
                <input
                  type="checkbox"
                  value={o.value}
                  checked={genres.includes(o.value)}
                  onChange={() => setGenres((g) => toggleGenre(g, o.value))}
                />
                <span>{o.label}</span>
              </label>
            ))}
          </div>
        </div>

        <p className={`${styles.help} desktop-only`}>{c.genres.help}</p>

        <div className={styles.submit}>
          {/* M1: navegação de demonstração; a criação real da sala é do M2. */}
          <Button icon="arrow" href="/sala">
            {c.submit}
          </Button>
          <p className={`${styles.submitNote} mobile-only`}>{c.submitNote}</p>
        </div>
      </div>
    </main>
  );
}
