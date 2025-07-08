interface ReceiptFillProps {
  className?: string;
  width?: string | number;
  height?: string | number;
  color?: string;
}

export const ReceiptFill = ({ 
  className = "", 
  width = "24",
  height = "24",
  color,
}: ReceiptFillProps) => {
  return (
    <svg className={className} width={width} height={height} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
<g clipPath="url(#clip0_4_195)">
<path d="M9 4L6 2L3 4V16V19C3 20.6569 4.34315 22 6 22H20C21.6569 22 23 20.6569 23 19V17H7V19C7 19.5523 6.55228 20 6 20C5.44772 20 5 19.5523 5 19V15H21V4L18 2L15 4L12 2L9 4Z" fill={color}/>
<path d="M9 4L6 2L3 4V16V19C3 20.6569 4.34315 22 6 22H20C21.6569 22 23 20.6569 23 19V17H7V19C7 19.5523 6.55228 20 6 20C5.44772 20 5 19.5523 5 19V15H21V4L18 2L15 4L12 2L9 4Z" fill={color}/>
<path d="M9 4L6 2L3 4V16V19C3 20.6569 4.34315 22 6 22H20C21.6569 22 23 20.6569 23 19V17H7V19C7 19.5523 6.55228 20 6 20C5.44772 20 5 19.5523 5 19V15H21V4L18 2L15 4L12 2L9 4Z" fill={color}/>
</g>
<defs>
<clipPath id="clip0_4_195">
<rect width="24" height="24" fill="none"/>
</clipPath>
</defs>
</svg>
  );
};