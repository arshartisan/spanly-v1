import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

// Primary green CTA → composer (doc 04).
export function CreatePostButton() {
  return (
    <Button asChild className="w-full justify-center gap-2">
      <Link href="/create/text">
        <Plus className="h-4 w-4" />
        Create post
      </Link>
    </Button>
  );
}
