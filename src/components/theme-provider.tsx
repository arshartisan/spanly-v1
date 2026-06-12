"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";

// Client wrapper around next-themes (shadcn dark-mode pattern). Lives at the
// root layout so every route — app, auth, marketing — shares one theme context.
export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
