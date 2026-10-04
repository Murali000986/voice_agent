import * as React from "react"
import { cn } from "@/lib/utils"

export const TooltipProvider = ({ children, delayDuration = 200 }: any) => {
  return <div className="tooltip-provider contents">{children}</div>
}

export const Tooltip = ({ children }: any) => {
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <div 
      className="relative flex items-center justify-center" 
      onMouseEnter={() => setIsOpen(true)} 
      onMouseLeave={() => setIsOpen(false)}
    >
      {React.Children.map(children, child => {
        if (React.isValidElement(child)) {
          return React.cloneElement(child as any, { isOpen });
        }
        return child;
      })}
    </div>
  )
}

export const TooltipTrigger = ({ children, asChild, isOpen, ...props }: any) => {
  const child = React.Children.only(children);
  return React.cloneElement(child, { ...props });
}

export const TooltipContent = ({
  children,
  side = 'top',
  className,
  isOpen,
}: {
  children: React.ReactNode
  side?: 'top' | 'right' | 'bottom' | 'left'
  className?: string
  isOpen?: boolean
}) => {
  if (!isOpen) return null

  const sideClasses = {
    top: 'bottom-full mb-2 left-1/2 -translate-x-1/2',
    right: 'left-full ml-2 top-1/2 -translate-y-1/2',
    bottom: 'top-full mt-2 left-1/2 -translate-x-1/2',
    left: 'right-full mr-2 top-1/2 -translate-y-1/2',
  }

  return (
    <div
      className={cn(
        'absolute z-50 overflow-hidden rounded-md bg-gray-900 px-3 py-1.5 text-xs text-gray-50 shadow-md whitespace-nowrap',
        sideClasses[side],
        className
      )}
    >
      {children}
    </div>
  )
}
