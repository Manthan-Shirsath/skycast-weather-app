import { cn } from "../../lib/utils/styles"

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-surface-elevated", className)}
      {...props}
    />
  )
}

export { Skeleton }
