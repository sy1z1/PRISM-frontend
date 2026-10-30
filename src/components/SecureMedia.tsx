import { useEffect, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { fetchMediaBlobUrl } from '../services/api';

export const useSecureMedia = (path?: string | null) => {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let created: string | null = null;

    setUrl(null);
    setError(false);

    if (!path) return;

    fetchMediaBlobUrl(path)
      .then((result) => {
        if (cancelled) {
          if (result?.startsWith('blob:')) URL.revokeObjectURL(result);
          return;
        }
        if (result?.startsWith('blob:')) created = result;
        setUrl(result);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });

    return () => {
      cancelled = true;
      if (created?.startsWith('blob:')) URL.revokeObjectURL(created);
    };
  }, [path]);

  return { url, error };
};

interface SecureMediaProps {
  path?: string | null;
  alt: string;
  style?: CSSProperties;
  className?: string;
  fallback?: ReactNode;
}

export function SecureMedia({ path, alt, style, className, fallback = null }: SecureMediaProps) {
  const { url, error } = useSecureMedia(path);

  if (!path) return <>{fallback}</>;
  if (error) {
    return (
      <div
        style={style}
        className={className}
        role="img"
        aria-label={`${alt} (unavailable)`}
      />
    );
  }
  if (!url) return <div style={style} className={className} aria-busy="true" />;

  return <img src={url} alt={alt} style={style} className={className} />;
}

const linkReset: CSSProperties = {
  border: 'none',
  background: 'transparent',
  padding: 0,
  margin: 0,
  cursor: 'pointer',
  textAlign: 'left',
  color: 'inherit',
  font: 'inherit'
};

interface SecureMediaLinkProps {
  path?: string | null;
  children: ReactNode;
  style?: CSSProperties;
  className?: string;
  title?: string;
}

export function SecureMediaLink({ path, children, style, className, title }: SecureMediaLinkProps) {
  const [busy, setBusy] = useState(false);

  const open = async () => {
    if (!path || busy) return;
    setBusy(true);
    try {
      const url = await fetchMediaBlobUrl(path);
      if (url) {
        window.open(url, '_blank', 'noopener,noreferrer');
        if (url.startsWith('blob:')) {
          setTimeout(() => URL.revokeObjectURL(url), 60_000);
        }
      }
    } catch {
      // The image itself renders an unavailable placeholder.
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={() => void open()}
      style={{ ...linkReset, ...style }}
      className={className}
      title={title}
      disabled={busy}
    >
      {children}
    </button>
  );
}
