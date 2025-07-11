interface FileProps {
  className?: string;
  width?: string | number;
  height?: string | number;
}

export const File = ({
  className = "",
  width = "41",
  height = "40",
}: FileProps) => {
  return (
    <svg
      className={className}
      width={width}
      height={height}
      viewBox="0 0 41 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M13.6665 11.6667H26.9998"
        stroke="currentColor"
        stroke-width="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M13.6665 18.3333H20.3332"
        stroke="currentColor"
        stroke-width="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M21.9995 35.8333V34.9999C21.9995 30.2859 21.9995 27.9289 23.464 26.4644C24.9285 24.9999 27.2855 24.9999 31.9995 24.9999H32.8328M33.6662 22.2384V16.6666C33.6662 10.3812 33.6662 7.2385 31.7135 5.28587C29.761 3.33325 26.6182 3.33325 20.3328 3.33325C14.0475 3.33325 10.9048 3.33325 8.95213 5.28587C6.99951 7.23849 6.99951 10.3812 6.99951 16.6666V24.2403C6.99951 29.6486 6.99951 32.3528 8.47629 34.1844C8.77464 34.5544 9.11169 34.8914 9.48173 35.1897C11.3134 36.6666 14.0175 36.6666 19.4258 36.6666C20.6018 36.6666 21.1897 36.6666 21.7282 36.4766C21.8402 36.4371 21.9498 36.3916 22.057 36.3404C22.5722 36.0939 22.9878 35.6783 23.8193 34.8468L31.7135 26.9526C32.677 25.9891 33.1587 25.5074 33.4125 24.8948C33.6662 24.2823 33.6662 23.6009 33.6662 22.2384Z"
        stroke="currentColor"
        stroke-width="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};
