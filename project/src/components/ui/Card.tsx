import { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  hover?: boolean;
}

export const Card = ({ children, className = '', onClick, hover = false }: CardProps) => {
  return (
    <div
      className={`bg-[#FCFAF8]/95 backdrop-blur-sm rounded-3xl shadow-[0_12px_40px_rgba(15,23,42,0.06)] border border-stone-200/80 ${hover ? 'hover:-transtone-y-0.5 hover:shadow-[0_18px_50px_rgba(15,23,42,0.12)] transition-all duration-200 cursor-pointer' : ''
        } ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  );
};
