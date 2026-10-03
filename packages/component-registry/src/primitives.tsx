import type { CSSProperties, ReactNode } from 'react'

export function Section({
  'data-awb-element': elementPath,
  children,
  style,
  background = 'default',
  id,
}: {
  'data-awb-element'?: string
  children: ReactNode
  style?: CSSProperties
  background?: 'default' | 'surface' | 'inverted'
  id?: string
}) {
  const backgrounds: Record<string, CSSProperties> = {
    default: { background: 'var(--awb-bg)', color: 'var(--awb-fg)' },
    surface: { background: 'color-mix(in srgb, var(--awb-primary) 8%, var(--awb-surface))', color: 'var(--awb-fg)' },
    inverted: { background: 'var(--awb-primary)', color: 'var(--awb-primary-fg)' },
  }

  return (
    <section
      data-awb-element={elementPath}
      id={id}
      style={{
        paddingTop: 'var(--awb-section-space)',
        paddingBottom: 'var(--awb-section-space)',
        fontFamily: 'var(--awb-body-font)',
        fontSize: 'var(--awb-base-size)',
        ...backgrounds[background],
        ...style,
      }}
    >
      {children}
    </section>
  )
}

export function Container({ children, style, 'data-awb-element': elementPath }: { children: ReactNode; style?: CSSProperties; 'data-awb-element'?: string }) {
  return (
    <div
      data-awb-element={elementPath}
      style={{
        maxWidth: 'var(--awb-max-width)',
        margin: '0 auto',
        paddingLeft: '1.5rem',
        paddingRight: '1.5rem',
        ...style,
      }}
    >
      {children}
    </div>
  )
}

export function Heading({
  'data-awb-rich-text': richText,
  'data-awb-element': elementPath,
  level,
  children,
  style,
}: {
  'data-awb-element'?: string
  'data-awb-rich-text'?: string
  level: 1 | 2 | 3
  children: ReactNode
  style?: CSSProperties
}) {
  const Tag = `h${level}` as 'h1' | 'h2' | 'h3'
  const sizes = {
    1: 'clamp(2.6rem, 6vw, 5.5rem)',
    2: 'clamp(1.8rem, 3.4vw, 3rem)',
    3: 'clamp(1.15rem, 1.8vw, 1.6rem)',
  }

  return (
    <Tag data-awb-rich-text={richText} data-awb-element={elementPath}
      style={{
        fontFamily: 'var(--awb-heading-font)',
        fontSize: sizes[level],
        lineHeight: 1.08,
        letterSpacing: '-0.02em',
        margin: 0,
        ...style,
      }}
    >
      {children}
    </Tag>
  )
}

export function Prose({ children, style, 'data-awb-element': elementPath, 'data-awb-rich-text': richText }: { children: ReactNode; style?: CSSProperties; 'data-awb-element'?: string; 'data-awb-rich-text'?: string }) {
  return (
    <p data-awb-rich-text={richText} data-awb-element={elementPath} style={{ maxWidth: '62ch', lineHeight: 1.65, color: 'var(--awb-muted)', ...style }}>{children}</p>
  )
}

export function Cta({
  style,
  'data-awb-element': elementPath,
  label,
  href,
  variant = 'solid',
}: {
  label: string
  href: string
  style?: CSSProperties
  'data-awb-element'?: string
  variant?: 'solid' | 'outline' | 'text-link'
}) {
  const styles: Record<string, CSSProperties> = {
    solid: {
      background: 'var(--awb-button-bg, var(--awb-primary))',
      color: 'var(--awb-button-fg, var(--awb-primary-fg))',
      border: '1px solid var(--awb-button-bg, var(--awb-primary))',
    },
    outline: {
      background: 'transparent',
      color: 'var(--awb-button-outline, currentColor)',
      border: '1px solid var(--awb-button-outline, currentColor)',
    },
    'text-link': {
      background: 'transparent',
      color: 'currentColor',
      border: 'none',
      padding: 0,
      textDecoration: 'underline',
      textUnderlineOffset: '0.3em',
    },
  }

  return (
    <a data-awb-element={elementPath}
      href={href || undefined}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        boxSizing: 'border-box',
        padding: variant === 'text-link' ? 0 : '0.95rem 1.8rem',
        borderRadius: 'var(--awb-radius)',
        fontSize: '0.95rem',
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        textDecoration: variant === 'text-link' ? 'underline' : 'none',
        ...styles[variant],
        ...style,
        ...(style?.width !== undefined || style?.height !== undefined ? { display: 'inline-flex', padding: '0.4rem 0.6rem', minHeight: 'min-content' } : {}),
      }}
    >
      {label}
    </a>
  )
}

export function Media({
  sizeStyle,
  'data-awb-element': elementPath,
  src,
  alt,
  ratio = '4 / 5',
  style,
}: {
  sizeStyle?: CSSProperties
  'data-awb-element'?: string
  src?: string
  alt: string
  ratio?: string
  style?: CSSProperties
}) {
  if (!src) {
    return (
      <div data-awb-element={elementPath}
        role="img"
        aria-label={alt}
        style={{
          aspectRatio: ratio,
          background: 'var(--awb-surface)',
          border: '1px dashed var(--awb-border)',
          display: 'grid',
          placeItems: 'center',
          color: 'var(--awb-muted)',
          fontSize: '0.8rem',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          ...style,
          ...sizeStyle,
        }}
      >
        Image placeholder
      </div>
    )
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img data-awb-element={elementPath}
      src={src}
      alt={alt}
      style={{ width: '100%', aspectRatio: ratio, objectFit: 'cover', display: 'block', ...style, ...sizeStyle }}
    />
  )
}
