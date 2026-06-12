"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InstagramMethodModal } from "./InstagramMethodModal";
import type { PlatformKey } from "@/lib/platforms";

/**
 * "Connect [Platform]" button (docs/implementation/05). Full-page redirect into the OAuth
 * start route. Instagram first opens the method-choice modal. Server-side limit gating still
 * applies even if `disabled` is bypassed.
 */
export function ConnectButton({
  platform,
  label,
  hasMethodChoice,
  disabled,
}: {
  platform: PlatformKey;
  label: string;
  hasMethodChoice?: boolean;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);

  const onClick = () => {
    if (hasMethodChoice) {
      setOpen(true);
      return;
    }
    window.location.href = `/api/connect/${platform}/start`;
  };

  return (
    <>
      <Button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className="bg-neutral-900 text-white hover:bg-neutral-800"
        size="sm"
      >
        <Plus className="h-4 w-4" />
        Connect {label}
      </Button>
      {hasMethodChoice && <InstagramMethodModal open={open} onClose={() => setOpen(false)} />}
    </>
  );
}
