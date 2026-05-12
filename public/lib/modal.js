import { h } from './h.js';

let activeBackdrop = null;

export function openModal(content, { onClose } = {}) {
  closeModal();
  const backdrop = h('div.modal-backdrop', {
    onClick: (e) => { if (e.target === backdrop) closeModal(); },
  });
  const modal = h('div.modal', { role: 'dialog', 'aria-modal': 'true' }, content);
  backdrop.appendChild(modal);
  document.body.appendChild(backdrop);
  document.body.style.overflow = 'hidden';
  activeBackdrop = backdrop;
  activeBackdrop._onClose = onClose;
  const onKey = (e) => { if (e.key === 'Escape') closeModal(); };
  window.addEventListener('keydown', onKey);
  activeBackdrop._onKey = onKey;
  // Focus first focusable
  const focusable = modal.querySelector('input, textarea, button, select');
  if (focusable) setTimeout(() => focusable.focus(), 40);
  return backdrop;
}

export function closeModal() {
  if (!activeBackdrop) return;
  window.removeEventListener('keydown', activeBackdrop._onKey);
  if (typeof activeBackdrop._onClose === 'function') activeBackdrop._onClose();
  activeBackdrop.style.animation = 'none';
  activeBackdrop.style.opacity = '0';
  setTimeout(() => activeBackdrop?.remove(), 180);
  activeBackdrop = null;
  document.body.style.overflow = '';
}
