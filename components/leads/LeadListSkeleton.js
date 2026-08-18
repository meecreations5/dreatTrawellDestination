// componenets/leads/leadListSkelton

import CardSkeleton from "@/components/ui/CardSkeleton";

export default function LeadListSkeleton() {
  return (
    <div className="space-y-3">
      {[1,2,3,4].map(i => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}
