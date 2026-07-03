"use client";

import { useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  serverTimestamp,
  query,
  where,
  getDocs
} from "firebase/firestore";
import {
  AlertCircle,
  Building2,
  CalendarClock,
  CheckCircle2,
  Clock3,
  ChevronDown,
  ChevronUp,
  Loader2,
  MapPin,
  MessageSquare,
  Monitor,
  Package,
  Sparkles,
  StickyNote,
  UserRound,
  Video
} from "lucide-react";

import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";
import EngagementChip from "@/components/engagement/EngagementChip";
import AssetPickerModal from "@/components/documents/AssetPickerModal";

import {
  ENGAGEMENT_OUTCOME_OPTIONS,
  getIntentFromEngagement,
  getOutcomeLabel
} from "@/lib/engagementIntentMap";

/* =========================
   OPTIONS
========================= */

const CHANNELS = [
  { key: "call", label: "Call", icon: "📞" },
  { key: "email", label: "Email", icon: "✉️" },
  { key: "whatsapp", label: "WhatsApp", icon: "💬" },
  { key: "meeting", label: "Meeting", icon: "🤝" }
];

const DIRECTIONS = [
  { key: "outbound", label: "Outgoing", icon: "↗️" },
  { key: "inbound", label: "Incoming", icon: "↙️" }
];

const MEETING_MODES = [
  { key: "online", label: "Online", icon: "💻" },
  { key: "offline", label: "Offline", icon: "📍" }
];

const OUTCOMES = ENGAGEMENT_OUTCOME_OPTIONS;

/* =========================
   FORM DEFAULT
========================= */

function getInitialForm() {
  return {
    spocIndex: 0,
    channel: "call",
    direction: "outbound",

    message: "",

    destinationRefId: "",
    destinationName: "",

    outcomeCode: "",

    scheduledAt: "",
    assignedToUid: "",

    meetingMode: "",
    meetingAt: "",
    meetingLocation: "",
    meetingLink: "",

    customRemark: "",

    sharedAssets: []
  };
}

/* =========================
   HELPERS
========================= */

function getFirstValue(...values) {
  return (
    values.find(
      value => typeof value === "string" && value.trim().length > 0
    )?.trim() || ""
  );
}

function getUserName(user) {
  return getFirstValue(
    user?.name,
    user?.displayName,
    user?.email,
    "Team Member"
  );
}

function getUserEmail(user) {
  return getFirstValue(
    user?.email,
    user?.workEmail,
    user?.officialEmail
  );
}

function getUserRole(user) {
  return getFirstValue(
    user?.role,
    user?.designation,
    user?.jobTitle
  );
}

function getSpocLabel(spoc) {
  if (!spoc) return "SPOC";

  const name = getFirstValue(
    spoc.name,
    spoc.email,
    spoc.mobile,
    "Unnamed SPOC"
  );

  const designation = getFirstValue(spoc.designation);
  const contact = getFirstValue(spoc.email, spoc.mobile);

  if (designation && contact) return `${name} - ${designation} - ${contact}`;
  if (designation) return `${name} - ${designation}`;
  if (contact && contact !== name) return `${name} - ${contact}`;

  return name;
}

function getChannelLabel(channel) {
  return CHANNELS.find(c => c.key === channel)?.label || channel;
}

function getMeetingModeLabel(mode) {
  return MEETING_MODES.find(m => m.key === mode)?.label || "";
}

function toLocalDateTimeValue(dateValue) {
  const date = dateValue instanceof Date ? dateValue : new Date(dateValue);

  if (Number.isNaN(date.getTime())) return "";

  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60 * 1000);

  return local.toISOString().slice(0, 16);
}

function getSuggestedDateTime(days = 1) {
  const date = new Date();

  date.setDate(date.getDate() + Number(days || 1));
  date.setHours(11, 0, 0, 0);

  return toLocalDateTimeValue(date);
}

function getAssetKey(asset) {
  return asset?.assetId || asset?.id || asset?.url || asset?.title;
}

/* =========================
   COMPONENT
========================= */

