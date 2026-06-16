"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker, getDefaultClassNames } from "react-day-picker";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

/**
 * Themed wrapper around react-day-picker (v10 API: snake_case class keys + getDefaultClassNames
 * + a single Chevron component). Selected day uses the orange primary; today gets the accent
 * tint. Rendered inside a glass Popover by the schedule picker.
 */
function Calendar({ className, classNames, showOutsideDays = true, ...props }: CalendarProps) {
  const d = getDefaultClassNames();

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-1", className)}
      classNames={{
        months: cn("relative flex flex-col gap-4", d.months),
        month: cn("flex w-full flex-col gap-3", d.month),
        month_caption: cn("flex h-8 items-center justify-center px-8", d.month_caption),
        caption_label: cn("text-sm font-medium", d.caption_label),
        nav: cn("absolute inset-x-0 top-0 flex items-center justify-between", d.nav),
        button_previous: cn(
          buttonVariants({ variant: "ghost", size: "icon" }),
          "h-7 w-7 p-0 opacity-70 hover:opacity-100",
          d.button_previous,
        ),
        button_next: cn(
          buttonVariants({ variant: "ghost", size: "icon" }),
          "h-7 w-7 p-0 opacity-70 hover:opacity-100",
          d.button_next,
        ),
        month_grid: cn("w-full border-collapse", d.month_grid),
        weekdays: cn("flex", d.weekdays),
        weekday: cn("w-9 flex-1 text-[0.72rem] font-normal text-muted-foreground", d.weekday),
        week: cn("mt-1 flex w-full", d.week),
        day: cn("relative h-9 w-9 flex-1 p-0 text-center text-sm", d.day),
        day_button: cn(
          buttonVariants({ variant: "ghost" }),
          "h-9 w-9 rounded-lg p-0 font-normal transition-colors aria-selected:opacity-100",
          d.day_button,
        ),
        today: cn("rounded-lg bg-accent font-medium text-accent-foreground", d.today),
        selected: cn(
          "[&>button]:bg-primary [&>button]:text-primary-foreground [&>button]:hover:bg-primary [&>button]:hover:text-primary-foreground",
          d.selected,
        ),
        outside: cn("text-muted-foreground/50", d.outside),
        disabled: cn("text-muted-foreground/40 opacity-60", d.disabled),
        hidden: cn("invisible", d.hidden),
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation, className: chevClassName }) => {
          const Icon = orientation === "left" ? ChevronLeft : ChevronRight;
          return <Icon className={cn("h-4 w-4", chevClassName)} />;
        },
      }}
      {...props}
    />
  );
}
Calendar.displayName = "Calendar";

export { Calendar };
