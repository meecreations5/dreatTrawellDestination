"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { doc, getDoc } from "firebase/firestore";
import {
  AlertCircle,
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Clock3,
  ExternalLink,
  Globe2,
  ImageIcon,
  IndianRupee,
  MapPin,
  MapPinned,
  PlayCircle,
  Sparkles,
  Ticket,
  Youtube
} from "lucide-react";

import { db } from "@/lib/firebase";
import DestinationEnquiryForm from "@/components/destination/DestinationEnquiryForm";

/* =========================
   HELPERS
========================= */

function toNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function formatInr(value) {
  const amount = toNumber(value);

  if (!amount) return "On request";

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(amount);
}

function getFileUrl(file) {
  if (!file) return "";

  if (typeof file === "string") return file;

  return (
    file.url ||
    file.downloadURL ||
    file.previewUrl ||
    file.thumbnailUrl ||
    ""
  );
}

function getCoverUrl(destination) {
  return (
    getFileUrl(destination?.coverPhoto) ||
    getFileUrl(destination?.gallery?.[0]) ||
    getFileUrl(destination?.mediaGallery?.find(item => item.type === "image")) ||
    ""
  );
}

function getImageGallery(destination) {
  const uploadedGallery = Array.isArray(destination?.gallery)
    ? destination.gallery
        .map((item, index) => {
          const url = getFileUrl(item);

          return {
            id: item?.id || item?.path || url || `gallery_${index}`,
            url,
            title: item?.title || destination.name || "Destination image",
            caption: item?.caption || "",
            altText: item?.altText || destination.name || "Destination image"
          };
        })
        .filter(item => item.url)
    : [];

  const richImages = Array.isArray(destination?.mediaGallery)
    ? destination.mediaGallery
        .filter(item => item.type === "image" && item.active !== false)
        .map((item, index) => {
          const url = getFileUrl(item);

          return {
            id: item?.id || item?.path || url || `media_${index}`,
            url,
            title: item?.title || destination.name || "Destination image",
            caption: item?.caption || "",
            altText: item?.altText || destination.name || "Destination image"
          };
        })
        .filter(item => item.url)
    : [];

  return [...uploadedGallery, ...richImages];
}

function getYouTubeVideos(destination) {
  return Array.isArray(destination?.mediaGallery)
    ? destination.mediaGallery.filter(
        item =>
          item.type === "video" &&
          item.source === "youtube" &&
          item.active !== false
      )
    : [];
}

function getTravelStyleLabels(travelStyles = {}) {
  return Object.entries(travelStyles || {})
    .filter(([, active]) => Boolean(active))
    .map(([key]) =>
      key
        .replace(/_/g, " ")
        .replace(/\b\w/g, char => char.toUpperCase())
    );
}

function getActivityCount(destination) {
  if (destination?.hasSubLocations) {
    return (destination.locations || []).reduce(
      (sum, location) => sum + (location.activities?.length || 0),
      0
    );
  }

  return destination?.activities?.length || 0;
}

function getLocationCount(destination) {
  return Array.isArray(destination?.locations)
    ? destination.locations.length
    : 0;
}

function getSellingPrice(activity, key) {
  const pricing = activity?.pricing || {};

  return (
    pricing?.[key]?.sellingInInr ||
    pricing?.[`selling${key.charAt(0).toUpperCase()}${key.slice(1)}InInr`] ||
    0
  );
}

function isPublicDestination(destination) {
  return destination?.status === "published" && destination?.active !== false;
}

/* =========================
   PAGE
========================= */

