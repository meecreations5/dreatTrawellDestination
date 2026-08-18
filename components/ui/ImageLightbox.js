// components/ui/ImageLightBox.js

"use client";

export default function ImageLightbox({ src, onClose }) {
  if (!src) return null;

  return (
    <div
      className="
        fixed inset-0 z-50
        bg-black/80
        flex items-center justify-center
        animate-fade-in
      "
      onClick={onClose}
    >
      <img
        src={src}
        alt="Preview"
        className="
          max-w-[90vw]
          max-h-[90vh]
          rounded-xl
          shadow-2xl
          animate-zoom-in
        "
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}
