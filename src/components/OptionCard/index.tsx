'use client';

import React from 'react';
import styles from './OptionCard.module.css';

interface OptionCardProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  selected?: boolean;
  compact?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  children?: React.ReactNode;
}

export default function OptionCard({
  title,
  subtitle,
  selected = false,
  compact = false,
  disabled = false,
  onClick,
  children,
}: OptionCardProps) {
  const classes = [
    styles.card,
    selected ? styles['card--selected'] : '',
    compact ? styles['card--compact'] : '',
    disabled ? styles['card--disabled'] : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={classes}
      onClick={disabled ? undefined : onClick}
      onKeyDown={(event) => {
        if (disabled || !onClick || (event.key !== 'Enter' && event.key !== ' ')) return;
        event.preventDefault();
        onClick();
      }}
      role="button"
      aria-pressed={selected}
      aria-disabled={disabled}
      tabIndex={disabled ? -1 : 0}
    >
      <div className={styles.card__title}>{title}</div>
      {subtitle && <div className={styles.card__subtitle}>{subtitle}</div>}
      {children}
    </div>
  );
}
