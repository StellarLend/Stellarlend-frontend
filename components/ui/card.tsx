import React from "react";
import { cn } from "./utils";

export interface CardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  title?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, title, description, actions, children, ...props }, ref) => {
    const hasHeader = Boolean(title || description || actions);

    return (
      <div
        ref={ref}
        className={cn("card", className)}
        {...props}
      >
        {hasHeader && (
          <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
            <div>
              {title && (
                typeof title === "string" ? (
                  <h3 className="text-xl font-semibold">{title}</h3>
                ) : (
                  title
                )
              )}
              {description && (
                <p className="mut mt-1 text-sm">{description}</p>
              )}
            </div>
            {actions && <div>{actions}</div>}
          </div>
        )}
        {children}
      </div>
    );
  }
);

Card.displayName = "Card";

export function CardHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mb-4 flex flex-col space-y-1.5", className)} {...props} />;
}

export function CardTitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn("text-xl font-semibold leading-none tracking-tight", className)} {...props} />;
}

export function CardDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("mut text-sm", className)} {...props} />;
}

export function CardContent({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("", className)} {...props} />;
}

export function CardFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mt-4 flex items-center pt-2", className)} {...props} />;
}
