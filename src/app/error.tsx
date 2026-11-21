"use client";

import Link from "next/link";
import { useEffect } from "react";

/** Route-level error boundary: a rendering fault never leaves a blank page, and the session is untouched. */
export default function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div role="alert" className="max-w-xl mx-auto mt-[10dvh] sheet !border-ink border-2 p-5">
      <p className="eyebrow">Something broke on this page</p>
      <h1 className="display text-[26px] mt-1">That view failed to draw</h1>
      <p className="text-ink-2 mt-3 text-[15px]">Your session is saved in this browser and has not been changed. Try the view again; if it keeps failing, the other sections of the app still work.</p>
      <p className="num text-[12.5px] text-ink-3 mt-3 break-words">{error.message}</p>
      <div className="flex gap-2 mt-4">
        <button className="btn btn-solid" onClick={() => reset()}>Try again</button>
        <Link className="btn" href="/">Go to the overview</Link>
      </div>
    </div>
  );
}
