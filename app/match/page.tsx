import type { Metadata } from "next";
import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/Button";
import { Poster } from "@/components/Poster";
import { SoonButton } from "@/components/SoonButton";
import { demoAvailability, demoMovies } from "@/lib/demo-movies";
import { demoRoom as room } from "@/lib/demo-room";
import { ptBR as t } from "@/messages/pt-BR";
import styles from "./match.module.css";

const m = t.match;
// M1: o match de demonstração é sempre o primeiro filme; o resultado real vem do servidor no M5.
const movie = demoMovies[0];
const names = new Intl.ListFormat("pt-BR", { style: "long", type: "conjunction" }).format(room.participants.map((p) => p.name));

export const metadata: Metadata = { title: `${m.title} — Matchflix` };

export default function MatchPage() {
  const total = room.participants.length;

  return (
    <main className={styles.main}>
      <div className={styles.halo} style={{ background: `var(--halo-${movie.halo})` }} aria-hidden="true" />

      <div className={styles.head}>
        <p className="eyebrow">{m.eyebrow}</p>
        <h1>{m.title}</h1>
        <p className={styles.summary}>
          {m.summary(total, total)}
          <span className="desktop-only"> {m.summaryExtra}</span>
        </p>
      </div>

      <figure className={styles.visual}>
        <Poster poster={movie.poster} className={styles.poster} priority />
        <figcaption className="desktop-only">{m.caption}</figcaption>
      </figure>

      <div className={styles.info}>
        <h2>{movie.title}</h2>
        <p className={styles.meta}>{movie.meta}</p>

        <div className={styles.people}>
          <span className={styles.avatars}>
            {room.participants.map((p) => (
              <Avatar key={p.name} initials={p.initials} host={p.host} />
            ))}
          </span>
          <span className="desktop-only">{names}</span>
        </div>

        <div className={styles.where}>
          <p className="eyebrow">
            {t.pick.where} · {room.country}
          </p>
          <p className={styles.provider}>
            <strong>{demoAvailability.provider}</strong>
            <span>{demoAvailability.note}</span>
          </p>
          <svg className={`${styles.check} mobile-only`} viewBox="0 0 24 24" aria-hidden="true">
            <path d="m5 12 4 4L19 6" />
          </svg>
        </div>

        <div className={styles.buttons}>
          {/* Os links reais de streaming chegam no M6; até lá o botão avisa "Em breve". */}
          <SoonButton icon="arrow" soonLabel={t.nav.soon}>
            {m.watch}
          </SoonButton>
          <Button variant="secondary" href="/escolher">
            {m.keepGoing}
          </Button>
        </div>
      </div>
    </main>
  );
}
