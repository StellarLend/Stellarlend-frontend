// src/components/ui/Button/Button.tsx
interface ButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary";
}

export default function Button({
  children,
  onClick,
  variant = "primary",
}: ButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-md ${
        variant === "primary"
          ? "bg-blue-500 text-white"
          : "bg-gray-200 text-black"
      }`}
    >
      {children}
    </button>
  );
}