export default function DestinationDetailPage() {
  const { destinationId } = useParams();
  const router = useRouter();

  const [destination, setDestination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [selectedImage, setSelectedImage] = useState("");
  const [enquiryOpen, setEnquiryOpen] = useState(false);

  /* =========================
     LOAD
  ========================== */
  useEffect(() => {
    const loadDestination = async () => {
      if (!db || !destinationId) {
        setLoadError("Destination could not be loaded.");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setLoadError("");

        const snap = await getDoc(doc(db, "destinations", destinationId));

        if (!snap.exists()) {
          setLoadError("Destination not found.");
          setDestination(null);
          return;
        }

        const data = {
          id: snap.id,
          ...snap.data()
        };

        if (!isPublicDestination(data)) {
          setLoadError("This destination is not available.");
          setDestination(null);
          return;
        }

        setDestination(data);

        const cover = getCoverUrl(data);
        setSelectedImage(cover);
      } catch (error) {
        console.error("Failed to load destination:", error);
        setLoadError("Unable to load destination. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    loadDestination();
  }, [destinationId]);

  const gallery = useMemo(
    () => (destination ? getImageGallery(destination) : []),
    [destination]
  );

  const videos = useMemo(
    () => (destination ? getYouTubeVideos(destination) : []),
    [destination]
  );

  const styleLabels = useMemo(
    () => getTravelStyleLabels(destination?.travelStyles),
    [destination]
  );

  const activityCount = useMemo(
    () => getActivityCount(destination),
    [destination]
  );

  const locationCount = useMemo(
    () => getLocationCount(destination),
    [destination]
  );

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50">
        <DestinationDetailSkeleton />
      </main>
    );
  }

  if (loadError || !destination) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-10">
        <div className="mx-auto max-w-2xl rounded-3xl border border-slate-200 bg-white p-8 text-center ">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-600">
            <AlertCircle size={22} />
          </div>

          <h1 className="text-xl font-semibold text-slate-950">
            {loadError || "Destination not found."}
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            Please go back and explore other available destinations.
          </p>

          <Link
            href="/destinations"
            className="mt-6 inline-flex items-center justify-center rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
          >
            Back to Destinations
          </Link>
        </div>
      </main>
    );
  }

  const coverUrl = selectedImage || getCoverUrl(destination);

  return (
    <main className="min-h-screen bg-slate-50">
      {/* HERO */}
      <section className="relative overflow-hidden bg-slate-950">
        <div className="absolute inset-0">
          {coverUrl ? (
            <img
              src={coverUrl}
              alt={destination.name || "Destination"}
              className="h-full w-full object-cover opacity-70"
            />
          ) : (
            <div className="h-full w-full bg-gradient-to-br from-blue-900 to-slate-950" />
          )}

          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-slate-950/20" />
        </div>

        <div className="relative mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
          <button
            type="button"
            onClick={() => router.back()}
            className="mb-10 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-medium text-white backdrop-blur transition hover:bg-white/20"
          >
            <ArrowLeft size={16} />
            Back
          </button>

          <div className="max-w-4xl py-10 lg:py-16">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-full bg-blue-500/90 px-4 py-2 text-xs font-semibold text-white backdrop-blur">
                <Sparkles size={14} />
                Dream Trawell Destination
              </span>

              {destination.destinationType && (
                <span className="rounded-full bg-white/15 px-4 py-2 text-xs font-semibold capitalize text-white backdrop-blur">
                  {destination.destinationType}
                </span>
              )}

              {destination.hasSubLocations && (
                <span className="rounded-full bg-emerald-500/90 px-4 py-2 text-xs font-semibold text-white backdrop-blur">
                  Multi-location
                </span>
              )}
            </div>

            <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">
              {destination.name}
            </h1>

            <p className="mt-5 max-w-3xl text-base leading-7 text-white/85 sm:text-lg">
              {destination.shortDescription ||
                destination.description ||
                "Explore curated experiences for this destination."}
            </p>

            <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <HeroStat
                icon={CalendarDays}
                label="Best Time"
                value={destination.bestTimeToVisit || "Flexible"}
              />

              <HeroStat
                icon={Clock3}
                label="Duration"
                value={destination.idealTripDuration || "Custom"}
              />

              <HeroStat
                icon={Ticket}
                label="Activities"
                value={activityCount || "Custom"}
              />

              <HeroStat
                icon={MapPinned}
                label={destination.hasSubLocations ? "Locations" : "Type"}
                value={
                  destination.hasSubLocations
                    ? locationCount || "Multiple"
                    : "Destination"
                }
              />
            </div>
          </div>
        </div>
      </section>

      {/* BODY */}
      <section className="mx-auto grid max-w-7xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:px-8">
        <div className="space-y-8">
          {/* OVERVIEW */}
          <Surface
            icon={Globe2}
            title="Destination Overview"
            description="A quick introduction to this destination."
          >
            <div className="prose prose-slate max-w-none">
              <p className="text-sm leading-7 text-slate-600 sm:text-base">
                {destination.description ||
                  destination.shortDescription ||
                  "Destination overview will be updated soon."}
              </p>
            </div>

            {styleLabels.length > 0 && (
              <div className="mt-6">
                <h3 className="mb-3 text-sm font-semibold text-slate-950">
                  Travel Styles
                </h3>

                <div className="flex flex-wrap gap-2">
                  {styleLabels.map(style => (
                    <span
                      key={style}
                      className="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700"
                    >
                      {style}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </Surface>

          {/* GALLERY */}
          {(gallery.length > 0 || videos.length > 0) && (
            <Surface
              icon={ImageIcon}
              title="Gallery"
              description="Photos and videos from this destination."
            >
              {gallery.length > 0 && (
                <div className="space-y-4">
                  <div className="overflow-hidden rounded-3xl bg-slate-100">
                    <img
                      src={selectedImage || gallery[0]?.url}
                      alt={destination.name || "Destination"}
                      className="h-[320px] w-full object-cover sm:h-[420px]"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
                    {gallery.slice(0, 10).map(image => (
                      <button
                        key={image.id}
                        type="button"
                        onClick={() => setSelectedImage(image.url)}
                        className={`overflow-hidden rounded-2xl border transition ${
                          selectedImage === image.url
                            ? "border-blue-500 ring-4 ring-blue-100"
                            : "border-slate-200 hover:border-blue-200"
                        }`}
                      >
                        <img
                          src={image.url}
                          alt={image.altText || destination.name}
                          className="h-20 w-full object-cover"
                        />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {videos.length > 0 && (
                <div className="mt-6">
                  <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-950">
                    <Youtube size={18} className="text-red-600" />
                    Destination Videos
                  </h3>

                  <div className="grid gap-4 md:grid-cols-2">
                    {videos.map(video => (
                      <VideoCard key={video.id} video={video} />
                    ))}
                  </div>
                </div>
              )}
            </Surface>
          )}

          {/* ACTIVITIES */}
          <Surface
            icon={Ticket}
            title={
              destination.hasSubLocations
                ? `${destination.locationLabel || "Locations"} & Activities`
                : "Activities"
            }
            description={
              destination.hasSubLocations
                ? "Explore activities by city, island, or region."
                : "Popular activities available in this destination."
            }
          >
            {destination.hasSubLocations ? (
              <LocationWiseActivities destination={destination} />
            ) : (
              <ActivityGrid activities={destination.activities || []} />
            )}
          </Surface>

          {/* ATTRACTIONS / PLACES / FOOD */}
          {!destination.hasSubLocations && (
            <>
              <ContentSection
                title="Attractions"
                icon={MapPinned}
                items={destination.attractions}
              />

              <ContentSection
                title="Places To Visit"
                icon={MapPin}
                items={destination.placesToVisit}
              />

              <ContentSection
                title="Food & Culture"
                icon={Sparkles}
                items={destination.foodCulture}
              />
            </>
          )}
        </div>

        {/* SIDEBAR */}
        <aside className="space-y-5 lg:sticky lg:top-6 lg:self-start">
          <Surface
            icon={CheckCircle2}
            title="At a Glance"
            description="Useful travel planning information."
          >
            <div className="space-y-3">
              <SidebarInfo
                icon={CalendarDays}
                label="Best Time To Visit"
                value={destination.bestTimeToVisit || "Flexible"}
              />

              <SidebarInfo
                icon={Clock3}
                label="Ideal Duration"
                value={destination.idealTripDuration || "Custom"}
              />

              <SidebarInfo
                icon={Globe2}
                label="Destination Type"
                value={destination.destinationType || "International"}
              />

              <SidebarInfo
                icon={Ticket}
                label="Activities"
                value={`${activityCount || 0} listed`}
              />

              {destination.hasSubLocations && (
                <SidebarInfo
                  icon={MapPinned}
                  label={destination.locationLabel || "Locations"}
                  value={`${locationCount || 0} listed`}
                />
              )}
            </div>
          </Surface>

          <section className="rounded-3xl border border-blue-100 bg-gradient-to-br from-blue-600 to-blue-700 p-6 text-white ">
            <h2 className="text-lg font-semibold">
              Interested in this destination?
            </h2>

            <p className="mt-2 text-sm leading-6 text-blue-50">
              Connect with Dream Trawell to plan a customized itinerary,
              quotation, and travel experience.
            </p>

            <button
              type="button"
              onClick={() => setEnquiryOpen(true)}
              className="mt-5 inline-flex w-full items-center justify-center rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-blue-700 transition hover:bg-blue-50"
            >
              Enquire Now
            </button>
          </section>
        </aside>
      </section>

      <DestinationEnquiryForm
        open={enquiryOpen}
        onClose={() => setEnquiryOpen(false)}
        destination={destination}
      />
    </main>
  );
}

/* =========================
   ACTIVITY DISPLAY
========================= */

function LocationWiseActivities({ destination }) {
  const locations = Array.isArray(destination.locations)
    ? destination.locations.filter(location => location.active !== false)
    : [];

  if (!locations.length) {
    return <EmptyBlock message="Location-wise activities will be updated soon." />;
  }

  return (
    <div className="space-y-8">
      {locations.map(location => (
        <section
          key={location.id}
          className="rounded-3xl border border-slate-200 bg-slate-50 p-4 sm:p-5"
        >
          <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <h3 className="text-xl font-semibold text-slate-950">
                  {location.name || "Location"}
                </h3>

                {location.type && (
                  <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold capitalize text-blue-700">
                    {String(location.type).replace(/_/g, " ")}
                  </span>
                )}
              </div>

              {location.shortDescription && (
                <p className="max-w-3xl text-sm leading-6 text-slate-600">
                  {location.shortDescription}
                </p>
              )}

              <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                {location.recommendedNights && (
                  <span className="rounded-full bg-white px-3 py-1.5">
                    {location.recommendedNights} night(s)
                  </span>
                )}

                <span className="rounded-full bg-white px-3 py-1.5">
                  {location.activities?.length || 0} activities
                </span>
              </div>
            </div>
          </div>

          <ActivityGrid activities={location.activities || []} />

          <div className="mt-6 grid gap-5 lg:grid-cols-3">
            <MiniContentList
              title="Attractions"
              items={location.attractions}
            />

            <MiniContentList
              title="Places To Visit"
              items={location.placesToVisit}
            />

            <MiniContentList
              title="Food & Culture"
              items={location.foodCulture}
            />
          </div>
        </section>
      ))}
    </div>
  );
}

function ActivityGrid({ activities = [] }) {
  const activeActivities = Array.isArray(activities)
    ? activities.filter(activity => activity.active !== false)
    : [];

  if (!activeActivities.length) {
    return <EmptyBlock message="Activities will be updated soon." />;
  }

  return (
    <div className="grid gap-5 md:grid-cols-2">
      {activeActivities.map((activity, index) => (
        <ActivityCard
          key={activity.id || `${activity.title}-${index}`}
          activity={activity}
          index={index}
        />
      ))}
    </div>
  );
}

function ActivityCard({ activity, index }) {
  const adultSelling = getSellingPrice(activity, "adult");
  const childSelling = getSellingPrice(activity, "child");
  const infantSelling = getSellingPrice(activity, "infant");

  const activityImage =
    getFileUrl(activity.mediaUploads?.[0]) ||
    getFileUrl(activity.media?.find(item => item.type === "image")) ||
    getFileUrl(activity.media?.find(item => item.thumbnailUrl)) ||
    "";

  return (
    <article className="overflow-hidden rounded-3xl border border-slate-200 bg-white  transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="relative h-44 bg-slate-100">
        {activityImage ? (
          <img
            src={activityImage}
            alt={activity.title || `Activity ${index + 1}`}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 text-slate-400">
            <Ticket size={34} />
          </div>
        )}

        {activity.featured && (
          <span className="absolute left-4 top-4 rounded-full bg-amber-400 px-3 py-1 text-xs font-semibold text-amber-950">
            Featured
          </span>
        )}

        {activity.activityType && (
          <span className="absolute bottom-4 left-4 rounded-full bg-white/95 px-3 py-1 text-xs font-semibold capitalize text-blue-700 ">
            {String(activity.activityType).replace(/_/g, " ")}
          </span>
        )}
      </div>

      <div className="space-y-4 p-5">
        <div>
          <h3 className="text-base font-semibold text-slate-950">
            {activity.title || activity.name || `Activity ${index + 1}`}
          </h3>

          {activity.description && (
            <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-600">
              {activity.description}
            </p>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <PublicRateCard
            label="Adult"
            selling={formatInr(adultSelling)}
          />

          <PublicRateCard
            label="Child"
            selling={formatInr(childSelling)}
          />

          {infantSelling > 0 && (
            <PublicRateCard
              label="Infant"
              selling={formatInr(infantSelling)}
            />
          )}
        </div>

        <div className="flex flex-wrap gap-2 text-xs text-slate-500">
          {activity.timing?.duration && (
            <span className="rounded-full bg-slate-100 px-3 py-1.5">
              {activity.timing.duration}
            </span>
          )}

          {activity.timing?.pickupRequired && (
            <span className="rounded-full bg-slate-100 px-3 py-1.5">
              Pickup included
            </span>
          )}

          {activity.timing?.startTime && (
            <span className="rounded-full bg-slate-100 px-3 py-1.5">
              Starts {activity.timing.startTime}
            </span>
          )}
        </div>

        {Array.isArray(activity.inclusions) && activity.inclusions.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Inclusions
            </p>

            <div className="flex flex-wrap gap-2">
              {activity.inclusions.slice(0, 4).map((item, i) => (
                <span
                  key={`${item}-${i}`}
                  className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700"
                >
                  {item}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </article>
  );
}

function PublicRateCard({ label, selling }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
      <div className="mb-2 flex items-center gap-2 text-slate-500">
        <IndianRupee size={14} />

        <p className="text-xs font-semibold uppercase tracking-wide">
          {label}
        </p>
      </div>

      <p className="text-lg font-bold text-emerald-700">
        {selling}
      </p>

      <p className="mt-1 text-[11px] text-slate-400">
        Starting price
      </p>
    </div>
  );
}

/* =========================
   CONTENT SECTIONS
========================= */

function ContentSection({ title, icon: Icon, items = [] }) {
  const activeItems = Array.isArray(items)
    ? items.filter(item => item.active !== false)
    : [];

  if (!activeItems.length) return null;

  return (
    <Surface
      icon={Icon}
      title={title}
      description={`Explore ${title.toLowerCase()} for this destination.`}
    >
      <div className="grid gap-5 md:grid-cols-2">
        {activeItems.map((item, index) => (
          <SimpleContentCard
            key={item.id || `${item.title || item.name}-${index}`}
            item={item}
            index={index}
          />
        ))}
      </div>
    </Surface>
  );
}

function SimpleContentCard({ item, index }) {
  const title = item.title || item.name || `Item ${index + 1}`;

  const image =
    getFileUrl(item.photos?.[0]) ||
    getFileUrl(item.image) ||
    getFileUrl(item.coverPhoto) ||
    getFileUrl(item.media?.[0]) ||
    "";

  const youtubeUrl = item.youtube || item.youtubeUrl || "";
  const mapLink = item.mapLink || item.googleMapLink || "";
  const sourceLink = item.sourceLink || "";

  return (
    <article className="overflow-hidden rounded-3xl border border-slate-200 bg-white  transition hover:-translate-y-0.5 hover:shadow-md">
      {image ? (
        <img
          src={image}
          alt={title}
          className="h-44 w-full object-cover"
        />
      ) : (
        <div className="flex h-32 w-full items-center justify-center bg-slate-100 text-slate-400">
          <ImageIcon size={28} />
        </div>
      )}

      <div className="p-5">
        <h3 className="text-base font-semibold text-slate-950">
          {title}
        </h3>

        {item.description && (
          <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-600">
            {item.description}
          </p>
        )}

        {(youtubeUrl || mapLink || sourceLink) && (
          <div className="mt-4 flex flex-wrap gap-2">
            {youtubeUrl && (
              <a
                href={youtubeUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-100"
              >
                <Youtube size={13} />
                Video
              </a>
            )}

            {mapLink && (
              <a
                href={mapLink}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-600 transition hover:bg-blue-100"
              >
                <MapPin size={13} />
                Map
              </a>
            )}

            {sourceLink && (
              <a
                href={sourceLink}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-200"
              >
                <ExternalLink size={13} />
                Source
              </a>
            )}
          </div>
        )}
      </div>
    </article>
  );
}

function MiniContentList({ title, items = [] }) {
  const activeItems = Array.isArray(items)
    ? items.filter(item => item.active !== false).slice(0, 5)
    : [];

  if (!activeItems.length) return null;

  return (
    <div className="rounded-2xl bg-white p-4 ">
      <h4 className="mb-3 text-sm font-semibold text-slate-950">
        {title}
      </h4>

      <div className="space-y-3">
        {activeItems.map((item, index) => {
          const itemTitle = item.title || item.name || item;
          const image =
            getFileUrl(item.photos?.[0]) ||
            getFileUrl(item.image) ||
            getFileUrl(item.coverPhoto) ||
            "";

          return (
            <div
              key={item.id || `${itemTitle}-${index}`}
              className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-2.5"
            >
              {image ? (
                <img
                  src={image}
                  alt={itemTitle}
                  className="h-12 w-12 shrink-0 rounded-xl object-cover"
                />
              ) : (
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white text-emerald-600">
                  <CheckCircle2 size={16} />
                </div>
              )}

              <div className="min-w-0">
                <p className="line-clamp-1 text-sm font-semibold text-slate-800">
                  {itemTitle}
                </p>

                {item.description && (
                  <p className="mt-0.5 line-clamp-2 text-xs leading-5 text-slate-500">
                    {item.description}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* =========================
   VIDEO
========================= */

function VideoCard({ video }) {
  const [play, setPlay] = useState(false);

  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white ">
      <div className="relative h-56 bg-slate-100">
        {play && video.embedUrl ? (
          <iframe
            src={video.embedUrl}
            title={video.title || "Destination video"}
            className="h-full w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <>
            {video.thumbnailUrl ? (
              <img
                src={video.thumbnailUrl}
                alt={video.title || "Destination video"}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center bg-slate-100 text-slate-400">
                <Youtube size={36} />
              </div>
            )}

            <button
              type="button"
              onClick={() => setPlay(true)}
              className="absolute inset-0 flex items-center justify-center bg-slate-950/20 text-white transition hover:bg-slate-950/30"
              aria-label="Play video"
            >
              <PlayCircle size={52} />
            </button>
          </>
        )}
      </div>

      <div className="p-4">
        <h3 className="text-sm font-semibold text-slate-950">
          {video.title || "Destination Video"}
        </h3>

        {video.caption && (
          <p className="mt-1 text-xs leading-5 text-slate-500">
            {video.caption}
          </p>
        )}
      </div>
    </div>
  );
}

/* =========================
   UI
========================= */

function Surface({ icon: Icon, title, description, children }) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5  sm:p-6">
      <div className="mb-5 flex items-start gap-3 border-b border-slate-100 pb-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
          <Icon size={20} />
        </div>

        <div>
          <h2 className="text-lg font-semibold text-slate-950">
            {title}
          </h2>

          {description && (
            <p className="mt-1 text-sm text-slate-500">
              {description}
            </p>
          )}
        </div>
      </div>

      {children}
    </section>
  );
}

function HeroStat({ icon: Icon, label, value }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/10 p-4 text-white backdrop-blur">
      <div className="mb-2 flex items-center gap-2 text-white/70">
        <Icon size={15} />
        <span className="text-[11px] font-semibold uppercase tracking-wide">
          {label}
        </span>
      </div>

      <p className="line-clamp-1 text-sm font-semibold">{value}</p>
    </div>
  );
}

function SidebarInfo({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl bg-slate-50 p-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-slate-600 ">
        <Icon size={17} />
      </div>

      <div>
        <p className="text-xs font-medium text-slate-500">{label}</p>
        <p className="mt-1 text-sm font-semibold text-slate-950">
          {value}
        </p>
      </div>
    </div>
  );
}

function EmptyBlock({ message }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">
      {message}
    </div>
  );
}

function DestinationDetailSkeleton() {
  return (
    <div>
      <div className="h-[460px] animate-pulse bg-slate-200" />

      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:px-8">
        <div className="space-y-6">
          <div className="h-64 animate-pulse rounded-3xl bg-white" />
          <div className="h-96 animate-pulse rounded-3xl bg-white" />
          <div className="h-96 animate-pulse rounded-3xl bg-white" />
        </div>

        <div className="h-80 animate-pulse rounded-3xl bg-white" />
      </div>
    </div>
  );
}