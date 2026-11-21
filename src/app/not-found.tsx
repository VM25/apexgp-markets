import Link from "next/link";

export default function NotFound() {
  return (
    <div className="max-w-lg mx-auto mt-[12dvh] text-center">
      <p className="eyebrow">404 · off the racing line</p>
      <h1 className="display text-[40px] mt-2">No such page</h1>
      <p className="text-ink-2 mt-3">That address is not part of ApexGP Markets.</p>
      <Link href="/" className="btn btn-solid mt-6">Back to the overview</Link>
    </div>
  );
}
