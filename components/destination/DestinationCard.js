import Link from "next/link";

export default function DestinationCard({ destination }) {
  return (
    <Link
      href={`/destinations/${destination.id}`}
      className="
        block bg-white rounded-lg border border-gray-200
        hover:shadow-sm transition
      "
    >
      <div className="flex gap-4 p-4">
        {/* LEFT THUMB */}
        <div className="w-24 h-20 shrink-0 rounded-md overflow-hidden bg-gray-100">
          {destination.coverPhoto?.url ? (
            <img
              src={destination.coverPhoto.url}
              alt={destination.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gray-200" />
          )}
        </div>

        {/* RIGHT CONTENT */}
        <div className="flex-1 min-w-0 space-y-1">
          {/* TITLE */}
          <h3 className="text-sm font-semibold truncate">
            {destination.name}
          </h3>

          {/* DESCRIPTION */}
          <p className="text-xs text-gray-600 line-clamp-2">
            {destination.shortDescription ||
              destination.description ||
              "—"}
          </p>

          {/* META ROW (same as lead meta row) */}
          <div className="flex gap-3 text-[11px] text-gray-500 pt-1">
            {destination.bestTimeToVisit && (
              <span>
                Best time: {destination.bestTimeToVisit}
              </span>
            )}
            {destination.idealTripDuration && (
              <span>
                Duration: {destination.idealTripDuration}
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
