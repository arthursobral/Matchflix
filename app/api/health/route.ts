import { NextResponse } from "next/server";

/**
 * Saúde do app para um monitor de disponibilidade (ex.: UptimeRobot) chamar de tempos em
 * tempos: 200 se o Supabase e o TMDB respondem, 503 se não. Nunca devolve chaves nem URLs.
 * As checagens ficam em cache por 60s, para que chamar esta rota em excesso não gaste a
 * cota do TMDB.
 */
async function check(url: string, headers?: Record<string, string>): Promise<string> {
  try {
    const res = await fetch(url, { headers, next: { revalidate: 60 }, signal: AbortSignal.timeout(5000) });
    return res.ok ? "ok" : `respondeu ${res.status}`;
  } catch {
    return "não respondeu";
  }
}

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const tmdbKey = process.env.TMDB_API_KEY;

  const [supabase, tmdb] = await Promise.all([
    supabaseUrl && anonKey ? check(`${supabaseUrl}/auth/v1/health`, { apikey: anonKey }) : "não configurado",
    tmdbKey ? check(`https://api.themoviedb.org/3/configuration?api_key=${tmdbKey}`) : "não configurado",
  ]);
  const ok = supabase === "ok" && tmdb === "ok";
  if (!ok) console.error("health: dependência com problema", { supabase, tmdb });
  return NextResponse.json({ ok, supabase, tmdb }, { status: ok ? 200 : 503 });
}
