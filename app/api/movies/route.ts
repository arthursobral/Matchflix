import { NextResponse, type NextRequest } from "next/server";
import { discoverMovieIds } from "@/lib/catalog";
import { demoMovies } from "@/lib/demo-movies";

/**
 * Baralho candidato para uma rodada. Sem `TMDB_API_KEY` configurada (ex.: ambiente local
 * sem a chave ainda, ou CI), cai nos filmes fictícios do M1 — mesmo princípio do cliente
 * preguiçoso do Supabase (lib/supabase/client.ts): degrada, não quebra o fluxo de sala.
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const genres = Array.isArray(body.genres) ? body.genres : [];
  const exclude = Array.isArray(body.exclude) ? body.exclude : [];

  if (!process.env.TMDB_API_KEY) {
    return NextResponse.json({ movieIds: demoMovies.map((m) => m.id).filter((id) => !exclude.includes(id)) });
  }

  try {
    const movieIds = await discoverMovieIds({ genres, exclude });
    return NextResponse.json({ movieIds });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }
}
