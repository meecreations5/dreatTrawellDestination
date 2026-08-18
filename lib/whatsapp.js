// lib/whatsapp.js

export function sendWhatsAppWeb({ mobile, message }) {
  if (typeof window === "undefined") return false;

  const digits = String(mobile || "").replace(/\D/g, "");

  if (!digits) {
    alert("WhatsApp number is not available");
    return false;
  }

  const number = digits.length === 10 ? `91${digits}` : digits;
  const opened = window.open(
    `https://wa.me/${number}?text=${encodeURIComponent(message || "")}`,
    "_blank"
  );

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
