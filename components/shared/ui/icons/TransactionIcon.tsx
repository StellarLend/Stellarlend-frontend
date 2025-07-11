import React from 'react'
interface TransactionIconProps {
  className?: string;
  width?: string | number;
  height?: string | number;
  color?: string;
}
export const TransactionIcon = ({
  className = "",
  width = "24",
  height = "24",
  color,
}: TransactionIconProps) => {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M15.8333 8.75V8.33329C15.8333 5.19063 15.8332 3.61926 14.857 2.64295C13.8806 1.66667 12.3093 1.66667 9.16662 1.66667C6.02403 1.66667 4.45267 1.66672 3.47636 2.64299C2.50008 3.61929 2.50006 5.1906 2.50003 8.33323L2.5 12.0833C2.49998 14.8228 2.49997 16.1927 3.25657 17.1146C3.3951 17.2834 3.54988 17.4382 3.71869 17.5768C4.64064 18.3333 6.01041 18.3333 8.74995 18.3333"
        stroke="#E5E5E5"
        stroke-width="1.25"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <path
        d="M5.83331 5.83333H12.5M5.83331 9.16667H9.16665"
        stroke="#E5E5E5"
        stroke-width="1.25"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <path
        d="M15 15.4167L13.75 14.9583V12.9167M10 14.5833C10 16.6544 11.6789 18.3333 13.75 18.3333C15.8211 18.3333 17.5 16.6544 17.5 14.5833C17.5 12.5122 15.8211 10.8333 13.75 10.8333C11.6789 10.8333 10 12.5122 10 14.5833Z"
        stroke="#E5E5E5"
        stroke-width="1.25"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  );
};
