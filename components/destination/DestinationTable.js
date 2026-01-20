export default function DestinationTable({
  destinations,
  onRowClick
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-gray-600">
          <tr>
            <th className="px-4 py-2 text-left">Destination</th>
            <th className="px-4 py-2 text-left">Best Time</th>
            <th className="px-4 py-2 text-left">Duration</th>
          </tr>
        </thead>
        <tbody>
          {destinations.map(d => (
            <tr
              key={d.id}
              onClick={() => onRowClick(d.id)}
              className="
                border-t hover:bg-gray-50 cursor-pointer
              "
            >
              <td className="px-4 py-2 font-medium">
                {d.name}
              </td>
              <td className="px-4 py-2">
                {d.bestTimeToVisit || "—"}
              </td>
              <td className="px-4 py-2">
                {d.idealTripDuration || "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
