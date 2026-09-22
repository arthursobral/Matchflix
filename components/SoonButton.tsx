"use client";

import { useState } from "react";
import { Button } from "./Button";

type Props = Omit<React.ComponentProps<typeof Button>, "onClick" | "href" | "unavailableHint"> & { soonLabel: string };

/** Botão com a aparência normal para funções que ainda não existem: ao clicar, avisa "Em breve". */
export function SoonButton({ children, soonLabel, ...rest }: Props) {
  const [soon, setSoon] = useState(false);

  function onClick() {
    setSoon(true);
    setTimeout(() => setSoon(false), 2000);
  }

  return (
    <div aria-live="polite" style={{ display: "contents" }}>
      <Button {...rest} onClick={onClick}>
        {soon ? soonLabel : children}
      </Button>
    </div>
  );
}
