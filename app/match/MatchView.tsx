import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/Button";
import { Poster, type PosterImage } from "@/components/Poster";
import { SoonButton } from "@/components/SoonButton";
import { ptBR as t } from "@/messages/pt-BR";
import styles from "./match.module.css";

const m = t.match;

type Props = {
  movie: { title: string; meta: string; poster: PosterImage };
  /** Quem aprovou — num match, todos os participantes ativos. */
  participants: readonly { name: string; initials: string; host: boolean }[];
  country: string;
  provider: { name: string; note: string } | null;
  keepGoingHref: string;
  haloBackground: string;
};

/** Composição aprovada da tela de match (M1), com os dados vindos de fora. */
export function MatchView({ movie, participants, country, provider, keepGoingHref, haloBackground }: Props) {
  const total = participants.length;
  const names = new Intl.ListFormat("pt-BR", { style: "long", type: "conjunction" }).format(participants.map((p) => p.name));

  return (
    <main className={styles.main}>
      <div className={styles.halo} style={{ background: haloBackground }} aria-hidden="true" />

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
            {participants.map((p, i) => (
              <Avatar key={`${p.name}-${i}`} initials={p.initials} host={p.host} />
            ))}
          </span>
          <span className="desktop-only">{names}</span>
        </div>

        <div className={styles.where}>
          <p className="eyebrow">
            {t.pick.where} · {country}
          </p>
          <p className={styles.provider}>
            {provider ? (
              <>
                <strong>{provider.name}</strong>
                <span>{provider.note}</span>
              </>
            ) : (
              <span>{t.pick.noAvailability}</span>
            )}
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
          <Button variant="secondary" href={keepGoingHref}>
            {m.keepGoing}
          </Button>
        </div>
      </div>
    </main>
  );
}
