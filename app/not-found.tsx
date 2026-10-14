import { Button } from "@/components/Button";
import { getMessages } from "@/lib/i18n-server";
import styles from "./escolher/[code]/round.module.css";

export default async function NotFound() {
  const s = (await getMessages()).status;
  return (
    <main className={styles.main}>
      <p className="eyebrow">{s.notFound.eyebrow}</p>
      <h1>{s.notFound.title}</h1>
      <p className={styles.lead}>{s.notFound.lead}</p>
      <div className={styles.next}>
        <Button icon="arrow" href="/">
          {s.home}
        </Button>
      </div>
    </main>
  );
}
