import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Handle, Position } from "@xyflow/react";
import type { ComponentProps } from "react";
import { AnimatedBorder } from "@/components/ui/animated-border";

// start custom keeperhub code //
export type NodeProps = ComponentProps<typeof Card> & {
  handles: {
    target: boolean;
    source: boolean | { id: string }[];
  };
  status?: "idle" | "running" | "success" | "error";
};
// end keeperhub code //

// start custom keeperhub code //
export const Node = ({ handles, className, status, ...props }: NodeProps) => (
  <Card
    className={cn(
      "node-container relative size-full h-auto w-sm gap-0 rounded-md bg-card p-0 transition-all duration-200",
      status === "success" && "border-green-500 border-2",
      status === "error" && "border-red-500 border-2",
      className
    )}
    {...props}
  >
    {status === "running" && <AnimatedBorder />}
    {handles.target && <Handle position={Position.Left} type="target" />}
    {handles.source && (
      Array.isArray(handles.source) ? (
        // Multiple source handles for condition branching
        handles.source.map((handle, index) => {
          // Calculate vertical position based on array index
          const sourceHandles = handles.source as { id: string }[];
          const totalHandles = sourceHandles.length;
          const spacing = 100 / (totalHandles + 1);
          const topPercent = spacing * (index + 1);

          return (
            <Handle
              key={handle.id}
              id={handle.id}
              position={Position.Right}
              type="source"
              style={{ top: `${topPercent}%` }}
              className={cn(
                "!size-3",
                handle.id === "true" && "!bg-green-500",
                handle.id === "false" && "!bg-red-500"
              )}
            />
          );
        })
      ) : (
        // Single source handle (default behavior)
        <Handle position={Position.Right} type="source" />
      )
    )}
    {props.children}
  </Card>
);
// end keeperhub code //

export type NodeHeaderProps = ComponentProps<typeof CardHeader>;

export const NodeHeader = ({ className, ...props }: NodeHeaderProps) => (
  <CardHeader
    className={cn("gap-0.5 rounded-t-md border-b bg-secondary p-3!", className)}
    {...props}
  />
);

export type NodeTitleProps = ComponentProps<typeof CardTitle>;

export const NodeTitle = (props: NodeTitleProps) => <CardTitle {...props} />;

export type NodeDescriptionProps = ComponentProps<typeof CardDescription>;

export const NodeDescription = (props: NodeDescriptionProps) => (
  <CardDescription {...props} />
);

export type NodeActionProps = ComponentProps<typeof CardAction>;

export const NodeAction = (props: NodeActionProps) => <CardAction {...props} />;

export type NodeContentProps = ComponentProps<typeof CardContent>;

export const NodeContent = ({ className, ...props }: NodeContentProps) => (
  <CardContent className={cn("rounded-b-md bg-card p-3", className)} {...props} />
);

export type NodeFooterProps = ComponentProps<typeof CardFooter>;

export const NodeFooter = ({ className, ...props }: NodeFooterProps) => (
  <CardFooter
    className={cn("rounded-b-md border-t bg-secondary p-3!", className)}
    {...props}
  />
);
