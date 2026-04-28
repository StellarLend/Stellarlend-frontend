// types/common.ts
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
// export type Required<T, K extends keyof T> = T & Required<Pick<T, K>>;

export interface ButtonProps {
  variant: string;
  size: string;
}

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

// Usage
export type PartialButtonProps = Optional<ButtonProps, "variant" | "size">;
