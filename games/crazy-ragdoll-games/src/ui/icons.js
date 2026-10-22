// Chunky, rounded icon set. Everything is drawn in currentColor so buttons
// and chips tint their icons.
const svg = (body) => `<svg viewBox="0 0 24 24" aria-hidden="true">${body}</svg>`;
const line = (d, w = 3.4) => `<path d="${d}" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;

export const ICONS = {
  pause: svg('<rect x="5" y="4" width="5.5" height="16" rx="2.75"/><rect x="13.5" y="4" width="5.5" height="16" rx="2.75"/>'),
  play: svg('<path d="M8 4.2c-1-.6-2.2.1-2.2 1.3v13c0 1.2 1.2 1.9 2.2 1.3l10.6-6.5c1-.6 1-2 0-2.6z"/>'),
  retry: svg(line('M5 12a7 7 0 1 0 2.2-5.1') + line('M4.5 3.5v4.5h4.5')),
  next: svg(line('M5 12h13') + line('M13 6.5 18.5 12 13 17.5')),
  back: svg(line('M19 12H6') + line('M11 6.5 5.5 12l5.5 5.5')),
  grid: svg('<circle cx="7" cy="7" r="3.6"/><circle cx="17" cy="7" r="3.6"/><circle cx="7" cy="17" r="3.6"/><circle cx="17" cy="17" r="3.6"/>'),
  home: svg('<path d="M12 3.2c.4 0 .8.1 1.1.4l7 6.2c.9.8.3 2.2-.9 2.2H19v7a2 2 0 0 1-2 2h-2.5v-5.5h-5V21H7a2 2 0 0 1-2-2v-7h-.2c-1.2 0-1.8-1.4-.9-2.2l7-6.2c.3-.3.7-.4 1.1-.4z"/>'),
  gear: svg('<path d="M10.3 2.5h3.4l.6 2.6 1.7.9 2.4-1.2 2.4 2.4-1.2 2.4.9 1.7 2.6.6v3.4l-2.6.6-.9 1.7 1.2 2.4-2.4 2.4-2.4-1.2-1.7.9-.6 2.6h-3.4l-.6-2.6-1.7-.9-2.4 1.2-2.4-2.4 1.2-2.4-.9-1.7-2.6-.6v-3.4l2.6-.6.9-1.7-1.2-2.4 2.4-2.4 2.4 1.2 1.7-.9z"/><circle cx="12" cy="12" r="3.3" fill="#fff8e8"/>'),
  star: svg('<path d="M12 2.6c.5 0 .9.3 1.1.7l2.3 4.8 5.2.7c1 .1 1.4 1.4.7 2.1l-3.8 3.7.9 5.2c.2 1-.8 1.7-1.7 1.3L12 18.6l-4.7 2.5c-.9.4-1.9-.3-1.7-1.3l.9-5.2-3.8-3.7c-.7-.7-.3-2 .7-2.1l5.2-.7 2.3-4.8c.2-.4.6-.7 1.1-.7z"/>'),
  target: svg('<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6.6" fill="#fff8e8"/><circle cx="12" cy="12" r="3.4"/>'),
  dummy: svg('<circle cx="12" cy="6" r="4.4"/><path d="M8.6 11.2h6.8c1 0 1.6 1 1.3 1.9l-1.4 4.2v3.6a1.6 1.6 0 0 1-3.2 0V18h-.2v2.9a1.6 1.6 0 0 1-3.2 0v-3.6L7.3 13.1c-.3-.9.3-1.9 1.3-1.9z"/>'),
  clock: svg('<circle cx="12" cy="12" r="10"/>' + line('M12 7v5l3 2', 2.8).replace('currentColor', '#fff8e8')),
  skull: svg('<path d="M12 2.5a8.5 8.5 0 0 0-8.5 8.5c0 2.8 1.4 4.8 3.2 6v2.4c0 1 .8 1.8 1.8 1.8h7c1 0 1.8-.8 1.8-1.8V17c1.8-1.2 3.2-3.2 3.2-6A8.5 8.5 0 0 0 12 2.5z"/><circle cx="8.7" cy="11.3" r="2.3" fill="#fff8e8"/><circle cx="15.3" cy="11.3" r="2.3" fill="#fff8e8"/>'),
  heart: svg('<path d="M12 21c-.3 0-.6-.1-.9-.3C8 18.6 2.5 14.6 2.5 9.2 2.5 6 5 3.5 8 3.5c1.6 0 3 .8 4 2 1-1.2 2.4-2 4-2 3 0 5.5 2.5 5.5 5.7 0 5.4-5.5 9.4-8.6 11.5-.3.2-.6.3-.9.3z"/>'),
  bolt: svg('<path d="M14.2 2.3c.8-.6 1.9.1 1.6 1.1L14.4 9.5h4.3c.9 0 1.4 1 .8 1.7l-8.8 10.4c-.7.8-2 .1-1.7-.9l1.5-6.1H6.2c-.9 0-1.4-1-.8-1.7z"/>'),
  shirt: svg('<path d="M12 2.5C6.8 2.5 2.5 6.3 2.5 11c0 4.5 3.9 8.5 8.6 8.5 1.4 0 1.9-.8 1.9-1.7 0-1.2-1-1.6-1-2.6 0-1 .8-1.6 1.9-1.6h2.6c2.8 0 5-2 5-4.9 0-3.6-4.2-6.2-9.5-6.2z"/><circle cx="7.5" cy="10.5" r="1.7" fill="#fff8e8"/><circle cx="11" cy="6.8" r="1.7" fill="#fff8e8"/><circle cx="15.8" cy="7.5" r="1.7" fill="#fff8e8"/>'),
  sound: svg('<path d="M3.5 9.5c0-.8.7-1.5 1.5-1.5h2.8l4.4-3.6c.7-.6 1.8-.1 1.8.8v13.6c0 .9-1.1 1.4-1.8.8L7.8 16H5c-.8 0-1.5-.7-1.5-1.5z"/>' + line('M17 8.5a5 5 0 0 1 0 7', 2.6) + line('M19.6 6a8.6 8.6 0 0 1 0 12', 2.6)),
  music: svg('<path d="M9 17.5V6.2c0-.7.5-1.3 1.2-1.5l8.5-2.1c.9-.2 1.8.5 1.8 1.4v11.5" fill="none" stroke="currentColor" stroke-width="2.8"/><circle cx="6.2" cy="17.8" r="3.4"/><circle cx="17.7" cy="15.6" r="3.4"/>'),
};

export function icon(name) {
  return ICONS[name] ?? '';
}
