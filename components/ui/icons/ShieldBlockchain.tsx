interface ShieldBlockchainProps {
  className?: string;
  width?: string | number;
  height?: string | number;
}

export const ShieldBlockchain = ({ 
  className = "", 
  width = "41",
  height = "40"
}: ShieldBlockchainProps) => {
  return (
    <svg className={className} width={width} height={height} viewBox="0 0 41 40" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M35.333 18.6391V13.8006C35.333 11.0673 35.333 9.70065 34.6595 8.80898C33.986 7.91733 32.4632 7.48443 29.4175 6.61866C27.3367 6.02716 25.5023 5.31455 24.0368 4.66398C22.0387 3.777 21.0397 3.3335 20.333 3.3335C19.6263 3.3335 18.6273 3.777 16.6292 4.66398C15.1637 5.31455 13.3294 6.02716 11.2486 6.61866C8.20289 7.48443 6.68004 7.91733 6.00652 8.80898C5.33301 9.70065 5.33301 11.0673 5.33301 13.8006V18.6391C5.33301 28.0143 13.771 33.6393 17.9897 35.8658C19.0015 36.3998 19.5073 36.6668 20.333 36.6668C21.1587 36.6668 21.6645 36.3998 22.6763 35.8658C26.895 33.6393 35.333 28.0143 35.333 18.6391Z" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
<path d="M20.3332 26.6668C20.5658 26.6668 20.7822 26.5608 21.2147 26.3488L24.6918 24.6448C26.2305 23.8908 26.9998 23.5138 26.9998 22.9168V15.4169M20.3332 26.6668C20.1005 26.6668 19.8842 26.5608 19.4517 26.3488L15.9745 24.6448C14.4358 23.8908 13.6665 23.5138 13.6665 22.9168V15.4169M20.3332 26.6668V19.1668M26.9998 15.4169C26.9998 14.8199 26.2305 14.4428 24.6918 13.6888L21.2147 11.9849C20.7822 11.7729 20.5658 11.6669 20.3332 11.6669C20.1005 11.6669 19.8842 11.7729 19.4517 11.9849L15.9745 13.6888C14.4358 14.4428 13.6665 14.8199 13.6665 15.4169M26.9998 15.4169C26.9998 16.0139 26.2305 16.3909 24.6918 17.1448L21.2147 18.8488C20.7822 19.0608 20.5658 19.1668 20.3332 19.1668M13.6665 15.4169C13.6665 16.0139 14.4358 16.3909 15.9745 17.1448L19.4517 18.8488C19.8842 19.0608 20.1005 19.1668 20.3332 19.1668" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round"/>
</svg>
  );
};