type InnerSegment =
  | { type: 'text'; value: string }
  | { type: 'symbol'; key: string }
  | { type: 'badge'; value: string };

type Segment =
  | { type: 'text'; value: string }
  | { type: 'golden'; children: InnerSegment[] }
  | { type: 'bold'; children: InnerSegment[] }
  | { type: 'symbol'; key: string }
  | { type: 'badge'; value: string }
  | { type: 'newline' };

const SYMBOLS: Record<string, { icon: string; style?: React.CSSProperties }> = {
  j: { icon: 'fa-arrow-right' },
  h: { icon: 'fa-hand' },
  r: { icon: 'fa-credit-card', style: { transform: 'rotate(180deg)', display: 'inline-block' } },
};

function parseInner(text: string): InnerSegment[] {
  const regex = /(\{[0-9]+\}|\{[a-zA-Z]\})/g;
  const segments: InnerSegment[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: 'text', value: text.slice(lastIndex, match.index) });
    }
    const inner = match[0].slice(1, -1);
    if (/^[0-9]+$/.test(inner)) {
      segments.push({ type: 'badge', value: inner });
    } else {
      segments.push({ type: 'symbol', key: inner.toLowerCase() });
    }
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    segments.push({ type: 'text', value: text.slice(lastIndex) });
  }

  return segments;
}

function parseCardText(text: string): Segment[] {
  const regex = /(#[^#]+#|\[[^\]]*\]|\{[0-9]+\}|\{[a-zA-Z]\}| {2,}|\n)/g;
  const segments: Segment[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: 'text', value: text.slice(lastIndex, match.index) });
    }

    const m = match[0];

    if (m === '\n' || m.startsWith(' ')) {
      segments.push({ type: 'newline' });
    } else if (m.startsWith('#') && m.endsWith('#')) {
      segments.push({ type: 'golden', children: parseInner(m.slice(1, -1)) });
    } else if (m.startsWith('[') && m.endsWith(']')) {
      const inner = m.slice(1, -1);
      if (inner.length > 0) {
        segments.push({ type: 'bold', children: parseInner(inner) });
      }
    } else if (m.startsWith('{') && m.endsWith('}')) {
      const inner = m.slice(1, -1);
      if (/^[0-9]+$/.test(inner)) {
        segments.push({ type: 'badge', value: inner });
      } else {
        segments.push({ type: 'symbol', key: inner.toLowerCase() });
      }
    }

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    segments.push({ type: 'text', value: text.slice(lastIndex) });
  }

  return segments;
}

function Symbol({ symbolKey }: { symbolKey: string }) {
  const sym = SYMBOLS[symbolKey];
  if (!sym) return <span className="text-gray-400 text-xs">[{symbolKey}]</span>;
  return (
    <i
      className={`fa-solid ${sym.icon} text-[0.75em] mx-0.5 align-baseline`}
      style={sym.style}
    />
  );
}

function Badge({ value }: { value: string }) {
  return (
    <span
      className="inline-flex items-center justify-center rounded-full bg-amber-500 text-white font-bold mx-0.5 align-middle"
      style={{ fontSize: '0.8em', minWidth: '1.4em', height: '1.4em', padding: '0 0.3em' }}
    >
      {value}
    </span>
  );
}

function renderInner(children: InnerSegment[], key: number) {
  return children.map((sub, j) => {
    if (sub.type === 'badge') return <Badge key={`${key}-${j}`} value={sub.value} />;
    if (sub.type === 'symbol') return <Symbol key={`${key}-${j}`} symbolKey={sub.key} />;
    return <span key={`${key}-${j}`}>{sub.value}</span>;
  });
}

export default function CardText({ text, className = '' }: { text: string; className?: string }) {
  const segments = parseCardText(text);

  return (
    <span className={className}>
      {segments.map((seg, i) => {
        switch (seg.type) {
          case 'golden':
            return (
              <span key={i} className="text-amber-500 font-semibold">
                {renderInner(seg.children, i)}
              </span>
            );
          case 'bold':
            return (
              <strong key={i} className="font-bold text-gray-900">
                {renderInner(seg.children, i)}
              </strong>
            );
          case 'symbol':
            return <Symbol key={i} symbolKey={seg.key} />;
          case 'badge':
            return <Badge key={i} value={seg.value} />;
          case 'newline':
            return <br key={i} />;
          default:
            return <span key={i}>{seg.value}</span>;
        }
      })}
    </span>
  );
}

export function CardEffectList({ effects }: { effects: string[] }) {
  return (
    <>
      {effects.map((effect, i) => (
        <span key={i}>
          {i > 0 && <><br /><br /></>}
          <CardText text={effect} />
        </span>
      ))}
    </>
  );
}
