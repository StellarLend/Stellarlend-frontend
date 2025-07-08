interface DollarProps {
  className?: string;
  width?: string | number;
  height?: string | number;
}

export const Dollar = ({ 
  className = "", 
  width = "40",
  height = "40"
}: DollarProps) => {
  return (
    <svg className={className} width={width} height={height} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M30.6944 13.5802C30.6944 9.76194 25.9063 6.66663 19.9999 6.66663C14.0935 6.66663 9.30547 9.76194 9.30547 13.5802C9.30547 17.3985 12.2221 19.5061 19.9999 19.5061C27.7778 19.5061 31.6666 21.4815 31.6666 26.4198C31.6666 31.358 26.4433 33.3333 19.9999 33.3333C13.5566 33.3333 8.33325 30.238 8.33325 26.4198" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
<path d="M20 3.33337V36.6667" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
</svg>
  );
};