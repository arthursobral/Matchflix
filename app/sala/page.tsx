import type { Metadata } from "next";
import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/Button";
import { demoRoom as room } from "@/lib/demo-room";
import { ptBR as t } from "@/messages/pt-BR";
import styles from "./sala.module.css";

const r = t.room;

export const metadata: Metadata = { title: `${room.name} — Matchflix` };

export default function RoomPage() {
  const total = room.participants.length;

  return (
    <main className={styles.main}>
      <section className={styles.intro}>
        <p className="eyebrow">{r.eyebrow}</p>
        <h1>{room.name}</h1>
        <p className={`${styles.lead} desktop-only`}>{r.lead}</p>
        <p className={`${styles.lead} mobile-only`}>{r.leadMobile}</p>

        <div className={styles.invite}>
          <p className="eyebrow desktop-only">{r.invite.eyebrow}</p>
          <p className="eyebrow mobile-only">{r.invite.eyebrowMobile}</p>
          <p className={styles.code}>{room.code}</p>
          <p className={`${styles.private} desktop-only`}>{r.invite.private}</p>
          <div className={styles.copy}>
            <Button icon="link" variant="gold" unavailableHint={t.nav.soon}>
              {r.invite.copy}
            </Button>
          </div>
          <p className={`${styles.meta} desktop-only`}>
            {room.country} · {room.genres}
          </p>
        </div>
      </section>

      <section className={styles.roster}>
        <div className={styles.rosterHead}>
          <h2 className="desktop-only">{r.who}</h2>
          <h2 className="mobile-only">{r.whoMobile}</h2>
          <p className="desktop-only">{r.countInRoom(total)}</p>
          <p className="mobile-only">{r.count(total)}</p>
        </div>

        <ul className={styles.list}>
          {room.participants.map((p) => (
            <li key={p.name}>
              <Avatar initials={p.initials} host={p.host} size="lg" />
              <span className={styles.who}>
                <strong>{p.you ? `${p.name} · ${r.you}` : p.name}</strong>
                <small>{p.host ? r.host : r.ready}</small>
              </span>
              <svg className={styles.check} viewBox="0 0 24 24" aria-hidden="true">
                <path d="m5 12 4 4L19 6" />
              </svg>
            </li>
          ))}
        </ul>

        <p className={`${styles.meta} ${styles.metaMobile} mobile-only`}>
          {room.country} · {room.genres}
        </p>

        <div className={styles.start}>
          {/* M1: navegação de demonstração; o início real da rodada é do M3. */}
          <Button icon="arrow" href="/escolher">
            {r.start}
          </Button>
          <p className="desktop-only">{r.startNote}</p>
          <p className="mobile-only">{r.startNoteMobile}</p>
        </div>
      </section>
    </main>
  );
}
