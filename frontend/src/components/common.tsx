import React from 'react';
import ReactDOM from 'react-dom';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

export const Card: React.FC<CardProps> = ({ children, className = '', onClick }) => (
  <div
    onClick={onClick}
    className={`card cursor-pointer hover:shadow-lg transition-shadow ${className}`}
  >
    {children}
  </div>
);

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  className = '',
  ...props
}) => {
  const variants = {
    primary: 'btn-primary',
    secondary: 'btn-secondary',
    danger: 'px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors'
  };

  const sizes = {
    sm: 'px-2 py-1 text-sm',
    md: 'px-4 py-2',
    lg: 'px-6 py-3 text-lg'
  };

  const clickFeedback = 'transform-gpu transition duration-150 ease-out active:scale-95 active:translate-y-0.5 active:shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2';

  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={`${variants[variant]} ${sizes[size]} ${clickFeedback} ${className} disabled:opacity-50 disabled:cursor-not-allowed`}
    >
      {loading ? '...' : children}
    </button>
  );
};

interface BadgeProps {
  children: React.ReactNode;
  color: string;
}

export const Badge: React.FC<BadgeProps> = ({ children, color }) => (
  <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${color}`}>
    {children}
  </span>
);

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
}

export const Spinner: React.FC<SpinnerProps> = ({ size = 'md' }) => {
  const sizes = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12'
  };

  return (
    <div className={`${sizes[size]} animate-spin`}>
      <svg className="w-full h-full text-primary-500" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
    </div>
  );
};

interface TabsProps {
  tabs: { label: string; content: React.ReactNode }[];
  defaultTab?: number;
}

export const Tabs: React.FC<TabsProps> = ({ tabs, defaultTab = 0 }) => {
  const [active, setActive] = React.useState(defaultTab);

  return (
    <div>
      <div className="flex border-b border-slate-200 dark:border-slate-700">
        {tabs.map((tab, idx) => (
          <button
            key={idx}
            onClick={() => setActive(idx)}
            className={`px-4 py-2 font-medium border-b-2 transition-colors transform-gpu duration-150 ease-out active:scale-95 active:translate-y-0.5 ${
              active === idx
                ? 'border-primary-500 text-primary-500'
                : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="mt-4">{tabs[active].content}</div>
    </div>
  );
};

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, footer }) => {
  if (!isOpen) return null;

  const modal = (
    <>
      <div
        className="fixed inset-0 bg-black bg-opacity-50 pointer-events-none"
        onClick={onClose}
        style={{ zIndex: 99999 }}
      />
      <div
        className="fixed left-1/2 transform -translate-x-1/2 pointer-events-none"
        style={{ top: 80, zIndex: 100000, maxWidth: '960px', width: '100%', padding: '0 16px' }}
      >
        <div className="pointer-events-auto bg-white rounded-lg shadow-xl flex flex-col" style={{ maxHeight: 'calc(100vh - 120px)' }}>
          <div className="p-5 border-b border-slate-200 shrink-0">
            <h2 className="text-xl font-bold">{title}</h2>
          </div>
          <div className="p-5 overflow-y-auto flex-1">{children}</div>
          {footer && <div className="flex gap-2 justify-end p-5 border-t border-slate-200 shrink-0">{footer}</div>}
        </div>
      </div>
    </>
  );

  return ReactDOM.createPortal(modal, document.body);
};
