// components/ui/Card.js
"use client";

export default function Card({ children, className = "" }) {
  return (
    <div className={`bg-white rounded-xl shadow-card p-4 ${className}`}>
      {children}
    </div>
  );
}
