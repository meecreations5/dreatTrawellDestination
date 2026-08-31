// lib/whatsapp.js

export function sendWhatsAppWeb({ mobile, message, targetWindow = null }) {
  if (typeof window === "undefined") return false;

  const digits = String(mobile || "").replace(/\D/g, "");

  if (!digits) {
    alert("WhatsApp number is not available");
    return false;
  }

  const number = digits.length === 10 ? `91${digits}` : digits;
  const url = `https://wa.me/${number}?text=${encodeURIComponent(message || "")}`;
  let opened = targetWindow;

  if (opened && !opened.closed) {
    try {
      opened.location.href = url;
    } catch {
      opened = null;
    }
  }

  if (!opened) {
    opened = window.open(url, "_blank");
  }

  if (opened) {
    try {
      opened.opener = null;
    } catch {
      // Best-effort protection; some browsers block opener access.
    }
    return true;
  }

  return false;
}
