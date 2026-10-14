import type { Metadata } from "next";
import { demoAvailability, demoMovies } from "@/lib/demo-movies";
import { demoRoom } from "@/lib/demo-room";
import { getMessages } from "@/lib/i18n-server";
import { countryLabel } from "@/lib/labels";
import { MatchView } from "./MatchView";

// M1: o match de demonstração é sempre o primeiro filme; o de uma sala real está em /match/[code]/[movieId].
const movie = demoMovies[0];

export async function generateMetadata(): Promise<Metadata> {
  return { title: `${(await getMessages()).match.title} — Matchflix` };
}

export default async function MatchPage() {
  const t = await getMessages();
  return (
    <MatchView
      movie={movie}
      participants={demoRoom.participants}
      country={countryLabel("BR", t)}
      provider={{ name: demoAvailability.provider, note: t.match.providerNote.flatrate }}
      keepGoingHref="/escolher"
      haloBackground={`var(--halo-${movie.halo})`}
      watchHref={null}
    />
  );
}
