/**
 * Copia texto para a área de transferência.
 * Usa navigator.clipboard em HTTPS; fallback execCommand em HTTP.
 */
export function copiarParaClipboard(texto, onSuccess, onError) {
  const str = String(texto);
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(str)
      .then(() => onSuccess && onSuccess())
      .catch(() => _fallback(str, onSuccess, onError));
  } else {
    _fallback(str, onSuccess, onError);
  }
}

function _fallback(texto, onSuccess, onError) {
  const el = document.createElement('textarea');
  el.value = texto;
  el.style.position = 'fixed';
  el.style.opacity = '0';
  document.body.appendChild(el);
  el.focus();
  el.select();
  try {
    document.execCommand('copy');
    onSuccess && onSuccess();
  } catch {
    onError && onError();
  }
  document.body.removeChild(el);
}
