import { NextResponse, type NextRequest } from "next/server";
import { getMovieDetails } from "@/lib/catalog";

export async function GET(req: NextRequest, { params }: { params: Promise<{ tmdbId: string }> }) {
  const { tmdbId } = await params;
  const lang = req.nextUrl.searchParams.get("lang") ?? "pt-BR";
  const country = req.nextUrl.searchParams.get("country") ?? "BR";

  if (!process.env.TMDB_API_KEY) return NextResponse.json(null, { status: 404 });

  try {
    const details = await getMovieDetails(tmdbId, { lang, country });
    return NextResponse.json(details, { status: details ? 200 : 404 });
  } catch (e) {
    console.error(`api/movies/${tmdbId}: TMDB falhou`, e);
    // 502, não 404: o filme pode existir, quem não respondeu foi o TMDB.
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }
}
