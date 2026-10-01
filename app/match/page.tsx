import type { Metadata } from "next";
import { demoAvailability, demoMovies } from "@/lib/demo-movies";
import { demoRoom } from "@/lib/demo-room";
import { ptBR as t } from "@/messages/pt-BR";
import { MatchView } from "./MatchView";

// M1: o match de demonstração é sempre o primeiro filme; o de uma sala real está em /match/[code]/[movieId].
const movie = demoMovies[0];

export const metadata: Metadata = { title: `${t.match.title} — Matchflix` };

export default function MatchPage() {
  return (
    <MatchView
      movie={movie}
      participants={demoRoom.participants}
      country={demoRoom.country}
      provider={{ name: demoAvailability.provider, note: demoAvailability.note }}
      keepGoingHref="/escolher"
      haloBackground={`var(--halo-${movie.halo})`}
    />
  );
}
