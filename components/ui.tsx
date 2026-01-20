import React, { useEffect, useRef } from 'react';

// --- Badge ---
interface BadgeProps {
  role: 'admin' | 'premium' | 'buyer';
}

export const Badge: React.FC<BadgeProps> = ({ role }) => {
  const styles = {
    admin: 'bg-red-500/10 text-red-400 border-red-500/20',
    premium: 'bg-primary-500/10 text-primary-500 border-primary-500/20',
    buyer: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
  };

  const labels = {
    admin: 'Admin',
    premium: 'Premium',
    buyer: 'Buyer',
  };

  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${styles[role]}`}>
      {labels[role]}
    </span>
  );
};

// --- Status Badge ---
export const StatusBadge: React.FC<{ status: 'active' | 'suspended' }> = ({ status }) => {
  const styles = {
    active: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    suspended: 'text-gray-400 bg-gray-500/10 border-gray-500/20',
  };

  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium border flex items-center gap-1.5 w-fit ${styles[status]}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${status === 'active' ? 'bg-emerald-400' : 'bg-gray-400'}`}></span>
      <span className="capitalize">{status}</span>
    </span>
  );
};

// --- Button ---
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  isLoading?: boolean;
  fullWidth?: boolean;
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary', 
  isLoading, 
  fullWidth, 
  className = '', 
  ...props 
}) => {
  const baseStyles = "relative inline-flex items-center justify-center px-4 py-2 text-sm font-medium transition-all duration-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 disabled:opacity-50 disabled:cursor-not-allowed";
  
  const variants = {
    primary: "bg-primary-600 hover:bg-primary-500 text-white shadow-lg shadow-primary-500/20 focus:ring-primary-500 border border-transparent",
    secondary: "bg-dark-800 hover:bg-dark-700 text-gray-200 border border-gray-700 hover:border-gray-600 focus:ring-gray-500",
    danger: "bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-500/20 focus:ring-red-500 border border-transparent",
    ghost: "bg-transparent hover:bg-white/5 text-gray-400 hover:text-white border border-transparent",
  };

  const width = fullWidth ? 'w-full' : '';

  return (
    <button 
      className={`${baseStyles} ${variants[variant]} ${width} ${className}`}
      disabled={isLoading || props.disabled}
      {...props}
    >
      {isLoading ? (
        <svg className="w-5 h-5 animate-spin text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      ) : children}
    </button>
  );
};

// --- Input ---
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input: React.FC<InputProps> = ({ label, error, className = '', ...props }) => {
  return (
    <div className="space-y-1">
      {label && <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider">{label}</label>}
      <input
        className={`w-full px-4 py-2.5 bg-dark-800 border ${error ? 'border-red-500/50 focus:border-red-500' : 'border-gray-700 focus:border-primary-500'} rounded-lg text-gray-100 placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-primary-500 transition-colors ${className}`}
        {...props}
      />
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
};

// --- Card ---
export const Card: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => {
  return (
    <div className={`bg-dark-800/50 backdrop-blur-md border border-gray-800 rounded-xl overflow-hidden ${className}`}>
      {children}
    </div>
  );
};

// --- Modal ---
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children }) => {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        ref={overlayRef}
        className="absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />
      
      {/* Content */}
      <div className="relative bg-dark-900 border border-gray-800 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 bg-dark-800/50">
          <h3 className="text-lg font-bold text-white">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-6 max-h-[80vh] overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
};