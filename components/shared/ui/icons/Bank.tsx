import React from "react";

interface BankProps {
  className?: string;
  width?: string | number;
  height?: string | number;
  color?: string;
}

export const Bank = ({
  className = "",
  width = "24",
  height = "24",
  color,
}: BankProps) => {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M1.66669 7.1409C1.66669 6.14408 2.06867 5.53319 2.90055 5.07024L6.32491 3.16454C8.11927 2.16596 9.01644 1.66667 10 1.66667C10.9836 1.66667 11.8808 2.16596 13.6751 3.16454L17.0995 5.07024C17.9314 5.53319 18.3334 6.14409 18.3334 7.1409C18.3334 7.4112 18.3334 7.54635 18.3039 7.65745C18.1488 8.24121 17.6198 8.33334 17.1089 8.33334H2.89109C2.38025 8.33334 1.85129 8.2412 1.6962 7.65745C1.66669 7.54635 1.66669 7.4112 1.66669 7.1409Z"
        stroke="#E5E5E5"
        stroke-width="1.25"
      />
      <path
        d="M9.99652 5.83333H10.004"
        stroke="#E5E5E5"
        stroke-width="1.66667"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <path
        d="M3.33331 8.33333V15.4167M6.66665 8.33333V15.4167"
        stroke="#E5E5E5"
        stroke-width="1.25"
      />
      <path
        d="M13.3333 8.33333V15.4167M16.6666 8.33333V15.4167"
        stroke="#E5E5E5"
        stroke-width="1.25"
      />
      <path
        d="M15.8334 15.4167H4.16669C2.78598 15.4167 1.66669 16.5359 1.66669 17.9167C1.66669 18.1468 1.85324 18.3333 2.08335 18.3333H17.9167C18.1468 18.3333 18.3334 18.1468 18.3334 17.9167C18.3334 16.5359 17.2141 15.4167 15.8334 15.4167Z"
        stroke="#E5E5E5"
        stroke-width="1.25"
      />
    </svg>
  );
};
