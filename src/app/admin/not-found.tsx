import Link from "next/link";
import { buttonClass } from "@/components/ui/button";

export default function AdminNotFound() {
  return (
    <div className="mx-auto max-w-md px-4 py-16 text-center">
      <h1 className="font-display text-2xl font-bold">Not found</h1>
      <p className="mt-2 text-muted">This item doesn’t exist any more, or the link is wrong.</p>
      <Link href="/admin" className={buttonClass("primary", "md", "mt-6")}>
        Back to admin home
      </Link>
    </div>
  );
}
