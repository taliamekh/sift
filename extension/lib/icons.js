// Subset of the web app's icons, kept inline here so the popup doesn't need
// a build step. Same viewBox/style as the web app.
(function () {
  const ICONS = {
    whisk: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v10"/><path d="M9 4c-1 2-1 6 3 9 4-3 4-7 3-9z" fill="currentColor" fill-opacity="0.18"/><path d="M9 4c-1 2-1 6 3 9 4-3 4-7 3-9"/><circle cx="12" cy="18.5" r="2.2"/></svg>`,
    plus:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>`,
    minus: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M5 12h14"/></svg>`,
    check: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L19 7"/></svg>`,
    star:  `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.5l2.9 6.1 6.7.8-4.9 4.7 1.3 6.6L12 17.6 6 20.7l1.3-6.6L2.4 9.4l6.7-.8z"/></svg>`,
    bookmark: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>`,
    external: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><path d="M15 3h6v6"/><path d="M10 14L21 3"/></svg>`,
    cupcake: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" stroke-linecap="round"><path d="M6 11h12l-1.5 9h-9z" fill="currentColor" fill-opacity="0.15"/><path d="M6 11h12l-1.5 9h-9z"/><path d="M5 11c0-3 3-5 7-5s7 2 7 5z" fill="currentColor" fill-opacity="0.25"/><path d="M12 3v3"/></svg>`,
    flower: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="6"  r="3" fill="currentColor" fill-opacity="0.3"/><circle cx="6"  cy="12" r="3" fill="currentColor" fill-opacity="0.3"/><circle cx="18" cy="12" r="3" fill="currentColor" fill-opacity="0.3"/><circle cx="12" cy="18" r="3" fill="currentColor" fill-opacity="0.3"/><circle cx="12" cy="12" r="2" fill="currentColor"/></svg>`,
    sparkle: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="M12 3l1.6 5.4L19 10l-5.4 1.6L12 17l-1.6-5.4L5 10l5.4-1.6z" fill="currentColor" fill-opacity="0.3"/></svg>`,
    print: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9V3h12v6"/><rect x="3" y="9" width="18" height="9" rx="2"/><path d="M6 17h12v4H6z"/></svg>`,
  };
  window.Sift = window.Sift || {};
  window.Sift.icon = (name) => ICONS[name] || ICONS.sparkle;
})();
