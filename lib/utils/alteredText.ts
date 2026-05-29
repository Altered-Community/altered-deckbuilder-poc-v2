const TOKEN_TO_ICON: Record<string, string> = {
  R: 'fa-altered-r',
  V: 'fa-altered-v',
  H: 'fa-altered-h',
  J: 'fa-altered-j',
  D: 'fa-altered-d',
  I: 'fa-altered-i',
  M: 'fa-altered-m',
  O: 'fa-altered-o',
  F: 'fa-altered-f',
  L: 'fa-altered-l',
  P: 'fa-altered-p',
  T: 'fa-altered-t',
  X: 'fa-altered-x',
  Z: 'fa-altered-z',
  A: 'fa-altered-a',
  C: 'fa-altered-c',
  G: 'fa-altered-g',
  K: 'fa-altered-k',
  '0': 'fa-altered-0',
  '1': 'fa-altered-1',
  '2': 'fa-altered-2',
  '3': 'fa-altered-3',
  '4': 'fa-altered-4',
  '5': 'fa-altered-5',
  '6': 'fa-altered-6',
  '7': 'fa-altered-7',
  '8': 'fa-altered-8',
  '9': 'fa-altered-9',
};

const ICON_EXTRA_STYLE: Record<string, string> = {
  'fa-altered-i': 'width:26px',
};

const BASE_ICON_STYLE = 'display:inline-block;vertical-align:middle;margin:0 2px';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function renderAlteredText(text: string): string {
  return escapeHtml(text.trim()).replace(/\{(\w+)\}/g, (_, token: string) => {
    const icon = TOKEN_TO_ICON[token] ?? TOKEN_TO_ICON[token.toUpperCase()];
    if (!icon) return `{${token}}`;
    const extra = ICON_EXTRA_STYLE[icon] ? `;${ICON_EXTRA_STYLE[icon]}` : '';
    return `<i class="fak ${icon}" style="${BASE_ICON_STYLE}${extra}"></i>`;
  });
}
