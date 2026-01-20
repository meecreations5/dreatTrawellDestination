// components/ui/Section.js

"use client";

export default function Section({ title, subtitle, action, children }) {
  return (
    <section className="space-y-3">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          {subtitle && (
            <p className="text-xs text-text-secondary">{subtitle}</p>
          )}
        </div>
        {action}
      </div>

      <div className="bg-white rounded-xl shadow-card p-4">
        {children}
      </div>
    </section>
  );
}
