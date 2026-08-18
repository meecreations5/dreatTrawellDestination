// components/leads/LeadDetailPage.js

{/* ACTION BUTTONS */}
<div className="flex gap-3 mt-4">
  <button
    onClick={() => setFollowUpOpen(true)}
    className="bg-green-600 text-white px-4 py-2 rounded"
  >
    + Log Follow-Up
  </button>

  <button
    onClick={() => setQuoteOpen(true)}
    className="bg-purple-600 text-white px-4 py-2 rounded"
  >
    + Create Quotation
  </button>
</div>