export default function EngagementForm({
  agent,
  onSaved,
  onClose
}) {
  const { user, loading } = useAuth();

  const [team, setTeam] = useState([]);
  const [destinations, setDestinations] = useState([]);
  const [form, setForm] = useState(null);

  const [saving, setSaving] = useState(false);
  const [showAssets, setShowAssets] = useState(false);
  const [showInternalNote, setShowInternalNote] = useState(false);
  const [showAdvancedFollowUp, setShowAdvancedFollowUp] = useState(false);
  const [assetPickerOpen, setAssetPickerOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    setForm(getInitialForm());
  }, [user]);

  /* =========================
     LOAD TEAM
  ========================== */

  useEffect(() => {
    let mounted = true;

    async function loadTeam() {
      try {
        const snap = await getDocs(
          query(
            collection(db, "users"),
            where("active", "==", true)
          )
        );

        if (!mounted) return;

        setTeam(
          snap.docs
            .map(d => {
              const data = d.data();

              return {
                uid: d.id,
                name: getFirstValue(
                  data.name,
                  data.displayName,
                  data.email,
                  "Team Member"
                ),
                email: data.email || "",
                role: data.role || data.designation || ""
              };
            })
            .sort((a, b) => a.name.localeCompare(b.name))
        );
      } catch (error) {
        console.error("Failed to load team:", error);
      }
    }

    loadTeam();

    return () => {
      mounted = false;
    };
  }, []);

  /* =========================
     LOAD DESTINATIONS
  ========================== */

  useEffect(() => {
    let mounted = true;

    async function loadDestinations() {
      try {
        const snap = await getDocs(
          query(
            collection(db, "destinations"),
            where("active", "==", true)
          )
        );

        if (!mounted) return;

        setDestinations(
          snap.docs
            .map(d => ({
              id: d.id,
              ...d.data()
            }))
            .sort((a, b) =>
              String(a.name || "").localeCompare(String(b.name || ""))
            )
        );
      } catch (error) {
        console.error("Failed to load destinations:", error);
      }
    }

    loadDestinations();

    return () => {
      mounted = false;
    };
  }, []);

  const spocs = agent?.spocs || [];
  const selectedSpoc = form ? spocs[form.spocIndex] : null;

  const selectedDestination = useMemo(() => {
    if (!form?.destinationRefId) return null;

    return destinations.find(d => d.id === form.destinationRefId) || null;
  }, [destinations, form?.destinationRefId]);

  const isMeeting = form?.channel === "meeting";

  const smartIntent = useMemo(() => {
    if (!form) return null;

    return getIntentFromEngagement({
      channel: form.channel,
      direction: form.direction,
      outcomeCode: form.outcomeCode,
      hasDestination: Boolean(form.destinationRefId),
      hasSharedAssets: Boolean(form.sharedAssets?.length),
      scheduledAt: form.scheduledAt,
      isMeeting
    });
  }, [
    form?.channel,
    form?.direction,
    form?.outcomeCode,
    form?.destinationRefId,
    form?.sharedAssets,
    form?.scheduledAt,
    isMeeting
  ]);

  const followUpRequired =
    form?.outcomeCode === "followup_required" ||
    Boolean(form?.scheduledAt) ||
    Boolean(smartIntent?.followUpRecommended);

  const hasValidEmail = Boolean(selectedSpoc?.email);
  const hasValidMobile = Boolean(selectedSpoc?.mobile);

  const summaryLabel =
    form?.channel === "meeting"
      ? "Meeting Purpose / Notes"
      : form?.channel === "call"
        ? "Call Summary"
        : form?.channel === "whatsapp"
          ? "WhatsApp Summary"
          : "Email Summary";

  const footerStatus = isMeeting
    ? form?.meetingAt
      ? `${getMeetingModeLabel(form.meetingMode)} meeting will be saved as scheduled.`
      : "Add tentative meeting date and mode."
    : followUpRequired
      ? "This will be saved with smart follow-up context."
      : "This will be saved as completed engagement.";

  if (loading || !user || !form) {
    return null;
  }

  if (!agent?.id) {
    return (
      <div className="bg-white rounded-xl shadow-card p-5">
        <p className="text-sm text-gray-500">
          Agent details not available.
        </p>
      </div>
    );
  }

  if (!spocs.length) {
    return (
      <div className="bg-white rounded-xl shadow-card p-5 space-y-3">
        <div className="flex items-start gap-2">
          <AlertCircle size={18} className="text-orange-500 mt-0.5" />

          <div>
            <h2 className="text-sm font-semibold text-gray-900">
              No SPOC available
            </h2>

            <p className="text-xs text-gray-500 mt-1">
              Please add at least one SPOC to this travel agent before logging
              an engagement.
            </p>
          </div>
        </div>
      </div>
    );
  }

  /* =========================
     ACTIONS
  ========================== */

  const applySuggestedFollowUp = () => {
    if (!smartIntent) return;

    setForm(prev => ({
      ...prev,
      scheduledAt:
        prev.scheduledAt ||
        getSuggestedDateTime(smartIntent.followUpDays || 1)
    }));

    setShowAdvancedFollowUp(true);
  };

  const removeAsset = assetKey => {
    setForm(prev => ({
      ...prev,
      sharedAssets: (prev.sharedAssets || []).filter(
        asset => getAssetKey(asset) !== assetKey
      )
    }));
  };

  const appendAssetLinksToSummary = () => {
    const links = (form.sharedAssets || [])
      .filter(asset => asset.url)
      .map(asset => `${asset.title}: ${asset.url}`)
      .join("\n");

    if (!links) return;

    setForm(prev => ({
      ...prev,
      message: prev.message
        ? `${prev.message}\n\nShared Assets:\n${links}`
        : `Shared Assets:\n${links}`
    }));
  };

  const resetAfterSave = () => {
    setForm(prev => ({
      ...getInitialForm(),
      spocIndex: prev.spocIndex,
      channel: prev.channel,
      direction: prev.direction,
      destinationRefId: prev.destinationRefId,
      destinationName: prev.destinationName,
      sharedAssets: []
    }));

    setShowAssets(false);
    setShowInternalNote(false);
    setShowAdvancedFollowUp(false);
  };

  const submit = async () => {
    if (!form.message.trim()) {
      alert(`${summaryLabel} is required`);
      return;
    }

    if (!form.outcomeCode) {
      alert("Please select an outcome");
      return;
    }

    if (isMeeting) {
      if (!form.meetingMode) {
        alert("Please select meeting mode");
        return;
      }

      if (!form.meetingAt) {
        alert("Please select tentative meeting date and time");
        return;
      }

      if (form.meetingMode === "online" && !form.meetingLink.trim()) {
        alert("Please enter online meeting link");
        return;
      }

      if (form.meetingMode === "offline" && !form.meetingLocation.trim()) {
        alert("Please enter offline meeting venue/location");
        return;
      }
    }

    if (form.outcomeCode === "followup_required" && !form.scheduledAt) {
      alert("Please schedule a follow-up date and time");
      return;
    }

    setSaving(true);

    try {
      const spoc = agent.spocs[form.spocIndex];
      const assignee = team.find(t => t.uid === form.assignedToUid);

      const destinationRefId = selectedDestination?.id || "";

      const destinationId =
        selectedDestination?.destinationId ||
        selectedDestination?.id ||
        "";

      const destinationName = selectedDestination?.name || "";

      const destinationCode =
        selectedDestination?.code ||
        selectedDestination?.destinationCode ||
        "";

      const messageText = form.message.trim();

      const meetingAtDate =
        isMeeting && form.meetingAt ? new Date(form.meetingAt) : null;

      const scheduledAtDate = form.scheduledAt
        ? new Date(form.scheduledAt)
        : null;

      const subject = isMeeting
        ? `${getMeetingModeLabel(form.meetingMode)} meeting with ${
            agent.agencyName || agent.name || "Travel Agent"
          }`
        : `${getChannelLabel(form.channel)} engagement with ${
            agent.agencyName || agent.name || "Travel Agent"
          }`;

      const status =
        meetingAtDate || scheduledAtDate ? "scheduled" : "completed";

      const finalIntent = getIntentFromEngagement({
        channel: form.channel,
        direction: form.direction,
        outcomeCode: form.outcomeCode,
        hasDestination: Boolean(destinationRefId),
        hasSharedAssets: Boolean(form.sharedAssets?.length),
        scheduledAt: form.scheduledAt,
        isMeeting
      });

      const payload = {
        entityType: "travelAgent",

        engagementType: finalIntent.engagementType,
        activityType: "manual_log",
        logType: "manual_engagement",

        agentId: agent.id,
        agentName: agent.agencyName || agent.name || "",
        travelAgentName: agent.agencyName || agent.name || "",
        agencyName: agent.agencyName || agent.name || "",

        spoc,

        channel: form.channel,
        direction: form.direction || "outbound",

        subject,

        message: messageText,
        messageText,
        messageHtml: null,

        destinationId: destinationId || null,
        destinationRefId: destinationRefId || null,
        destinationCode: destinationCode || null,
        destinationName: destinationName || null,
        destinationIds: destinationRefId ? [destinationRefId] : [],
        destinationNames: destinationName ? [destinationName] : [],

        outcomeCode: form.outcomeCode,
        outcomeLabel: getOutcomeLabel(form.outcomeCode),

        intentCode: finalIntent.intentCode,
        intentName: finalIntent.intentName,
        intentSource: "engagement_form",
        intentReason: finalIntent.reason,

        communicationReady: Boolean(finalIntent.communicationReady),
        smartSuggestionEnabled: true,

        suggestedNextAction: finalIntent.nextAction,
        suggestedNextActionLabel: finalIntent.nextActionLabel,
        suggestedFollowUpDays: finalIntent.followUpDays,
        waitingOn: finalIntent.waitingOn,
        communicationStatus: finalIntent.communicationStatus,

        meetingMode: isMeeting ? form.meetingMode : null,
        meetingModeLabel: isMeeting
          ? getMeetingModeLabel(form.meetingMode)
          : null,
        meetingAt: meetingAtDate,
        tentativeMeetingDate: meetingAtDate,

        meetingLocation:
          isMeeting && form.meetingMode === "offline"
            ? form.meetingLocation.trim()
            : "",

        meetingLink:
          isMeeting && form.meetingMode === "online"
            ? form.meetingLink.trim()
            : "",

        isOnlineMeeting: isMeeting
          ? form.meetingMode === "online"
          : false,

        isOfflineMeeting: isMeeting
          ? form.meetingMode === "offline"
          : false,

        customRemark: form.customRemark.trim(),

        scheduledAt: scheduledAtDate,
        nextActionDate: scheduledAtDate,
        nextFollowUpDate: scheduledAtDate,
        followUpDate: scheduledAtDate,
        requiresFollowUp: Boolean(scheduledAtDate),

        status,

        assignedToUid: assignee?.uid || user.uid,
        assignedToName: assignee?.name || getUserName(user),
        assignedToEmail: assignee?.email || getUserEmail(user),
        assignedToRole: assignee?.role || getUserRole(user),

        leadId: null,

        sharedAssets: form.sharedAssets || [],
        sharedAssetIds: (form.sharedAssets || [])
          .map(asset => asset.assetId)
          .filter(Boolean),
        sharedAssetTitles: (form.sharedAssets || [])
          .map(asset => asset.title)
          .filter(Boolean),
        assetShareCount: form.sharedAssets?.length || 0,
        hasSharedAssets: Boolean(form.sharedAssets?.length),

        deleted: false,
        isDeleted: false,

        createdByUid: user.uid,
        createdByName: getUserName(user),
        createdByEmail: getUserEmail(user),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      const ref = await addDoc(collection(db, "engagements"), payload);

      const savedEngagement = {
        id: ref.id,
        ...payload
      };

      alert("Engagement saved");

      onSaved?.(savedEngagement);

      resetAfterSave();
    } catch (error) {
      console.error("Failed to save engagement:", error);
      alert("Failed to save engagement");
    } finally {
      setSaving(false);
    }
  };

  /* =========================
     UI
  ========================== */

  return (
    <div
      className="
        bg-white rounded-2xl shadow-card
        lg:sticky lg:top-6
        flex flex-col
        max-h-[calc(100vh-3rem)]
        border border-gray-100 overflow-hidden
      "
    >
      {/* HEADER */}
      <div className="px-5 py-4 border-b bg-gradient-to-r from-blue-50 via-cyan-50 to-white">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl bg-white border border-blue-100 text-blue-700 flex items-center justify-center">
            <MessageSquare size={18} />
          </div>

          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-gray-900">
              Smart Engagement Logger
            </h2>

            <p className="text-xs text-gray-500 mt-1">
              Log activity and prepare the next communication automatically.
            </p>
          </div>
        </div>
      </div>

      {/* BODY */}
      <div className="p-5 space-y-5 overflow-y-auto pb-28">
        {/* STEP 1 */}
        <StepLabel number="1" title="Who did you connect with?" />

        <SectionCard
          icon={<UserRound size={16} />}
          title="Contact Person"
          description="Choose the person you interacted with."
        >
          <Field label="Select SPOC">
            <select
              className="mui-input"
              value={form.spocIndex}
              onChange={e =>
                setForm({
                  ...form,
                  spocIndex: Number(e.target.value)
                })
              }
            >
              {spocs.map((s, i) => (
                <option key={`${s.email || s.mobile || s.name}-${i}`} value={i}>
                  {getSpocLabel(s)}
                </option>
              ))}
            </select>
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <ContactStatus
              label="Email"
              value={selectedSpoc?.email}
              valid={hasValidEmail}
            />

            <ContactStatus
              label="Mobile"
              value={selectedSpoc?.mobile}
              valid={hasValidMobile}
            />
          </div>
        </SectionCard>

        {/* STEP 2 */}
        <StepLabel number="2" title="What activity happened?" />

        <SectionCard
          icon={<Clock3 size={16} />}
          title="Activity"
          description="Select channel and direction."
        >
          <Field label="Channel">
            <div className="flex gap-3 flex-wrap">
              {CHANNELS.map(c => (
                <EngagementChip
                  key={c.key}
                  label={c.label}
                  icon={c.icon}
                  active={form.channel === c.key}
                  onClick={() =>
                    setForm({
                      ...form,
                      channel: c.key,
                      outcomeCode:
                        c.key === "meeting"
                          ? "meeting_scheduled"
                          : form.outcomeCode,
                      meetingMode: c.key === "meeting" ? form.meetingMode : "",
                      meetingAt: c.key === "meeting" ? form.meetingAt : "",
                      meetingLocation:
                        c.key === "meeting" ? form.meetingLocation : "",
                      meetingLink:
                        c.key === "meeting" ? form.meetingLink : ""
                    })
                  }
                />
              ))}
            </div>
          </Field>

          <Field label="Direction">
            <div className="flex gap-3 flex-wrap">
              {DIRECTIONS.map(d => (
                <EngagementChip
                  key={d.key}
                  label={d.label}
                  icon={d.icon}
                  active={form.direction === d.key}
                  onClick={() =>
                    setForm({
                      ...form,
                      direction: d.key
                    })
                  }
                />
              ))}
            </div>
          </Field>
        </SectionCard>

        {/* MEETING DETAILS */}
        {isMeeting && (
          <SectionCard
            icon={<Video size={16} />}
            title="Tentative Meeting"
            description="Choose online/offline mode and tentative meeting time."
          >
            <Field label="Meeting Mode">
              <div className="grid grid-cols-2 gap-3">
                {MEETING_MODES.map(mode => (
                  <button
                    key={mode.key}
                    type="button"
                    onClick={() =>
                      setForm({
                        ...form,
                        meetingMode: mode.key,
                        meetingLocation:
                          mode.key === "offline"
                            ? form.meetingLocation
                            : "",
                        meetingLink:
                          mode.key === "online" ? form.meetingLink : ""
                      })
                    }
                    className={`
                      rounded-xl border p-3 text-left transition
                      ${
                        form.meetingMode === mode.key
                          ? "border-blue-500 bg-blue-50 text-blue-700"
                          : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                      }
                    `}
                  >
                    <div className="flex items-center gap-2">
                      <span>{mode.icon}</span>
                      <span className="text-sm font-semibold">
                        {mode.label}
                      </span>
                    </div>

                    <p className="text-xs mt-1 opacity-75">
                      {mode.key === "online"
                        ? "Google Meet / Zoom / Teams"
                        : "Office / Cafe / Client place"}
                    </p>
                  </button>
                ))}
              </div>
            </Field>

            <Field label="Tentative Meeting Date & Time">
              <div className="relative">
                <CalendarClock
                  size={15}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                />

                <input
                  type="datetime-local"
                  className="mui-input pl-9"
                  value={form.meetingAt}
                  onChange={e =>
                    setForm({
                      ...form,
                      meetingAt: e.target.value
                    })
                  }
                />
              </div>
            </Field>

            {form.meetingMode === "online" && (
              <Field label="Online Meeting Link">
                <div className="relative">
                  <Monitor
                    size={15}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                  />

                  <input
                    className="mui-input pl-9"
                    value={form.meetingLink}
                    placeholder="Paste Google Meet / Zoom / Teams link"
                    onChange={e =>
                      setForm({
                        ...form,
                        meetingLink: e.target.value
                      })
                    }
                  />
                </div>
              </Field>
            )}

            {form.meetingMode === "offline" && (
              <Field label="Offline Meeting Venue">
                <div className="relative">
                  <Building2
                    size={15}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                  />

                  <input
                    className="mui-input pl-9"
                    value={form.meetingLocation}
                    placeholder="Enter meeting location / venue"
                    onChange={e =>
                      setForm({
                        ...form,
                        meetingLocation: e.target.value
                      })
                    }
                  />
                </div>
              </Field>
            )}
          </SectionCard>
        )}

        {/* STEP 3 */}
        <StepLabel number="3" title="What was discussed?" />

        <SectionCard
          icon={<MapPin size={16} />}
          title="Engagement Details"
          description="Add destination and conversation notes."
        >
          <Field label="Destination">
            <select
              className="mui-input"
              value={form.destinationRefId}
              onChange={e => {
                const d = destinations.find(x => x.id === e.target.value);

                setForm({
                  ...form,
                  destinationRefId: d?.id || "",
                  destinationName: d?.name || ""
                });
              }}
            >
              <option value="">No Destination</option>

              {destinations.map(d => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label={summaryLabel}>
            <textarea
              className="mui-input min-h-[110px]"
              value={form.message}
              placeholder={`Write ${summaryLabel.toLowerCase()}...`}
              onChange={e =>
                setForm({
                  ...form,
                  message: e.target.value
                })
              }
            />
          </Field>
        </SectionCard>

        {/* OPTIONAL ASSETS */}
        <CollapsibleSection
          icon={<Package size={16} />}
          title="Shared Assets"
          description="Track assets only if they were actually shared."
          open={showAssets}
          onToggle={() => setShowAssets(prev => !prev)}
          badge={
            form.sharedAssets.length
              ? `${form.sharedAssets.length} selected`
              : ""
          }
        >
          {form.sharedAssets.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-200 bg-white p-4 text-center">
              <p className="text-sm font-medium text-gray-700">
                No assets selected
              </p>

              <p className="text-xs text-gray-500 mt-1">
                Select assets from Document Library to track what was shared.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {form.sharedAssets.map(asset => (
                <div
                  key={getAssetKey(asset)}
                  className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 bg-white px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-gray-800">
                      {asset.title}
                    </p>

                    <p className="text-xs text-gray-500 truncate">
                      {asset.categoryName || "Asset"} - v
                      {asset.currentVersion || 1}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    {asset.url && (
                      <a
                        href={asset.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 hover:underline"
                      >
                        View
                      </a>
                    )}

                    <button
                      type="button"
                      onClick={() => removeAsset(getAssetKey(asset))}
                      className="text-xs text-red-600 hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setAssetPickerOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100"
            >
              <Package className="h-4 w-4" />
              Select Assets
            </button>

            {form.sharedAssets.length > 0 && (
              <button
                type="button"
                onClick={appendAssetLinksToSummary}
                className="inline-flex items-center gap-2 rounded-lg bg-gray-100 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-200"
              >
                Add Links to Summary
              </button>
            )}
          </div>
        </CollapsibleSection>

        {/* STEP 4 */}
        <StepLabel number="4" title="What should happen next?" />

        <SectionCard
          icon={<CheckCircle2 size={16} />}
          title="Outcome & Smart Suggestion"
          description="Outcome will decide the smart communication intent."
        >
          <Field label="Outcome">
            <select
              className="mui-input"
              value={form.outcomeCode}
              onChange={e =>
                setForm({
                  ...form,
                  outcomeCode: e.target.value
                })
              }
            >
              <option value="">Select Outcome</option>

              {OUTCOMES.map(outcome => (
                <option key={outcome.key} value={outcome.key}>
                  {outcome.label}
                </option>
              ))}
            </select>
          </Field>

          {smartIntent && form.outcomeCode && (
            <SmartIntentCard
              smartIntent={smartIntent}
              scheduledAt={form.scheduledAt}
              onApplyFollowUp={applySuggestedFollowUp}
            />
          )}

          <Field label="Schedule Follow-up">
            <input
              type="datetime-local"
              className="mui-input"
              value={form.scheduledAt}
              onChange={e =>
                setForm({
                  ...form,
                  scheduledAt: e.target.value
                })
              }
            />

            {form.outcomeCode === "followup_required" &&
              !form.scheduledAt && (
                <p className="text-xs text-orange-600 mt-1">
                  Follow-up date is required for this outcome.
                </p>
              )}
          </Field>

          {(followUpRequired || showAdvancedFollowUp) && (
            <Field label="Assign Follow-up To">
              <select
                className="mui-input"
                value={form.assignedToUid}
                onChange={e =>
                  setForm({
                    ...form,
                    assignedToUid: e.target.value
                  })
                }
              >
                <option value="">
                  Assign to self - {getUserName(user)}
                </option>

                {team.map(u => (
                  <option key={u.uid} value={u.uid}>
                    {u.name}
                  </option>
                ))}
              </select>
            </Field>
          )}
        </SectionCard>

        {/* INTERNAL NOTE */}
        <CollapsibleSection
          icon={<StickyNote size={16} />}
          title="Internal Note"
          description="Private note visible only to your internal team."
          open={showInternalNote}
          onToggle={() => setShowInternalNote(prev => !prev)}
        >
          <textarea
            className="mui-input min-h-[80px]"
            value={form.customRemark}
            placeholder="Private note for internal team..."
            onChange={e =>
              setForm({
                ...form,
                customRemark: e.target.value
              })
            }
          />
        </CollapsibleSection>
      </div>

      {/* FOOTER */}
      <div className="sticky bottom-0 bg-white border-t p-4 flex items-center justify-between gap-3">
        <div className="hidden sm:block text-xs text-gray-500">
          {footerStatus}
        </div>

        <div className="flex gap-2 ml-auto">
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="border border-gray-200 text-gray-700 px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-60"
            >
              Cancel
            </button>
          )}

          <button
            type="button"
            onClick={submit}
            disabled={saving}
            className="
              bg-blue-600 text-white
              px-6 py-2.5
              rounded-lg
              text-sm font-medium
              hover:bg-blue-700
              disabled:opacity-60
              inline-flex items-center gap-2
            "
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                Save Engagement
              </>
            )}
          </button>
        </div>
      </div>

      <AssetPickerModal
        open={assetPickerOpen}
        onClose={() => setAssetPickerOpen(false)}
        selectedAssets={form.sharedAssets || []}
        title="Select Assets to Share"
        channel={form.channel === "whatsapp" ? "whatsapp" : "engagement"}
        destinationId={form.destinationRefId || ""}
        onConfirm={assets =>
          setForm(prev => ({
            ...prev,
            sharedAssets: assets || []
          }))
        }
      />
    </div>
  );
}

/* =========================
   UI COMPONENTS
========================= */

function StepLabel({ number, title }) {
  return (
    <div className="flex items-center gap-2">
      <span className="h-6 w-6 rounded-full bg-blue-600 text-white text-xs font-semibold flex items-center justify-center">
        {number}
      </span>

      <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
        {title}
      </p>
    </div>
  );
}

function SmartIntentCard({
  smartIntent,
  scheduledAt,
  onApplyFollowUp
}) {
  return (
    <div className="rounded-xl border border-blue-100 bg-blue-50 p-3">
      <div className="flex items-start gap-2">
        <div className="h-8 w-8 rounded-lg bg-white text-blue-700 border border-blue-100 flex items-center justify-center shrink-0">
          <Sparkles size={15} />
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-blue-700">
            Smart Communication Intent
          </p>

          <p className="text-sm font-semibold text-gray-900 mt-0.5">
            {smartIntent.intentName}
          </p>

          <p className="text-xs text-gray-600 mt-1">
            {smartIntent.reason}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
            <MiniInfo
              label="Next Action"
              value={smartIntent.nextActionLabel}
            />

            <MiniInfo
              label="Status"
              value={smartIntent.communicationStatus}
            />

            <MiniInfo
              label="Waiting On"
              value={smartIntent.waitingOn}
            />

            <MiniInfo
              label="Follow-up"
              value={`${smartIntent.followUpDays} day(s)`}
            />
          </div>

          {!scheduledAt && smartIntent.followUpRecommended && (
            <button
              type="button"
              onClick={onApplyFollowUp}
              className="mt-3 rounded-lg bg-white border border-blue-200 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50"
            >
              Apply suggested follow-up
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function MiniInfo({ label, value }) {
  return (
    <div className="rounded-lg bg-white border border-blue-100 px-2 py-1.5">
      <p className="text-[10px] text-gray-500">
        {label}
      </p>

      <p className="text-[11px] font-semibold text-gray-800 break-words">
        {value || "-"}
      </p>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-gray-600">
        {label}
      </label>
      {children}
    </div>
  );
}

function SectionCard({ icon, title, description, children }) {
  return (
    <section className="rounded-xl border border-gray-200 bg-gray-50/60 p-4 space-y-3">
      <div className="flex items-start gap-2">
        <div className="text-gray-500 mt-0.5">
          {icon}
        </div>

        <div>
          <p className="text-sm font-semibold text-gray-900">
            {title}
          </p>

          {description && (
            <p className="text-xs text-gray-500 mt-0.5">
              {description}
            </p>
          )}
        </div>
      </div>

      <div className="space-y-3">
        {children}
      </div>
    </section>
  );
}

function CollapsibleSection({
  icon,
  title,
  description,
  open,
  onToggle,
  badge,
  children
}) {
  return (
    <section className="rounded-xl border border-gray-200 bg-gray-50/60 overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full p-4 flex items-start justify-between gap-3 text-left hover:bg-gray-50"
      >
        <div className="flex items-start gap-2">
          <div className="text-gray-500 mt-0.5">
            {icon}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-gray-900">
                {title}
              </p>

              {badge && (
                <span className="rounded-full bg-blue-50 border border-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                  {badge}
                </span>
              )}
            </div>

            {description && (
              <p className="text-xs text-gray-500 mt-0.5">
                {description}
              </p>
            )}
          </div>
        </div>

        {open ? (
          <ChevronUp size={16} className="text-gray-400 mt-1" />
        ) : (
          <ChevronDown size={16} className="text-gray-400 mt-1" />
        )}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {children}
        </div>
      )}
    </section>
  );
}

function ContactStatus({ label, value, valid }) {
  return (
    <div
      className={`
        rounded-lg border px-3 py-2
        ${
          valid
            ? "border-green-200 bg-green-50"
            : "border-orange-200 bg-orange-50"
        }
      `}
    >
      <div className="flex items-center gap-1.5">
        {valid ? (
          <CheckCircle2 size={14} className="text-green-600" />
        ) : (
          <AlertCircle size={14} className="text-orange-600" />
        )}

        <p
          className={`
            text-xs font-medium
            ${valid ? "text-green-700" : "text-orange-700"}
          `}
        >
          {label}
        </p>
      </div>

      <p className="text-xs text-gray-600 mt-1 truncate">
        {value || "Not available"}
      </p>
    </div>
  );
}