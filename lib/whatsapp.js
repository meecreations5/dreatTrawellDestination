// lib/whatsapp.js

export function sendWhatsAppWeb({ mobile, message }) {
  if (!mobile || !message) {
    throw new Error("Mobile and message required for WhatsApp");
  }

  const encodedMessage = encodeURIComponent(message);

  // Ensure country code exists
  const phone = mobile.replace(/\D/g, "");

  const url = `https://wa.me/${phone}?text=${encodedMessage}`;

  window.open(url, "_blank");
}
