interface LoginCircleFillProps {
  className?: string;
  width?: string | number;
  height?: string | number;
  color?: string;
}

export const LoginCircleFill = ({ 
  className = "", 
  width = "24",
  height = "24",
  color,
}: LoginCircleFillProps) => {
  return (
    <svg className={className} width={width} height={height} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
<g clipPath="url(#clip0_4_167)">
<path d="M9.99945 11H2.04883C2.55055 5.94668 6.8141 2 11.9995 2C17.5223 2 21.9995 6.47715 21.9995 12C21.9995 17.5228 17.5223 22 11.9995 22C6.8141 22 2.55055 18.0533 2.04883 13H9.99945V16L14.9995 12L9.99945 8V11Z" fill={color}/>
<path d="M16.0503 12.0498L21 16.9996L16.0503 21.9493L14.636 20.5351L17.172 17.9988L4 17.9996V15.9996L17.172 15.9988L14.636 13.464L16.0503 12.0498ZM7.94975 2.0498L9.36396 3.46402L6.828 5.9988L20 5.99955V7.99955L6.828 7.9988L9.36396 10.5351L7.94975 11.9493L3 6.99955L7.94975 2.0498Z" fill={color}/>
<path d="M16.0503 12.0498L21 16.9996L16.0503 21.9493L14.636 20.5351L17.172 17.9988L4 17.9996V15.9996L17.172 15.9988L14.636 13.464L16.0503 12.0498ZM7.94975 2.0498L9.36396 3.46402L6.828 5.9988L20 5.99955V7.99955L6.828 7.9988L9.36396 10.5351L7.94975 11.9493L3 6.99955L7.94975 2.0498Z" fill={color}/>
</g>
<defs>
<clipPath id="clip0_4_167">
<rect width="24" height="24" fill={color}/>
</clipPath>
</defs>
</svg>
  );
};