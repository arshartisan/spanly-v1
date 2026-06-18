import {
  FacebookIcon,
  InstagramIcon,
  LinkedinIcon,
  TiktokIcon,
  YoutubeIcon,
  XIcon,
  type BrandIcon,
} from "@/components/icons/brand-icons";
import { cn } from "@/lib/utils";
import { MonoLabel } from "./MonoLabel";
import { SECTION_X } from "./styles";

const PLATFORMS: { name: string; Icon: BrandIcon }[] = [
  { name: "Facebook", Icon: FacebookIcon },
  { name: "Instagram", Icon: InstagramIcon },
  { name: "LinkedIn", Icon: LinkedinIcon },
  { name: "TikTok", Icon: TiktokIcon },
  { name: "YouTube", Icon: YoutubeIcon },
  { name: "X", Icon: XIcon },
];

// Thin bordered logo strip: "publish to" + the six supported platform marks.
export function PlatformStrip() {
  return (
    <section className={cn("border-y border-white/10 bg-[hsl(20_14%_5%)]", SECTION_X)}>
      <div className="mx-auto flex max-w-7xl flex-col items-center gap-6 py-10 md:flex-row md:justify-between">
        <MonoLabel className="text-[hsl(30_10%_55%)]">Publish to</MonoLabel>
        <ul className="flex flex-wrap items-center justify-center gap-x-10 gap-y-6">
          {PLATFORMS.map(({ name, Icon }) => (
            <li key={name} className="flex items-center gap-2 text-[hsl(30_10%_60%)]">
              <Icon className="h-6 w-6" />
              <span className="text-sm font-medium">{name}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
