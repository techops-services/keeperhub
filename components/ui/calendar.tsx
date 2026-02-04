"use client";

import * as React from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type CalendarProps = {
  className?: string;
  selected?: Date;
  onSelect?: (date: Date | undefined) => void;
  mode?: "single";
};

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"] as const;

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

type DayCell = {
  day: number;
  isCurrentMonth: boolean;
  date: Date;
};

function buildCalendarGrid(year: number, month: number): DayCell[] {
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);
  const daysInPrevMonth = getDaysInMonth(year, month - 1);
  const cells: DayCell[] = [];

  for (let i = firstDay - 1; i >= 0; i--) {
    const day = daysInPrevMonth - i;
    cells.push({ day, isCurrentMonth: false, date: new Date(year, month - 1, day) });
  }

  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({ day, isCurrentMonth: true, date: new Date(year, month, day) });
  }

  const remaining = 7 - (cells.length % 7);
  if (remaining < 7) {
    for (let day = 1; day <= remaining; day++) {
      cells.push({ day, isCurrentMonth: false, date: new Date(year, month + 1, day) });
    }
  }

  return cells;
}

function Calendar({ className, selected, onSelect }: CalendarProps) {
  const today = new Date();
  const [viewDate, setViewDate] = React.useState(
    () =>
      new Date(
        selected?.getFullYear() ?? today.getFullYear(),
        selected?.getMonth() ?? today.getMonth(),
        1
      )
  );

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const cells = buildCalendarGrid(year, month);

  const monthLabel = viewDate.toLocaleString("default", {
    month: "long",
    year: "numeric",
  });

  function goToPrevMonth(): void {
    setViewDate(new Date(year, month - 1, 1));
  }

  function goToNextMonth(): void {
    setViewDate(new Date(year, month + 1, 1));
  }

  function handleSelect(day: number): void {
    onSelect?.(new Date(year, month, day));
  }

  return (
    <div className={cn("bg-background p-3", className)} data-slot="calendar">
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          onClick={goToPrevMonth}
          type="button"
        >
          <ChevronLeftIcon className="size-4" />
        </Button>
        <span className="text-sm font-medium select-none">{monthLabel}</span>
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          onClick={goToNextMonth}
          type="button"
        >
          <ChevronRightIcon className="size-4" />
        </Button>
      </div>

      <div className="mt-3 grid grid-cols-7 text-center">
        {WEEKDAYS.map((wd) => (
          <div
            key={wd}
            className="text-muted-foreground py-1 text-xs font-medium select-none"
          >
            {wd}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 text-center">
        {cells.map((cell) => {
          const isSelected = selected ? isSameDay(cell.date, selected) : false;
          const isToday = isSameDay(cell.date, today);

          return (
            <button
              key={cell.date.toISOString()}
              type="button"
              onClick={() => {
                if (cell.isCurrentMonth) {
                  handleSelect(cell.day);
                }
              }}
              className={cn(
                "mx-auto inline-flex h-8 w-8 items-center justify-center rounded-md text-sm transition-colors",
                !cell.isCurrentMonth && "text-muted-foreground/40",
                cell.isCurrentMonth &&
                  !isSelected &&
                  "hover:bg-accent hover:text-accent-foreground",
                isToday && !isSelected && "bg-accent text-accent-foreground",
                isSelected &&
                  "bg-primary text-primary-foreground hover:bg-primary/90"
              )}
              disabled={!cell.isCurrentMonth}
            >
              {cell.day}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export { Calendar };
