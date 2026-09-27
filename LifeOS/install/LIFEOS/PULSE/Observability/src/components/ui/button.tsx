import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[10px] border bg-transparent mono text-[11px] font-normal uppercase tracking-[0.12em] transition-colors focus-visible:outline-none focus-visible:border-[color:var(--accent-blue)] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-3.5 [&_svg]:shrink-0 [&_svg]:stroke-[1.5] [&_svg]:text-ink-3",
  {
    variants: {
      variant: {
        default:
          "border-line-3 text-ink-1 hover:border-[color:var(--accent-blue)]",
        destructive:
          "border-line-3 text-ink-1 hover:border-[color:var(--accent-blue)]",
        outline:
          "border-line-2 text-ink-2 hover:border-[color:var(--accent-blue)] hover:text-ink-1",
        secondary:
          "border-line-2 text-ink-2 hover:border-line-3 hover:text-ink-1",
        ghost: "border-transparent text-ink-2 hover:text-ink-1",
        link: "border-transparent text-ink-2 underline-offset-4 hover:underline hover:text-ink-1",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 px-3 text-[10px]",
        lg: "h-10 px-8",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
