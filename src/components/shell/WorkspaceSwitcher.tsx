import { ChevronsUpDown } from "lucide-react";

// Single-workspace MVP (D-004): renders one static "Personal" workspace. The full
// multi-workspace switcher is deferred; this keeps the layout slot in place.
export function WorkspaceSwitcher() {
  return (
    <button
      type="button"
      disabled
      className="flex w-full items-center gap-2 rounded-md border border-border bg-background px-2.5 py-2 text-left text-sm disabled:opacity-100"
    >
      <div className="flex h-6 w-6 items-center justify-center rounded bg-primary text-xs font-bold text-primary-foreground">
        P
      </div>
      <div className="flex min-w-0 flex-1 flex-col leading-tight">
        <span className="truncate font-medium">Personal</span>
        <span className="truncate text-xs text-muted-foreground">Workspace</span>
      </div>
      <ChevronsUpDown className="h-4 w-4 text-muted-foreground" />
    </button>
  );
}
