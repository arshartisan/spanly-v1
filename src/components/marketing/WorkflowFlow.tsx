import {
  FacebookIcon,
  InstagramIcon,
  LinkedinIcon,
  TiktokIcon,
  YoutubeIcon,
  XIcon,
  type BrandIcon,
} from "@/components/icons/brand-icons";

const ICONS: { name: string; Icon: BrandIcon }[] = [
  { name: "Facebook", Icon: FacebookIcon },
  { name: "Instagram", Icon: InstagramIcon },
  { name: "LinkedIn", Icon: LinkedinIcon },
  { name: "TikTok", Icon: TiktokIcon },
  { name: "YouTube", Icon: YoutubeIcon },
  { name: "X", Icon: XIcon },
];

function NodeLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-mono text-[0.6rem] uppercase tracking-[0.18em] text-[hsl(30_10%_60%)]">
      {children}
    </span>
  );
}

function Connector() {
  return <div className="mx-auto h-7 w-px bg-white/10" />;
}

/**
 * Static "one workflow" pipeline for the Capabilities panel: Compose -> Schedule -> Publish.
 */
export function WorkflowFlow() {
  return (
    <div className="mx-auto w-full max-w-[16rem]">
      {/* Compose */}
      <div className="border border-white/12 bg-white/[0.03] p-4">
        <div className="flex items-center justify-between">
          <NodeLabel>Compose</NodeLabel>
          <span className="h-2 w-2 rounded-full bg-[hsl(22_92%_52%)]" />
        </div>
        <div className="mt-3 space-y-1.5">
          {[1, 0.7, 0.85].map((w, i) => (
            <div
              key={i}
              className="h-1.5 rounded-full bg-white/15"
              style={{ width: `${w * 100}%` }}
            />
          ))}
        </div>
      </div>

      <Connector />

      {/* Schedule */}
      <div className="border border-white/12 bg-white/[0.03] p-4">
        <NodeLabel>Schedule &amp; queue</NodeLabel>
        <div className="mt-3 flex gap-1.5">
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-6 flex-1 border border-white/10"
              style={i === 2 ? { backgroundColor: "hsl(22 92% 52% / 0.65)" } : undefined}
            />
          ))}
        </div>
      </div>

      <Connector />

      {/* Publish */}
      <div className="border border-white/12 bg-white/[0.03] p-4">
        <NodeLabel>Publish everywhere</NodeLabel>
        <div className="mt-3 flex items-center justify-between text-[hsl(22_92%_52%)]">
          {ICONS.map(({ name, Icon }) => (
            <span key={name} aria-hidden>
              <Icon className="h-5 w-5" />
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
