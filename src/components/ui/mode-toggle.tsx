"use client";

import * as React from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Light / dark / system switcher (shadcn dark-mode pattern).
export function ModeToggle() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon">
          <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <ThemeItems />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Reusable theme rows — also embedded inside other menus (e.g. AccountMenu).
export function ThemeItems() {
  const { setTheme, theme } = useTheme();
  const options = [
    { value: "light", label: "Light", icon: Sun },
    { value: "dark", label: "Dark", icon: Moon },
    { value: "system", label: "System", icon: Monitor },
  ] as const;

  return (
    <>
      {options.map(({ value, label, icon: Icon }) => (
        <DropdownMenuItem
          key={value}
          onSelect={() => setTheme(value)}
          className={theme === value ? "font-medium" : undefined}
        >
          <Icon className="h-4 w-4" />
          {label}
        </DropdownMenuItem>
      ))}
    </>
  );
}
