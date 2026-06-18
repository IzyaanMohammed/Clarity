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
      className={`bg-[#FCFAF8]/95 backdrop-blur-sm rounded-3xl  border-3 border-[#2C241B] shadow-neo/80 ${hover ? 'hover:-transtone-y-0.5 hover: transition-all duration-200 cursor-pointer' : ''
        } ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  );
};
