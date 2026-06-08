// lib/whatsapp.js

export function sendWhatsAppWeb({ mobile, message }) {
  if (typeof window === "undefined") return;

  const digits = String(mobile || "").replace(/\D/g, "");

  if (!digits) {
    alert("WhatsApp number is not available");
    return;
  }

  const number = digits.length === 10 ? `91${digits}` : digits;

  window.open(
    `https://wa.me/${number}?text=${encodeURIComponent(message || "")}`,
    "_blank",
    "noopener,noreferrer"
  );
}
