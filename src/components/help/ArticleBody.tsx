import type { HelpBlock } from "@/lib/help-content";

// Renders a help article's structured blocks. Pure/server — no markdown pipeline needed.
export function ArticleBody({ body }: { body: HelpBlock[] }) {
  return (
    <div className="flex flex-col gap-4">
      {body.map((block, i) => {
        switch (block.type) {
          case "h":
            return (
              <h2 key={i} className="mt-2 text-base font-semibold">
                {block.text}
              </h2>
            );
          case "p":
            return (
              <p key={i} className="text-sm leading-relaxed text-muted-foreground">
                {block.text}
              </p>
            );
          case "ul":
            return (
              <ul key={i} className="ml-5 list-disc space-y-1 text-sm text-muted-foreground">
                {block.items.map((it, j) => (
                  <li key={j}>{it}</li>
                ))}
              </ul>
            );
          case "ol":
            return (
              <ol key={i} className="ml-5 list-decimal space-y-1 text-sm text-muted-foreground">
                {block.items.map((it, j) => (
                  <li key={j}>{it}</li>
                ))}
              </ol>
            );
          case "code":
            return (
              <pre key={i} className="overflow-x-auto rounded-lg border bg-muted/50 p-3 font-mono text-xs">
                {block.text}
              </pre>
            );
          default:
            return null;
        }
      })}
    </div>
  );
}
