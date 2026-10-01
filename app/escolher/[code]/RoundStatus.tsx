import Link from "next/link";
import { Button } from "@/components/Button";
import { ptBR as t } from "@/messages/pt-BR";
import styles from "./round.module.css";

const r = t.round;

export type EndRow = { id: string; title: string; href: string | null; approvals: number; voters: number };

/**
 * Estados provisórios do M5 (sem design aprovado ainda — ver messages/pt-BR.ts `round`):
 * mesmo par etiqueta dourada + título serifado das outras telas, texto e o Button aprovado.
 */
export function RoundStatus(
  props:
    | { kind: "waiting"; roundNumber: number }
    | {
        kind: "ended";
        roundNumber: number;
        matched: EndRow[];
        top: EndRow[];
        isHost: boolean;
        starting: boolean;
        error: string | null;
        onNextRound: () => void;
      },
) {
  return (
    <main className={styles.main}>
      <p className="eyebrow">{t.pick.round(props.roundNumber)}</p>
      {props.kind === "waiting" ? (
        <>
          <h1>{r.waitingTitle}</h1>
          <p className={styles.lead}>{r.waitingLead}</p>
        </>
      ) : (
        <>
          <h1>{r.endTitle}</h1>
          <p className={styles.lead}>{props.matched.length > 0 ? r.matchedLead : r.noMatchLead}</p>
          <ul className={styles.list}>
            {(props.matched.length > 0 ? props.matched : props.top).map((row) => (
              <li key={row.id}>
                {row.href ? <Link href={row.href}>{row.title}</Link> : <span>{row.title}</span>}
                <small>{r.approvals(row.approvals, row.voters)}</small>
              </li>
            ))}
          </ul>
          <div className={styles.next}>
            {props.isHost ? (
              <Button icon="arrow" onClick={() => !props.starting && props.onNextRound()}>
                {r.nextRound}
              </Button>
            ) : (
              <p>{r.waitingHost}</p>
            )}
            {props.error && <p role="alert">{props.error}</p>}
          </div>
        </>
      )}
    </main>
  );
}
