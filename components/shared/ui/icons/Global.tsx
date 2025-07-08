interface GlobalProps {
  className?: string;
  width?: string | number;
  height?: string | number;
}

export const Global = ({ 
  className = "", 
  width = "40",
  height = "40"
}: GlobalProps) => {
  return (
    <svg className={className} width={width} height={height} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M36.6666 19.9999C36.6666 10.7952 29.2046 3.33325 19.9999 3.33325C10.7952 3.33325 3.33325 10.7952 3.33325 19.9999C3.33325 29.2046 10.7952 36.6666 19.9999 36.6666C29.2046 36.6666 36.6666 29.2046 36.6666 19.9999Z" stroke="currentColor" strokeWidth="2.5"/>
<path d="M33.3334 9.49823C31.7756 9.61052 29.7802 10.2137 28.3966 12.0045C25.8976 15.2393 23.3984 15.5092 21.7324 14.4309C19.2332 12.8136 21.3334 10.1939 18.4002 8.77017C16.4886 7.84228 16.2221 5.31734 17.2861 3.33325" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round"/>
<path d="M3.33325 18.3333C4.60409 19.4368 6.38402 20.4469 8.48115 20.4469C12.814 20.4469 13.6805 21.2748 13.6805 24.5863C13.6805 27.8978 13.6805 27.8978 14.5471 30.3813C15.1108 31.9968 15.3078 33.6123 14.1843 34.9999" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round"/>
<path d="M36.6666 22.4206C35.1881 21.5686 33.3333 21.2181 31.4556 22.5676C27.8628 25.1497 25.3856 23.0101 24.2698 25.1482C22.6274 28.2959 28.4928 29.2852 23.3333 36.6667" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round"/>
</svg>
  );
};