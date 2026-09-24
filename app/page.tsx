import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/Button";
import { Poster, demoPosters } from "@/components/Poster";
import { ptBR as t } from "@/messages/pt-BR";
import styles from "./page.module.css";

export default function Home() {
  return (
    <>
      <main className={styles.hero}>
        <div className={styles.copy}>
          <p className="eyebrow">{t.home.eyebrow}</p>
          <h1>
            {t.home.title[0]}
            <br />
            {t.home.title[1]}
          </h1>
          <p className={`${styles.lead} desktop-only`}>{t.home.lead}</p>
          <p className={`${styles.lead} mobile-only`}>{t.home.leadMobile}</p>
        </div>

        <div className={styles.stage}>
          <div className={styles.halo} aria-hidden="true" />
          <Poster poster={demoPosters.silencio} className={`${styles.poster} ${styles.left}`} priority />
          <Poster poster={demoPosters.ultimaSessao} className={`${styles.poster} ${styles.right}`} priority />
          <Poster poster={demoPosters.horizonte} className={`${styles.poster} ${styles.center}`} priority />
          <div className={`${styles.crew} desktop-only`}>
            <span className={styles.avatars}>
              <Avatar initials="AS" host />
              <Avatar initials="LC" />
              <Avatar initials="BM" />
            </span>
            <span>
              <strong>{t.home.crew.title}</strong>
              <small>{t.home.crew.subtitle}</small>
            </span>
          </div>
        </div>

        <p className={`eyebrow ${styles.company} mobile-only`}>{t.home.company}</p>

        <div className={styles.actions}>
          <div className={styles.buttons}>
            <Button icon="arrow" href="/criar">
              {t.home.createRoom}
            </Button>
            <Button icon="link" variant="secondary" href="/entrar">
              {t.home.joinWithCode}
            </Button>
          </div>
          <p className={`${styles.note} desktop-only`}>{t.home.noSignup}</p>
        </div>
      </main>

      <section id="como-funciona" className={`${styles.steps} desktop-only`}>
        {t.home.steps.map((step, i) => (
          <div key={step.title}>
            <span className="eyebrow">{String(i + 1).padStart(2, "0")}</span>
            <h2>{step.title}</h2>
            <p>{step.text}</p>
          </div>
        ))}
      </section>

    </>
  );
}
