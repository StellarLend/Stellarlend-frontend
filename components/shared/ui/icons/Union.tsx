interface UnionProps {
  className?: string;
  width?: string | number;
  height?: string | number;
}

export const Union = ({
  className = "",
  width = "199",
  height = "84",
}: UnionProps) => {
  return (
    <svg
      className={className}
      width={width}
      height={height}
      viewBox="0 0 199 84"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        fill-rule="evenodd"
        clip-rule="evenodd"
        d="M147.553 17.7071L167.326 1.34351L166.456 0.292969L146.873 16.5001H80.9819H80.7032L80.5043 16.6953L43.8851 52.6364H7.19114L3.93648 49.3818L0 53.3182L3.93648 57.2547L7.19114 54.0001H93.0314L133.761 83.8681L133.941 84.0001H134.164H198.255V82.6364H134.387L93.6579 52.7684L93.4779 52.6364H93.2547H45.8318L81.2606 17.8637H147.118H147.364L147.553 17.7071Z"
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.2"
      />
    </svg>
  );
};
