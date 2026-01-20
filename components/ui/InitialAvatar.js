// components/ui/InitialAvtar.js
"use client";

export default function InitialAvatar({ name }) {
  const initials =
    name?.split(" ").map(n => n[0]).join("").slice(0, 2) || "U";

  return (
    <div className="
      h-7 w-7 rounded-full
      bg-blue-100 text-blue-700
      flex items-center justify-center
      text-xs font-semibold
    ">
      {initials}
    </div>
  );
}
