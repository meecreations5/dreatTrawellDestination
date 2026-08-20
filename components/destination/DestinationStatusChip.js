export default function DestinationStatusChip({
  status,
  active
}) {
  return (
    <div className="flex gap-2">
      <span
        className={`text-xs px-2 py-0.5 rounded-full
          ${
            status === "published"
              ? "bg-green-100 text-green-700"
              : "bg-yellow-100 text-yellow-700"
          }
        `}
      >
        {status === "published" ? "Published" : "Draft"}
      </span>

      <span
        className={`text-xs px-2 py-0.5 rounded-full
          ${
            active
              ? "bg-blue-100 text-blue-700"
              : "bg-red-100 text-red-700"
          }
        `}
      >
        {active ? "Active" : "Inactive"}
      </span>
    </div>
  );
}
