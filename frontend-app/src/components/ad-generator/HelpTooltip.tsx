import React, { useState, useRef, useEffect } from 'react';
import styles from './HelpTooltip.module.css';
import type { HelpContent } from '../data/helpContent';
import { getHelpById } from '../data/helpContent';

export interface HelpTooltipProps {
  /**
   * Help content ID to display
   */
  helpId?: string;
  /**
   * Custom help content (overrides helpId)
   */
  content?: HelpContent;
  /**
   * Tooltip position relative to icon
   */
  position?: 'top' | 'bottom' | 'left' | 'right';
  /**
   * Trigger method
   */
  trigger?: 'hover' | 'click' | 'both';
  /**
   * Custom icon (defaults to question mark)
   */
  icon?: React.ReactNode;
  /**
   * Additional CSS classes
   */
  className?: string;
  /**
   * ARIA label for accessibility
   */
  ariaLabel?: string;
}

export const HelpTooltip: React.FC<HelpTooltipProps> = ({
  helpId,
  content: customContent,
  position = 'top',
  trigger = 'both',
  icon,
  className = '',
  ariaLabel = 'Help information',
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState(position);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Get help content from ID or use custom content
  const helpContent = customContent || (helpId ? getHelpById(helpId) : null);

  // Handle click outside to close tooltip
  useEffect(() => {
    if (!isVisible) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        tooltipRef.current &&
        triggerRef.current &&
        !tooltipRef.current.contains(event.target as Node) &&
        !triggerRef.current.contains(event.target as Node)
      ) {
        setIsVisible(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isVisible]);

  // Adjust tooltip position to stay within viewport using layout effect for synchronous update
  useEffect(() => {
    if (!isVisible || !tooltipRef.current) return;

    const tooltip = tooltipRef.current;
    const rect = tooltip.getBoundingClientRect();
    const viewport = {
      width: window.innerWidth,
      height: window.innerHeight,
    };

    let newPosition = position;

    // Check if tooltip goes off screen and adjust position
    if (position === 'top' && rect.top < 0) {
      newPosition = 'bottom';
    } else if (position === 'bottom' && rect.bottom > viewport.height) {
      newPosition = 'top';
    } else if (position === 'left' && rect.left < 0) {
      newPosition = 'right';
    } else if (position === 'right' && rect.right > viewport.width) {
      newPosition = 'left';
    }

    // Only update if position actually changed to avoid cascading renders
    if (newPosition !== tooltipPosition) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTooltipPosition(newPosition);
    }
  }, [isVisible, position, tooltipPosition]);

  const handleMouseEnter = () => {
    if (trigger === 'hover' || trigger === 'both') {
      setIsVisible(true);
    }
  };

  const handleMouseLeave = () => {
    if (trigger === 'hover' || trigger === 'both') {
      setIsVisible(false);
    }
  };

  const handleClick = () => {
    if (trigger === 'click' || trigger === 'both') {
      setIsVisible(!isVisible);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    } else if (e.key === 'Escape' && isVisible) {
      setIsVisible(false);
    }
  };

  if (!helpContent) {
    console.warn(
      `HelpTooltip: No content found for helpId "${helpId}". Provide either helpId or content prop.`
    );
    return null;
  }

  const containerClasses = [styles.helpTooltip, className].filter(Boolean).join(' ');

  const tooltipClasses = [
    styles.tooltip,
    styles[`tooltip-${tooltipPosition}`],
    isVisible && styles.visible,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={containerClasses}>
      <button
        ref={triggerRef}
        type="button"
        className={styles.trigger}
        onClick={handleClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onKeyDown={handleKeyDown}
        aria-label={ariaLabel}
        aria-expanded={isVisible}
        aria-describedby={isVisible ? `tooltip-${helpId || 'custom'}` : undefined}
      >
        {icon || (
          <svg
            className={styles.icon}
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        )}
      </button>

      <div
        ref={tooltipRef}
        id={`tooltip-${helpId || 'custom'}`}
        className={tooltipClasses}
        role="tooltip"
        aria-hidden={!isVisible}
      >
        <div className={styles.tooltipContent}>
          <h4 className={styles.tooltipTitle}>{helpContent.title}</h4>
          <p className={styles.tooltipText}>{helpContent.content}</p>
          {helpContent.links && helpContent.links.length > 0 && (
            <div className={styles.tooltipLinks}>
              {helpContent.links.map((link, index) => (
                <a
                  key={index}
                  href={link.url}
                  className={styles.tooltipLink}
                  onClick={() => {
                    // Handle internal links with router if needed
                    // For now, just let default behavior happen
                  }}
                >
                  {link.text}
                  <svg
                    className={styles.linkIcon}
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                    <polyline points="15 3 21 3 21 9" />
                    <line x1="10" y1="14" x2="21" y2="3" />
                  </svg>
                </a>
              ))}
            </div>
          )}
        </div>
        <div className={styles.tooltipArrow} />
      </div>
    </div>
  );
};

export default HelpTooltip;
