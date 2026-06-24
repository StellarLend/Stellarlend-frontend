export default function XLM({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className ?? "w-6 h-6"} aria-label="XLM icon">
      <circle cx="16" cy="16" r="14" fill="#14B6E7" />
      <text x="16" y="21" textAnchor="middle" fill="white" fontSize="12" fontWeight="bold">X</text>
    </svg>
  );
}
