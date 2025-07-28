// types/component-helpers.ts
export type ComponentWithChildren<T = {}> = T & {
  children: React.ReactNode;
};

export type ComponentWithClassName<T = {}> = T & {
  className?: string;
};
