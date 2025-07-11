import React from "react";

interface CoinIconProps {
  className?: string;
  width?: string | number;
  height?: string | number;
  color?: string;
}
export const CoinIcon = ({
  className,
  width = "24",
  height = "24",
  color,
}: CoinIconProps) => {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M12.9167 10.8333C15.9082 10.8333 18.3333 10.0871 18.3333 9.16667C18.3333 8.24619 15.9082 7.5 12.9167 7.5C9.92512 7.5 7.5 8.24619 7.5 9.16667C7.5 10.0871 9.92512 10.8333 12.9167 10.8333Z"
        stroke="#E5E5E5"
        strokeWidth="1.25"
      />
      <path
        d="M18.3333 12.9167C18.3333 13.8372 15.9082 14.5833 12.9167 14.5833C9.92508 14.5833 7.5 13.8372 7.5 12.9167"
        stroke="#E5E5E5"
        strokeWidth="1.25"
      />
      <path
        d="M18.3333 9.16666V16.5C18.3333 17.5125 15.9082 18.3333 12.9167 18.3333C9.92508 18.3333 7.5 17.5125 7.5 16.5V9.16666"
        stroke="#E5E5E5"
        strokeWidth="1.25"
      />
      <path
        d="M7.08335 5C10.0749 5 12.5 4.25381 12.5 3.33333C12.5 2.41286 10.0749 1.66666 7.08335 1.66666C4.09181 1.66666 1.66669 2.41286 1.66669 3.33333C1.66669 4.25381 4.09181 5 7.08335 5Z"
        stroke="#E5E5E5"
        strokeWidth="1.25"
      />
      <path
        d="M5.00002 9.16667C3.42351 8.97483 1.97495 8.47875 1.66669 7.5M5.00002 13.3333C3.42351 13.1415 1.97495 12.6454 1.66669 11.6667"
        stroke="#E5E5E5"
        strokeWidth="1.25"
        strokeLinecap="round"
      />
      <path
        d="M5.00002 17.5C3.42351 17.3082 1.97495 16.8121 1.66669 15.8333V3.33334"
        stroke="#E5E5E5"
        strokeWidth="1.25"
        strokeLinecap="round"
      />
      <path
        d="M12.5 5V3.33334"
        stroke="#E5E5E5"
        strokeWidth="1.25"
        strokeLinecap="round"
      />
    </svg>
  );
};
