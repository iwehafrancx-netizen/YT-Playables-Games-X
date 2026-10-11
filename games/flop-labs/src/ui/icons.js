const svg = (body, vb = '0 0 24 24') => `<svg viewBox="${vb}" aria-hidden="true">${body}</svg>`;

export const ICONS = {
  pause: svg('<rect x="6" y="4" width="4.5" height="16" rx="1.5"/><rect x="13.5" y="4" width="4.5" height="16" rx="1.5"/>'),
  play: svg('<path d="M7 4.5v15a1 1 0 0 0 1.5.9l12-7.5a1 1 0 0 0 0-1.8l-12-7.5A1 1 0 0 0 7 4.5z"/>'),
  back: svg('<path d="M15.5 4.5 8 12l7.5 7.5" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>'),
  retry: svg('<path d="M20 12a8 8 0 1 1-2.6-5.9" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M20.5 3.5v5h-5" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>'),
  next: svg('<path d="M8.5 4.5 16 12l-7.5 7.5" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>'),
  menu: svg('<rect x="4" y="5" width="16" height="3" rx="1.5"/><rect x="4" y="10.5" width="16" height="3" rx="1.5"/><rect x="4" y="16" width="16" height="3" rx="1.5"/>'),
  gear: svg('<path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zm9 4.7v-2.4l-2.5-.6a7 7 0 0 0-.7-1.6l1.4-2.2-1.7-1.7-2.2 1.4a7 7 0 0 0-1.6-.7L13.2 3h-2.4l-.6 2.5a7 7 0 0 0-1.6.7L6.4 4.8 4.7 6.5l1.4 2.2a7 7 0 0 0-.7 1.6L3 10.8v2.4l2.5.6c.2.6.4 1.1.7 1.6l-1.4 2.2 1.7 1.7 2.2-1.4c.5.3 1 .5 1.6.7l.5 2.4h2.4l.6-2.5c.6-.2 1.1-.4 1.6-.7l2.2 1.4 1.7-1.7-1.4-2.2c.3-.5.5-1 .7-1.6z"/>'),
  star: svg('<path d="M12 2.8l2.8 5.8 6.3.9-4.6 4.4 1.1 6.3L12 17.2l-5.6 3 1.1-6.3-4.6-4.4 6.3-.9z"/>'),
  lock: svg('<rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" fill="none" stroke="currentColor" stroke-width="2.6"/>'),
  target: svg('<circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" stroke-width="2.4"/><circle cx="12" cy="12" r="5.5" fill="none" stroke="currentColor" stroke-width="2.4"/><circle cx="12" cy="12" r="1.8"/>'),
  dummy: svg('<circle cx="12" cy="5.5" r="3.3"/><path d="M8 10h8l-.6 6h-2l-.4 6h-2l-.4-6h-2z"/><path d="M8.2 10.5 5 15M15.8 10.5 19 15" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>'),
  clock: svg('<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M12 7v5.5l3.5 2" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>'),
  gearItem: svg('<path d="M12 1.8l1.6 2.6 3-.6.6 3 2.6 1.6-1.2 2.8 1.2 2.8-2.6 1.6-.6 3-3-.6L12 22.2l-1.6-2.6-3 .6-.6-3-2.6-1.6 1.2-2.8-1.2-2.8 2.6-1.6.6-3 3 .6z"/><circle cx="12" cy="12" r="3.4" fill="#15171c"/>'),
  skull: svg('<path d="M12 3a8 8 0 0 0-8 8c0 2.6 1.3 4.5 3 5.6V20h3v-2h1v2h2v-2h1v2h3v-3.4c1.7-1.1 3-3 3-5.6a8 8 0 0 0-8-8z"/><circle cx="9" cy="11.5" r="2" fill="#15171c"/><circle cx="15" cy="11.5" r="2" fill="#15171c"/>'),
  bolt: svg('<path d="M13.5 2 5 13.5h6L9.5 22 19 9.5h-6z"/>'),
  ruler: svg('<path d="M3 16.5 16.5 3l4.5 4.5L7.5 21z"/><path d="M7 13l1.5 1.5M9.5 10.5 12 13M12 8l1.5 1.5M14.5 5.5 17 8" stroke="#15171c" stroke-width="1.6"/>'),
  shirt: svg('<path d="M8.5 3 4 5.5 2.5 10l3.5 1.2V21h12v-9.8l3.5-1.2L20 5.5 15.5 3a3.5 3.5 0 0 1-7 0z"/>'),
  sound: svg('<path d="M4 9h4l5-4.5v15L8 15H4z"/><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>'),
  music: svg('<path d="M9 18V5.5l11-2.5v12.5" fill="none" stroke="currentColor" stroke-width="2.4"/><circle cx="6.5" cy="18" r="3"/><circle cx="17.5" cy="15.5" r="3"/>'),

  cannon: svg('<rect x="10" y="44" width="44" height="10" rx="3" fill="#2b2e33"/><circle cx="22" cy="40" r="10" fill="#6c7178"/><g transform="rotate(-32 26 34)"><rect x="18" y="26" width="38" height="16" rx="6" fill="#e2463a"/><rect x="50" y="24" width="7" height="20" rx="2" fill="#f5c518"/></g><circle cx="22" cy="40" r="4" fill="#2b2e33"/>', '0 0 64 64'),
  stairs: svg('<path d="M6 54V44h12V34h12V24h12V14h16v40z" fill="#9b9a95"/><path d="M6 44h12M18 34h12M30 24h12M42 14h16" stroke="#f5c518" stroke-width="3"/><circle cx="46" cy="8" r="4" fill="#f5c518"/><path d="M44 12l-6 6M48 12l4 5" stroke="#f5c518" stroke-width="3" stroke-linecap="round"/>', '0 0 64 64'),
  cart: svg('<path d="M8 14h8l6 26h28l6-18H20" fill="none" stroke="#9aa1a8" stroke-width="4" stroke-linejoin="round"/><path d="M22 22h32l-5 14H25z" fill="#3fc79a" opacity=".85"/><circle cx="26" cy="50" r="5" fill="#2b2e33"/><circle cx="46" cy="50" r="5" fill="#2b2e33"/>', '0 0 64 64'),
  hop: svg('<rect x="4" y="46" width="18" height="6" rx="2" fill="#6c7178"/><rect x="40" y="36" width="20" height="6" rx="2" fill="#f0782a"/><path d="M14 40c6-22 22-26 30-10" fill="none" stroke="#fff" stroke-width="3" stroke-dasharray="4 4"/><circle cx="44" cy="22" r="5" fill="#f5c518"/><path d="M44 27v8M40 31h8" stroke="#f5c518" stroke-width="3" stroke-linecap="round"/>', '0 0 64 64'),
};

export function icon(name) {
  return ICONS[name] ?? '';
}
