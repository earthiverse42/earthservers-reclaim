import React from 'react';

export interface CardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
}

export const Card: React.FC<CardProps> = ({ children, className = '', hover = false }) => {
  const baseClasses = 'bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm';
  const hoverClasses = hover ? 'transition-all hover:border-earth-teal hover:shadow-lg hover:shadow-earth-teal/20' : '';

  return <div className={`${baseClasses} ${hoverClasses} ${className}`}>{children}</div>;
};
