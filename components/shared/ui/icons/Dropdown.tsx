import type { SVGProps } from "react";
interface DropdownProps extends Omit<SVGProps<SVGSVGElement>, "color"> {
  className?: string;
  width?: string | number;
  height?: string | number;
  title?: string;
}

export const Dropdown = ({
  className = "",
  width = "10",
  height = "6",
  title,
  "aria-label": ariaLabel,
  role,
  ...svgProps
}: DropdownProps) => {
  return (
    <svg
      className={className}
      width={width}
      height={height}
      viewBox="0 0 10 6"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...svgProps}
      aria-hidden={title || ariaLabel ? undefined : true}
      role={role ?? (title || ariaLabel ? "img" : undefined)}
      aria-label={ariaLabel}
    >
      {title ? <title>{title}</title> : null}
      <path
        d="M5 6.0006L0.757324 1.758L2.17154 0.34375L5 3.1722L7.8284 0.34375L9.2426 1.758L5 6.0006Z"
        fill="#1C1A1A"
      />
    </svg>
  );
};
