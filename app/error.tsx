"use client";

import { useEffect } from "react";
import { Button } from "@/components/Button";
import { useMessages } from "@/components/LocaleProvider";
import styles from "./escolher/[code]/round.module.css";

export default function ErrorPage({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const s = useMessages().status;
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className={styles.main}>
      <p className="eyebrow">{s.error.eyebrow}</p>
      <h1>{s.error.title}</h1>
      <p className={styles.lead} role="alert">
        {s.error.lead}
      </p>
      <div className={styles.next}>
        <Button icon="arrow" onClick={retry}>
          {s.retry}
        </Button>
        <Button variant="secondary" href="/">
          {s.home}
        </Button>
      </div>
    </main>
  );
}
