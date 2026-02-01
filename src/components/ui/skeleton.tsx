import { cn } from "./utils"

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  shimmer?: boolean;
}

function Skeleton({
  className,
  shimmer = false,
  ...props
}: SkeletonProps) {
  return (
    <div
      className={cn(
        "rounded-md bg-slate-700/50",
        shimmer ? "relative overflow-hidden" : "animate-pulse",
        className
      )}
      {...props}
    >
      {shimmer && (
        <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-slate-600/30 to-transparent animate-shimmer" />
      )}
    </div>
  )
}

export { Skeleton }
