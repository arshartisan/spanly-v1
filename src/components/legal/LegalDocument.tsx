import type { LegalBlock, LegalDocument as LegalDoc } from "@/lib/legal-content";

// Renders a structured legal document (Terms / Privacy). Pure/server — mirrors the help
// ArticleBody renderer so legal pages share the app's reading style with no markdown pipeline.

function Block({ block }: { block: LegalBlock }) {
  switch (block.type) {
    case "h":
      return <h3 className="mt-4 text-sm font-semibold text-foreground">{block.text}</h3>;
    case "p":
      return <p className="text-sm leading-relaxed text-muted-foreground">{block.text}</p>;
    case "ul":
      return (
        <ul className="ml-5 list-disc space-y-1.5 text-sm text-muted-foreground">
          {block.items.map((it, j) => (
            <li key={j}>{it}</li>
          ))}
        </ul>
      );
    default:
      return null;
  }
}

export function LegalDocument({ doc }: { doc: LegalDoc }) {
  return (
    <article className="mx-auto w-full max-w-3xl">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">{doc.title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Effective date: {doc.effectiveDate}
        </p>
      </header>

      <div className="mt-6 flex flex-col gap-3 border-b pb-6">
        {doc.intro.map((block, i) => (
          <Block key={i} block={block} />
        ))}
      </div>

      <div className="mt-8 flex flex-col gap-10">
        {doc.sections.map((section) => (
          <section key={section.heading} className="flex flex-col gap-3 scroll-mt-24">
            <h2 className="text-lg font-semibold tracking-tight">{section.heading}</h2>
            {section.blocks.map((block, i) => (
              <Block key={i} block={block} />
            ))}
          </section>
        ))}
      </div>
    </article>
  );
}
