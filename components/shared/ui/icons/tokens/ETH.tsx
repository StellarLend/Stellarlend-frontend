export default function ETH({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className ?? "w-6 h-6"} aria-label="ETH icon">
      <circle cx="16" cy="16" r="14" fill="#627EEA" />
      <text x="16" y="21" textAnchor="middle" fill="white" fontSize="11" fontWeight="bold">Ξ</text>
    </svg>
  );
}
