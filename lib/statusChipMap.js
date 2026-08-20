export function getStatusChipProps(status) {
  const map = {
    present: { label: "Present", color: "green" },
    "half-day": { label: "Half Day", color: "yellow" },
    absent: { label: "Absent", color: "red" },
    leave: { label: "Leave", color: "blue" },
    regularized: { label: "Regularized", color: "purple" },
    pending: { label: "Pending", color: "yellow" },
    approved: { label: "Approved", color: "green" },
    rejected: { label: "Rejected", color: "red" }
  };

  return map[status] || {
    label: status || "—",
    color: "gray"
  };
}
