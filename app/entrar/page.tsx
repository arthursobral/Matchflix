import type { Metadata } from "next";
import { getMessages } from "@/lib/i18n-server";
import { Suspense } from "react";
import { JoinRoom } from "./JoinRoom";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getMessages()).meta.join };
}

export default function JoinPage() {
  // useSearchParams exige um Suspense boundary no App Router.
  return (
    <Suspense>
      <JoinRoom />
    </Suspense>
  );
}
