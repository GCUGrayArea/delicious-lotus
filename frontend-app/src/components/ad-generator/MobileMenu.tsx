import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { Navigation } from './Navigation';
import styles from './MobileMenu.module.css';

/**
 * MobileMenu Component
 *
 * Mobile hamburger menu button with slide-in drawer navigation.
 * Automatically closes when route changes and prevents body scroll when open.
 */
export function MobileMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();
  const prevPathnameRef = useRef(location.pathname);

  // Close menu on route change
  useEffect(() => {
    if (prevPathnameRef.current !== location.pathname) {
      prevPathnameRef.current = location.pathname;
      if (isOpen) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setIsOpen(false);
      }
    }
  }, [location.pathname, isOpen]);

  // Prevent body scroll when menu is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Handle escape key to close menu
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  return (
    <>
      {/* Hamburger Button */}
      <button
        className={styles.menuButton}
        onClick={() => setIsOpen(true)}
        aria-label="Open menu"
        aria-expanded={isOpen}
        aria-controls="mobile-menu-drawer"
      >
        <svg
          className={styles.menuIcon}
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 6h16M4 12h16M4 18h16"
          />
        </svg>
      </button>

      {/* Backdrop and Drawer */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className={styles.backdrop}
            onClick={() => setIsOpen(false)}
            role="presentation"
            aria-hidden="true"
          />

          {/* Drawer */}
          <div
            id="mobile-menu-drawer"
            className={styles.drawer}
            role="dialog"
            aria-modal="true"
            aria-label="Mobile navigation menu"
          >
            {/* Close Button */}
            <div className={styles.drawerHeader}>
              <h2 className={styles.drawerTitle}>Menu</h2>
              <button
                className={styles.closeButton}
                onClick={() => setIsOpen(false)}
                aria-label="Close menu"
              >
                <svg
                  className={styles.closeIcon}
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            {/* Navigation */}
            <div className={styles.drawerContent}>
              <Navigation isMobile onClose={() => setIsOpen(false)} />
            </div>
          </div>
        </>
      )}
    </>
  );
}
