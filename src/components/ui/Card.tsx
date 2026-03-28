import React from "react";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  padded?: boolean;
  hover?: boolean;
}

export default function Card({ children, padded = true, hover = false, className = "", ...rest }: CardProps) {
  return (
    <div
      {...rest}
      className={`glass ${padded ? "p-5" : ""} ${hover ? "cursor-pointer transition-all hover:border-[#363b60] hover:shadow-[0_6px_30px_rgba(0,0,0,0.5)]" : ""} ${className}`}
    >
      {children}
    </div>
  );
}
