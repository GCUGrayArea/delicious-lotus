import React from 'react';
import styles from './Card.module.css';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'bordered' | 'elevated';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  hoverable?: boolean;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  (
    {
      variant = 'default',
      padding = 'md',
      hoverable = false,
      className = '',
      children,
      ...props
    },
    ref
  ) => {
    const cardClasses = [
      styles.card,
      styles[`card-${variant}`],
      styles[`padding-${padding}`],
      hoverable && styles.hoverable,
      className,
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <div ref={ref} className={cardClasses} {...props}>
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';

export interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export const CardHeader = React.forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ title, subtitle, actions, className = '', children, ...props }, ref) => {
    const headerClasses = [styles.cardHeader, className].filter(Boolean).join(' ');

    return (
      <div ref={ref} className={headerClasses} {...props}>
        <div className={styles.cardHeaderContent}>
          {title && <h3 className={styles.cardTitle}>{title}</h3>}
          {subtitle && <p className={styles.cardSubtitle}>{subtitle}</p>}
          {children}
        </div>
        {actions && <div className={styles.cardActions}>{actions}</div>}
      </div>
    );
  }
);

CardHeader.displayName = 'CardHeader';

export type CardBodyProps = React.HTMLAttributes<HTMLDivElement>

export const CardBody = React.forwardRef<HTMLDivElement, CardBodyProps>(
  ({ className = '', children, ...props }, ref) => {
    const bodyClasses = [styles.cardBody, className].filter(Boolean).join(' ');

    return (
      <div ref={ref} className={bodyClasses} {...props}>
        {children}
      </div>
    );
  }
);

CardBody.displayName = 'CardBody';

export type CardFooterProps = React.HTMLAttributes<HTMLDivElement>

export const CardFooter = React.forwardRef<HTMLDivElement, CardFooterProps>(
  ({ className = '', children, ...props }, ref) => {
    const footerClasses = [styles.cardFooter, className].filter(Boolean).join(' ');

    return (
      <div ref={ref} className={footerClasses} {...props}>
        {children}
      </div>
    );
  }
);

CardFooter.displayName = 'CardFooter';
