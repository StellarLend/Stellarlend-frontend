import React from "react";

interface ButtonProps {
  text: string;
  href?: string;
  textColor?: string;
  bgColor?: string;
  className?: string;
  onClick?: () => void;
}

const Button: React.FC<ButtonProps> = ({
  text,
  href,
  textColor = "white",
  bgColor = "blue-500",
  className = "",
  onClick,
}) => {
  const baseStyles = `px-4 py-2 rounded font-semibold transition duration-300`;
  const styles = `text-${textColor} bg-${bgColor} ${baseStyles} ${className}`;

  if (href) {
    return (
      <a href={href} className={styles}>
        {text}
      </a>
    );
  }

  return (
    <button className={styles} onClick={onClick}>
      {text}
    </button>
  );
};

export default Button;
