"use client";

import { useState } from "react";
import { Button } from "./Button";

type Props = { label: string; copiedLabel: string; code: string };

/** Copia o link de convite. Formato do link é provisório (M2 define a rota de entrada). */
export function CopyInviteButton({ label, copiedLabel, code }: Props) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    const url = `${window.location.origin}/entrar?codigo=${encodeURIComponent(code.replace(/\s/g, ""))}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Sem permissão de área de transferência: o botão não muda de estado.
    }
  }

  return (
    <div aria-live="polite">
      <Button icon="link" variant="gold" onClick={copy}>
        {copied ? copiedLabel : label}
      </Button>
    </div>
  );
}
