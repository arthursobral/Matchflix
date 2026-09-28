"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/Button";
import { joinRoom, RoomExpiredError, RoomNotFoundError } from "@/lib/rooms";
import { ptBR as t } from "@/messages/pt-BR";
import styles from "./entrar.module.css";

const j = t.join;

/**
 * Tela provisória de entrada por código/link — design ainda não aprovado (ver
 * docs/m2-criar-entrar-salas.md). Reaproveita só os tokens e componentes já
 * aprovados (Button, campos no mesmo estilo de Criar sala), sem layout novo.
 */
export function JoinRoom() {
  const router = useRouter();
  const params = useSearchParams();
  const [code, setCode] = useState(params.get("codigo") ?? "");
  const [nickname, setNickname] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    if (!code.trim() || !nickname.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const room = await joinRoom(code.trim(), nickname.trim());
      router.push(`/sala/${room.code}`);
    } catch (err) {
      if (err instanceof RoomNotFoundError) setError(j.notFound);
      else if (err instanceof RoomExpiredError) setError(j.expired);
      else setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  return (
    <main className={styles.main}>
      <p className="eyebrow">{j.eyebrow}</p>
      <h1 className={styles.title}>{j.title}</h1>

      <form className={styles.form} onSubmit={submit}>
        <div className={styles.field}>
          <label htmlFor="join-code">{j.codeLabel}</label>
          <input
            id="join-code"
            className={styles.control}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder={j.codePlaceholder}
            autoComplete="off"
            disabled={busy}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="join-nickname">{j.nicknameLabel}</label>
          <input
            id="join-nickname"
            className={styles.control}
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder={j.nicknamePlaceholder}
            maxLength={24}
            autoComplete="off"
            disabled={busy}
          />
        </div>

        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}

        <Button icon="arrow" onClick={() => submit()}>
          {busy ? j.busy : j.submit}
        </Button>
      </form>
    </main>
  );
}
