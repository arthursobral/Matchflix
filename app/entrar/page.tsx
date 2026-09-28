import type { Metadata } from "next";
import { Suspense } from "react";
import { JoinRoom } from "./JoinRoom";

export const metadata: Metadata = { title: "Entrar na sala — Matchflix" };

export default function JoinPage() {
  // useSearchParams exige um Suspense boundary no App Router.
  return (
    <Suspense>
      <JoinRoom />
    </Suspense>
  );
}
