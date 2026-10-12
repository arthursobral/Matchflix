import { Button } from "@/components/Button";
import { ptBR as t } from "@/messages/pt-BR";
import styles from "./escolher/[code]/round.module.css";

const s = t.status;

export default function NotFound() {
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
