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
      className={`bg-white dark:bg-[#1a1d26] rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 ${
        hover ? 'hover:shadow-md transition-shadow duration-200 cursor-pointer' : ''
      } ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  );
};
