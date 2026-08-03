import React from 'react';
import Link from 'next/link';
import { ChevronRight, Home } from 'lucide-react';

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
}

export const Breadcrumbs = ({ items }: BreadcrumbsProps) => {
  return (
    <nav className="flex items-center space-x-2 text-xs font-bold uppercase tracking-widest text-white/70 mb-5">
      <Link 
        href="/dashboard" 
        className="hover:text-emerald-400 transition-colors flex items-center gap-1 group"
      >
        <Home className="w-3 h-3 group-hover:scale-110 transition-transform" />
      </Link>
      {items.map((item, index) => (
        <React.Fragment key={index}>
          <ChevronRight className="w-3 h-3 opacity-20" />
          {item.href ? (
            <Link 
              href={item.href} 
              className="hover:text-emerald-400 transition-colors"
            >
              {item.label}
            </Link>
          ) : (
            <span className="text-emerald-400 italic">{item.label}</span>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
};
