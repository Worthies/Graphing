/**
 * Inline SVG icons for the toolbar.
 * Avoids external dependencies and works in VS Code webview.
 */

export const icons: Record<string, string> = {
  // Draw modes
  select: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M3 2L13 8L8 9L6 14L3 2Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
  </svg>`,

  rect: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="2" y="3" width="12" height="10" rx="1" stroke="currentColor" stroke-width="1.5"/>
  </svg>`,

  ellipse: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="8" cy="8" rx="6" ry="5" stroke="currentColor" stroke-width="1.5"/>
  </svg>`,

  line: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <line x1="3" y1="13" x2="13" y2="3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
  </svg>`,

  polyline: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <polyline points="2,12 6,4 10,10 14,2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`,

  path: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M2 12C4 8 6 4 8 4C10 4 12 8 14 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    <circle cx="4" cy="8" r="1.5" fill="currentColor"/>
    <circle cx="12" cy="8" r="1.5" fill="currentColor"/>
  </svg>`,

  text: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M3 3H13M8 3V13M5 13H11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
  </svg>`,

  image: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="2" y="3" width="12" height="10" rx="1" stroke="currentColor" stroke-width="1.5"/>
    <circle cx="5" cy="6" r="1.5" fill="currentColor"/>
    <path d="M2 11L5 8L8 10L11 6L14 9" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
  </svg>`,

  // Operations
  delete: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
  </svg>`,

  duplicate: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="4" y="4" width="8" height="8" rx="1" stroke="currentColor" stroke-width="1.5"/>
    <path d="M4 12V13C4 13.5 4.5 14 5 14H11C11.5 14 12 13.5 12 13V12" stroke="currentColor" stroke-width="1.5"/>
  </svg>`,

  group: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="1" y="1" width="6" height="6" rx="1" stroke="currentColor" stroke-width="1.5"/>
    <rect x="9" y="9" width="6" height="6" rx="1" stroke="currentColor" stroke-width="1.5"/>
    <path d="M7 4H9M4 7V9M12 7V9M7 12H9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
  </svg>`,

  ungroup: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="1" y="1" width="6" height="6" rx="1" stroke="currentColor" stroke-width="1.5"/>
    <rect x="9" y="9" width="6" height="6" rx="1" stroke="currentColor" stroke-width="1.5"/>
  </svg>`,

  bringForward: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M8 2L8 14M8 2L5 5M8 2L11 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`,

  sendBackward: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M8 14L8 2M8 14L5 11M8 14L11 11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`,

  alignLeft: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <line x1="2" y1="2" x2="2" y2="14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    <rect x="4" y="3" width="10" height="3" rx="1" fill="currentColor"/>
    <rect x="4" y="10" width="6" height="3" rx="1" fill="currentColor"/>
  </svg>`,

  alignRight: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <line x1="14" y1="2" x2="14" y2="14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    <rect x="2" y="3" width="10" height="3" rx="1" fill="currentColor"/>
    <rect x="6" y="10" width="6" height="3" rx="1" fill="currentColor"/>
  </svg>`,

  alignTop: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <line x1="2" y1="2" x2="14" y2="2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    <rect x="3" y="4" width="3" height="10" rx="1" fill="currentColor"/>
    <rect x="10" y="4" width="3" height="6" rx="1" fill="currentColor"/>
  </svg>`,

  alignBottom: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <line x1="2" y1="14" x2="14" y2="14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    <rect x="3" y="2" width="3" height="10" rx="1" fill="currentColor"/>
    <rect x="10" y="6" width="3" height="6" rx="1" fill="currentColor"/>
  </svg>`,

  rotateClockwise: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M13 3A7 7 0 1 0 14.5 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    <path d="M10 1L13.5 3L10.5 5.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
  </svg>`,

  rotateCounterclockwise: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M3 3A7 7 0 1 1 1.5 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    <path d="M6 1L2.5 3L5.5 5.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
  </svg>`,

  zoomIn: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="7" cy="7" r="5" stroke="currentColor" stroke-width="1.5"/>
    <line x1="11" y1="11" x2="14" y2="14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    <line x1="5" y1="7" x2="9" y2="7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    <line x1="7" y1="5" x2="7" y2="9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
  </svg>`,

  zoomOut: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="7" cy="7" r="5" stroke="currentColor" stroke-width="1.5"/>
    <line x1="11" y1="11" x2="14" y2="14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    <line x1="5" y1="7" x2="9" y2="7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
  </svg>`,

  centerVertical: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <line x1="8" y1="2" x2="8" y2="14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-dasharray="2 2"/>
    <rect x="4" y="5" width="8" height="6" rx="1" stroke="currentColor" stroke-width="1.5"/>
  </svg>`,

  centerHorizontal: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <line x1="2" y1="8" x2="14" y2="8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-dasharray="2 2"/>
    <rect x="5" y="4" width="6" height="8" rx="1" stroke="currentColor" stroke-width="1.5"/>
  </svg>`,

  polygonToRect: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <polygon points="3,4 13,3 14,12 2,13" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" stroke-dasharray="2 2"/>
    <rect x="2" y="3" width="12" height="10" rx="1" stroke="currentColor" stroke-width="1.5"/>
    <path d="M8 1L8 3M8 13L8 15" stroke="currentColor" stroke-width="1" stroke-linecap="round" opacity="0.5"/>
  </svg>`,

  objectToPath: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="2" y="3" width="12" height="10" rx="1" stroke="currentColor" stroke-width="1.5" stroke-dasharray="2 2"/>
    <path d="M2 13C4 9 6 5 8 5C10 5 12 9 14 13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
  </svg>`,

  fitCanvasToContent: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="1" y="1" width="14" height="14" rx="1" stroke="currentColor" stroke-width="1.5" stroke-dasharray="2 2"/>
    <rect x="3" y="3" width="10" height="10" rx="1" stroke="currentColor" stroke-width="1.5"/>
    <path d="M1 5L3 3M11 3L13 1M13 11L11 13M3 13L1 11" stroke="currentColor" stroke-width="1" stroke-linecap="round"/>
  </svg>`,

  copyAsPng: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="2" y="2" width="9" height="12" rx="1" stroke="currentColor" stroke-width="1.5"/>
    <path d="M5 12V13C5 13.5 5.5 14 6 14H12C12.5 14 13 13.5 13 13V5C13 4.5 12.5 4 12 4H11" stroke="currentColor" stroke-width="1.5"/>
    <path d="M11 7L14 7M14 7L14 4M14 7L12.5 5.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M4 8L6 10L8 7L10 10" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`
};

/**
 * Get SVG icon by name
 */
export function getIcon(name: string): string {
  return icons[name] || '';
}
