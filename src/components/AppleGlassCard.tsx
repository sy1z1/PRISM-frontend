import type { ReactNode, CSSProperties } from 'react';

interface AppleGlassCardProps {
  children: ReactNode;
  style?: CSSProperties;
  className?: string;
  onClick?: () => void;
  maxWidth?: string;
}

export default function AppleGlassCard({
  children,
  style = {},
  className = '',
  onClick,
  maxWidth = '420px',
}: AppleGlassCardProps) {
  return (
    <div
      onClick={onClick}
      className={className}
      style={{
        ...styles.glassCard,
        maxWidth,
        ...style,
      }}
    >
      <div style={styles.content}>{children}</div>
    </div>
  );
}

const styles = {
  glassCard: {
    position: 'relative' as const,
    zIndex: 10,
    background: 'rgba(14, 21, 44, 0.12)',
    backdropFilter: 'blur(2px)',
    WebkitBackdropFilter: 'blur(6px)',
    border: '1px solid rgba(255, 255, 255, 0.07)',
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.3)',
    borderRadius: '12px',
    padding: 'clamp(16px, 3vw, 24px)',
    width: '100%',
    boxSizing: 'border-box' as const,
    overflow: 'hidden',
    transition: 'border-color 0.2s ease, background-color 0.2s ease',
  },
  content: {
    position: 'relative' as const,
    zIndex: 2,
    color: '#f8fafc',
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
};