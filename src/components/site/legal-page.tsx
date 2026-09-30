import type { LegalDoc } from "@/content/legal";
import { formatDate } from "@/lib/format";

export function LegalPage({ doc, updated, lang, updatedLabel }: { doc: LegalDoc; updated: string; lang: "en" | "te"; updatedLabel: string }) {
  return (
    <article className="mx-auto max-w-2xl px-4 pb-16 pt-10">
      <h1 className="font-display text-3xl font-bold sm:text-4xl">{doc.title}</h1>
      <p className="mt-3 text-lg text-muted">{doc.intro}</p>
      <div className="mt-8 space-y-8">
        {doc.sections.map((section) => (
          <section key={section.heading}>
            <h2 className="font-display text-xl font-bold">{section.heading}</h2>
            {section.paragraphs?.map((p) => (
              <p key={p} className="mt-2 text-[1.02rem] leading-relaxed">
                {p}
              </p>
            ))}
            {section.bullets ? (
              <ul className="mt-2 list-disc space-y-1.5 pl-5 text-[1.02rem] leading-relaxed marker:text-faint">
                {section.bullets.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            ) : null}
          </section>
        ))}
      </div>
      <p className="mt-10 text-sm text-muted">
        {updatedLabel}: {formatDate(updated, lang)}
      </p>
    </article>
  );
}
