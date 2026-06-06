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
  // Capture the reference locally because we null `activeBackdrop` before
  // the setTimeout fires — otherwise the timeout callback closes over the
  // mutated (null) variable and the backdrop element never gets removed
  // from the DOM, leaving an invisible overlay that swallows every click.
  const backdrop = activeBackdrop;
  activeBackdrop = null;
  window.removeEventListener('keydown', backdrop._onKey);
  if (typeof backdrop._onClose === 'function') backdrop._onClose();
  backdrop.style.animation = 'none';
  backdrop.style.opacity = '0';
  setTimeout(() => backdrop.remove(), 180);
  document.body.style.overflow = '';
}
