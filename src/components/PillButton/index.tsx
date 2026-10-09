'use client';

import React from 'react';
import styles from './PillButton.module.css';

interface PillButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'outline' | 'dark' | 'danger';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}

export default function PillButton({
  variant = 'primary',
  size = 'md',
  disabled,
  className,
  children,
  ...props
}: PillButtonProps) {
  const classes = [
    styles.pill,
    styles[`pill--${variant}`],
    styles[`pill--${size}`],
    disabled ? styles['pill--disabled'] : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button className={classes} disabled={disabled} {...props}>
      {children}
    </button>
  );
}
