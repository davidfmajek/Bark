"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

function ButtonGroup({ className, orientation = "horizontal", ...props }) {
  return (
    <div
      role="group"
      data-slot="button-group"
      data-orientation={orientation}
      className={cn(
        "inline-flex shrink-0 items-center overflow-hidden",
        orientation === "horizontal"
          ? "flex-row [&>*:first-child]:rounded-l-lg [&>*:first-child]:rounded-r-none [&>*:last-child]:rounded-l-none [&>*:last-child]:rounded-r-lg [&>*:not(:first-child):not(:last-child)]:rounded-none"
          : "flex-col [&>*:first-child]:rounded-t-lg [&>*:first-child]:rounded-b-none [&>*:last-child]:rounded-t-none [&>*:last-child]:rounded-b-lg [&>*:not(:first-child):not(:last-child)]:rounded-none",
        className
      )}
      {...props}
    />
  );
}

function ButtonGroupSeparator({
  className,
  orientation = "vertical",
  ...props
}) {
  return (
    <div
      role="separator"
      data-slot="button-group-separator"
      aria-orientation={orientation}
      className={cn(
        "shrink-0 bg-border",
        orientation === "vertical"
          ? "w-px self-stretch"
          : "h-px w-full",
        className
      )}
      {...props}
    />
  );
}

function ButtonGroupText({ className, asChild = false, children, ...props }) {
  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children, {
      className: cn(
        "flex items-center px-2.5 text-sm text-muted-foreground",
        className,
        children.props?.className
      ),
      ...props,
    });
  }
  return (
    <span
      data-slot="button-group-text"
      className={cn(
        "flex items-center px-2.5 text-sm text-muted-foreground",
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}

export { ButtonGroup, ButtonGroupSeparator, ButtonGroupText };
