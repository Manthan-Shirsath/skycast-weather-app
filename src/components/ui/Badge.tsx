import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-sky-primary focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-sky-primary text-white hover:bg-sky-primary/80",
        secondary:
          "border-transparent bg-sky-surface-elevated text-sky-text-primary hover:bg-sky-surface-elevated/80",
        ai: "border-transparent bg-sky-ai/10 text-sky-ai hover:bg-sky-ai/20",
        destructive:
          "border-transparent bg-red-100 text-red-700 hover:bg-red-100/80 dark:bg-red-900/30 dark:text-red-400",
        outline: "text-sky-text-primary border-sky-border",
        success: "border-transparent bg-green-100 text-green-700 hover:bg-green-100/80 dark:bg-green-900/30 dark:text-green-400",
        warning: "border-transparent bg-orange-100 text-orange-700 hover:bg-orange-100/80 dark:bg-orange-900/30 dark:text-orange-400",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
