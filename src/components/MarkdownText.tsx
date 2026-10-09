import React from 'react';

interface MarkdownTextProps {
  text: string;
  className?: string;
  style?: React.CSSProperties;
  inline?: boolean;
  variant?: 'default' | 'clean';
}

/**
 * A professional, lightweight Markdown renderer for D&D content.
 * Supports: Bold, Italic, Inline Code, Unordered Lists, Ordered Lists, Paragraphs, Tables.
 * This component remains a pure renderer without internal interaction logic.
 */
const MarkdownText: React.FC<MarkdownTextProps> = ({
  text,
  className,
  style,
  inline = false,
  variant = 'default',
}) => {
  if (!text) return null;

  // Inline parsing logic (Bold, Italic, Code)
  const parseInline = (inlineText: string) => {
    const parts = inlineText.split(/(\*\*.*?\*\*|\*.*?\*|`.*?`|\[.*?\]\(.*?\))/g);

    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={i} style={{ fontWeight: 700, color: 'var(--color-text-primary)' }}>
            {part.slice(2, -2)}
          </strong>
        );
      }
      if (part.startsWith('*') && part.endsWith('*')) {
        return (
          <em key={i} style={{ fontStyle: 'italic', color: 'var(--color-text-secondary)' }}>
            {part.slice(1, -1)}
          </em>
        );
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return (
          <code
            key={i}
            style={{
              background: 'rgba(0,0,0,0.05)',
              padding: '2px 4px',
              borderRadius: '4px',
              fontSize: '0.9em',
              fontFamily: 'SFMono-Regular, Consolas, "Liberation Mono", Menlo, monospace',
              color: '#d1211b',
            }}
          >
            {part.slice(1, -1)}
          </code>
        );
      }
      const linkMatch = part.match(/^\[(.*?)\]\((.*?)\)$/);
      if (linkMatch) {
        return (
          <a
            key={i}
            href={linkMatch[2]}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--color-link-blue)', textDecoration: 'none' }}
            onMouseEnter={(e) => (e.currentTarget.style.textDecoration = 'underline')}
            onMouseLeave={(e) => (e.currentTarget.style.textDecoration = 'none')}
          >
            {linkMatch[1]}
          </a>
        );
      }
      return part;
    });
  };

  if (inline) {
    return (
      <span className={className} style={style}>
        {parseInline(text)}
      </span>
    );
  }

  // Block parsing logic
  const lines = text.split(/\r?\n/);
  const blocks: React.ReactNode[] = [];
  let currentList: { type: 'ul' | 'ol'; items: string[] } | null = null;

  const flushList = (key: string | number) => {
    if (currentList) {
      const ListTag = currentList.type;
      blocks.push(
        <ListTag
          key={`list-${key}`}
          style={{
            paddingLeft: '1.8em',
            margin: '0.8em 0',
            listStyleType: currentList.type === 'ul' ? 'disc' : 'decimal',
            color: 'var(--color-text-secondary)',
          }}
        >
          {currentList.items.map((item, i) => (
            <li key={i} style={{ marginBottom: '0.4em', paddingLeft: '0.4em' }}>
              <span
                style={{
                  color: 'var(--color-text-secondary)',
                  lineHeight: '1.6',
                  fontSize: '0.95rem',
                }}
              >
                {parseInline(item)}
              </span>
            </li>
          ))}
        </ListTag>,
      );
      currentList = null;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Unordered List (- or *)
    const ulMatch = line.match(/^[\s]*[-*][\s]+(.*)/);
    if (ulMatch) {
      if (!currentList || currentList.type !== 'ul') {
        flushList(i);
        currentList = { type: 'ul', items: [] };
      }
      currentList.items.push(ulMatch[1]);
      continue;
    }

    // Ordered List (1.)
    const olMatch = line.match(/^[\s]*\d+\.[\s]+(.*)/);
    if (olMatch) {
      if (!currentList || currentList.type !== 'ol') {
        flushList(i);
        currentList = { type: 'ol', items: [] };
      }
      currentList.items.push(olMatch[1]);
      continue;
    }

    // Blockquote (>)
    const quoteMatch = line.match(/^[\s]*>[\s]*(.*)/);
    if (quoteMatch) {
      flushList(i);
      const content = quoteMatch[1];

      const hMatch = content.match(/^(#{1,6})\s+(.*)/);
      const oMatch = content.match(/^(\d+)\.\s+(.*)/);
      const uMatch = content.match(/^[-*]\s+(.*)/);

      let renderedContent;
      if (hMatch) {
        const level = hMatch[1].length;
        const Tag = `h${level}` as any;
        renderedContent = (
          <Tag style={{ margin: '0.2em 0', fontWeight: 700 }}>{parseInline(hMatch[2])}</Tag>
        );
      } else if (oMatch) {
        renderedContent = (
          <div style={{ display: 'flex', gap: '8px', margin: '4px 0' }}>
            <span style={{ fontWeight: 700, color: 'var(--color-apple-blue)', minWidth: '1.2em' }}>
              {oMatch[1]}.
            </span>
            <span>{parseInline(oMatch[2])}</span>
          </div>
        );
      } else if (uMatch) {
        renderedContent = (
          <div style={{ display: 'flex', gap: '8px', margin: '4px 0' }}>
            <span style={{ color: 'var(--color-apple-blue)' }}>•</span>
            <span>{parseInline(uMatch[1])}</span>
          </div>
        );
      } else {
        renderedContent = parseInline(content);
      }

      const isClean = variant === 'clean';
      blocks.push(
        <blockquote
          key={`quote-${i}`}
          style={{
            borderLeft: isClean ? 'none' : '4px solid var(--color-apple-blue)',
            padding: isClean ? '4px 0 12px 0' : '12px 20px',
            margin: isClean ? '0.2em 0' : '0.6em 0',
            color: isClean ? '#86868b' : '#424245',
            background: isClean ? 'transparent' : 'rgba(0, 113, 227, 0.03)',
            borderRadius: isClean ? '0' : '0 12px 12px 0',
            fontStyle: isClean ? 'italic' : 'normal',
            lineHeight: '1.6',
          }}
        >
          {renderedContent}
        </blockquote>,
      );
      continue;
    }

    // Horizontal Rule (---)
    if (trimmed === '---' || trimmed === '***' || trimmed === '___') {
      flushList(i);
      blocks.push(
        <hr
          key={`hr-${i}`}
          style={{ border: 'none', borderTop: '1px solid #e5e5e7', margin: '1em 0' }}
        />,
      );
      continue;
    }

    // Headers (#)
    const headerMatch = line.match(/^([\s]*(#{1,6}))[\s]+(.*)/);
    if (headerMatch) {
      flushList(i);
      const level = headerMatch[2].length;
      const HeaderTag = `h${level}` as any;
      const headerStyles: React.CSSProperties = {
        fontWeight: 600,
        color: 'var(--color-text-primary)',
        marginTop: '1em',
        marginBottom: '0.5em',
      };
      if (level === 1) headerStyles.fontSize = '1.6em';
      if (level === 2) headerStyles.fontSize = '1.4em';
      if (level === 3) headerStyles.fontSize = '1.2em';
      if (level === 4) {
        headerStyles.fontSize = '1rem';
        headerStyles.marginTop = '1.2em';
        headerStyles.marginBottom = '0.6em';
        headerStyles.color = 'var(--color-apple-blue)';
        headerStyles.borderBottom = '1px solid rgba(0, 113, 227, 0.1)';
        headerStyles.paddingBottom = '4px';
      }

      blocks.push(
        <HeaderTag key={`h-${i}`} style={headerStyles}>
          {parseInline(headerMatch[3])}
        </HeaderTag>,
      );
      continue;
    }

    // Tables (| col | col |)
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      const nextLine = lines[i + 1]?.trim();
      if (nextLine && nextLine.startsWith('|') && nextLine.includes('---')) {
        flushList(i);

        const cleanHeader = line
          .split('|')
          .map((s) => s.trim())
          .filter((s, idx, arr) => {
            if (idx === 0 && s === '') return false;
            if (idx === arr.length - 1 && s === '') return false;
            return true;
          });

        const rows: string[][] = [];
        let j = i + 2;
        while (j < lines.length && lines[j].trim().startsWith('|')) {
          const rowData = lines[j]
            .split('|')
            .map((s) => s.trim())
            .filter((s, idx, arr) => {
              if (idx === 0 && s === '') return false;
              if (idx === arr.length - 1 && s === '') return false;
              return true;
            });
          rows.push(rowData);
          j++;
        }

        blocks.push(
          <div
            key={`table-wrapper-${i}`}
            style={{
              overflowX: 'auto',
              margin: '1em 0',
              borderRadius: '12px',
              border: '1px solid var(--color-border-dark)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.02)',
            }}
          >
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: '0.9rem',
                textAlign: 'left',
                tableLayout: 'fixed',
              }}
            >
              <thead>
                <tr
                  style={{
                    background: 'var(--color-bg-surface-elevated)',
                    borderBottom: '1px solid var(--color-border-dark)',
                  }}
                >
                  {cleanHeader.map((h, idx) => (
                    <th
                      key={idx}
                      style={{
                        padding: '10px 14px',
                        fontWeight: 700,
                        color: 'var(--color-text-primary)',
                        width: idx === 0 ? '60px' : 'auto',
                        textAlign: idx === 0 ? 'center' : 'left',
                        borderRight: idx === 0 ? '1px solid var(--color-border-dark)' : 'none',
                      }}
                    >
                      {parseInline(h)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, rIdx) => (
                  <tr
                    key={rIdx}
                    style={{
                      borderBottom:
                        rIdx === rows.length - 1 ? 'none' : '1px solid var(--color-border-dark)',
                      background:
                        rIdx % 2 === 0 ? 'var(--color-bg-dark)' : 'var(--color-bg-surface)',
                    }}
                  >
                    {row.map((cell, cIdx) => (
                      <td
                        key={cIdx}
                        style={{
                          padding: '10px 14px',
                          color: 'var(--color-text-secondary)',
                          textAlign: cIdx === 0 ? 'center' : 'left',
                          fontWeight: cIdx === 0 ? 700 : 400,
                          borderRight: cIdx === 0 ? '1px solid #f2f2f7' : 'none',
                        }}
                      >
                        {parseInline(cell)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>,
        );

        i = j - 1;
        continue;
      }
    }

    // Regular Paragraph
    if (trimmed) {
      flushList(i);
      blocks.push(
        <p
          key={`p-${i}`}
          className={className}
          style={{ ...style, margin: '0.5em 0', lineHeight: '1.6' }}
        >
          {parseInline(line)}
        </p>,
      );
    } else {
      flushList(i);
    }
  }

  flushList('end');

  return <div className="markdown-content">{blocks}</div>;
};

export default MarkdownText;
