// types/common.ts
type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
// type Required<T, K extends keyof T> = T & Required<Pick<T, K>>;

interface ButtonProps {
  variant: string;
  size: string;
}

type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

// Usage
type PartialButtonProps = Optional<ButtonProps, "variant" | "size">;
