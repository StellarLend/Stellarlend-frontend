export default function BTC({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className ?? "w-6 h-6"} aria-label="BTC icon">
      <circle cx="16" cy="16" r="14" fill="#F7931A" />
      <text x="16" y="21" textAnchor="middle" fill="white" fontSize="12" fontWeight="bold">₿</text>
    </svg>
  );
}
