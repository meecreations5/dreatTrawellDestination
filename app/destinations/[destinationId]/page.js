"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import ImageLightbox from "@/components/ui/ImageLightbox";

export default function DestinationPublicPage() {
  const { destinationId } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lightbox, setLightbox] = useState(null);

  useEffect(() => {
    if (!destinationId) return;
    const load = async () => {
      try {
        const snap = await getDoc(
          doc(db, "destinations", destinationId)
        );
        setData(snap.exists() ? snap.data() : null);
      } catch (err) {
        console.error(err);
        setData(null);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [destinationId]);

  if (loading) return <DestinationSkeleton />;
  if (!data)
    return (
      <p className="text-center text-gray-500 my-10">
        Destination not found
      </p>
    );

  const styles = data.travelStyles || {};

  return (
    <main className="bg-gray-50 pt-10 pb-20">
      <div className="max-w-7xl mx-auto px-6 space-y-10">

        {/* HERO DETAIL */}
        <div className="relative rounded-2xl overflow-hidden shadow-xl">
          {data.coverPhoto?.url && (
            <img
              src={data.coverPhoto.url}
              alt={data.name}
              className="w-full object-cover h-96"
            />
          )}
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
          <div className="absolute bottom-6 left-8 text-white space-y-2">
            <h1 className="text-4xl font-bold">{data.name}</h1>
            <div className="flex gap-3">
              {styles.family && <HeroChip icon="👨‍👩‍👧‍👦" />}
              {styles.couple && <HeroChip icon="💑" />}
              {styles.luxury && <HeroChip icon="✨" />}
              {styles.adventure && <HeroChip icon="🏔️" />}
            </div>
          </div>
        </div>

        {/* DESCRIPTION CARD */}
        <CardSection>
          <p className="text-gray-700 leading-relaxed text-lg">
            {data.description || data.shortDescription}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-4 text-sm text-gray-600">
            {data.bestTimeToVisit && (
              <InfoBadge icon="🗓" text={`Best time: ${data.bestTimeToVisit}`} />
            )}
            {data.idealTripDuration && (
              <InfoBadge icon="⏱️" text={`Duration: ${data.idealTripDuration}`} />
            )}
            {data.destinationType && (
              <InfoBadge icon="🌍" text={data.destinationType} />
            )}
          </div>
        </CardSection>

        {/* GALLERY */}
        {Array.isArray(data.gallery) && data.gallery.length > 0 && (
          <CardSection title="Gallery">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {data.gallery.map((img, i) => (
                <img
                  key={i}
                  src={img.url}
                  className="h-40 w-full object-cover rounded-lg cursor-pointer hover:scale-105 transition"
                  onClick={() => setLightbox(img.url)}
                />
              ))}
            </div>
          </CardSection>
        )}

        {/* SECTIONS: Activities / Attractions / Places / Food */}
        <ContentGrid
          title="Activities"
          items={data.activities}
          onImageClick={setLightbox}
        />
        <ContentGrid
          title="Attractions"
          items={data.attractions}
          onImageClick={setLightbox}
        />
        <ContentGrid
          title="Places to Visit"
          items={data.placesToVisit}
          onImageClick={setLightbox}
        />
        <ContentGrid
          title="Food Culture"
          items={data.foodCulture}
          onImageClick={setLightbox}
        />

        {/* MAP (if present on first block) */}
        {data.mapLink && (
          <CardSection title="Map">
            <iframe
              src={convertToEmbed(data.mapLink)}
              className="w-full h-64 rounded-lg border"
              loading="lazy"
            />
          </CardSection>
        )}

        {/* CHANNELS */}
        {data.channels?.length > 0 && (
          <CardSection title="Official Channels">
            <div className="flex flex-wrap gap-3">
              {data.channels.map((c, i) => (
                <a
                  key={i}
                  href={c.url}
                  target="_blank"
                  className="text-blue-600 font-medium hover:underline"
                >
                  {c.label}
                </a>
              ))}
            </div>
          </CardSection>
        )}

        {/* BOOKING PARTNERS */}
        {data.bookingPartners?.length > 0 && (
          <CardSection title="Booking Partners">
            <div className="grid md:grid-cols-2 gap-6">
              {data.bookingPartners.map((b, i) => (
                <div
                  key={i}
                  className="bg-white rounded-lg p-4 shadow"
                >
                  <p className="font-medium">{b.name}</p>
                  {b.website && (
                    <a
                      href={b.website}
                      target="_blank"
                      className="text-blue-600 hover:underline text-sm"
                    >
                      Visit Website
                    </a>
                  )}
                </div>
              ))}
            </div>
          </CardSection>
        )}
      </div>

      <ImageLightbox src={lightbox} onClose={() => setLightbox(null)} />
    </main>
  );
}

/* ===========================
   REUSABLE COMPONENTS
=========================== */

function HeroChip({ icon }) {
  return (
    <span className="bg-white/30 text-white text-sm px-3 py-1 rounded-full backdrop-blur">
      {icon}
    </span>
  );
}

function CardSection({ children, title }) {
  return (
    <section className="bg-white rounded-lg p-6 shadow-lg space-y-4">
      {title && <h2 className="text-2xl font-semibold text-gray-900">{title}</h2>}
      {children}
    </section>
  );
}

function InfoBadge({ icon, text }) {
  return (
    <div className="flex items-center gap-2 text-gray-700 bg-gray-100 px-4 py-2 rounded-lg">
      <span className="text-lg">{icon}</span>
      <span className="font-medium">{text}</span>
    </div>
  );
}

function ContentGrid({ title, items, onImageClick }) {
  if (!items || items.length === 0) return null;
  return (
    <CardSection title={title}>
      <div className="grid md:grid-cols-3 gap-6">
        {items.map((item, idx) => (
          <div key={idx} className="space-y-3">
            <p className="font-semibold text-lg">{item.name}</p>

            {item.photos?.[0]?.url && (
              <img
                src={item.photos[0].url}
                className="h-40 w-full object-cover rounded-lg cursor-pointer hover:scale-105 transition"
                onClick={() => onImageClick(item.photos[0].url)}
              />
            )}

            {item.description && (
              <p className="text-sm text-gray-600">{item.description}</p>
            )}

            {item.mapLink && (
              <iframe
                src={convertToEmbed(item.mapLink)}
                className="w-full h-40 rounded-lg border"
                loading="lazy"
              />
            )}
          </div>
        ))}
      </div>
    </CardSection>
  );
}

function convertToEmbed(url) {
  if (url.includes("google.com/maps")) {
    return url.replace("/maps/", "/maps/embed/");
  }
  return url;
}

/* ===========================
   SKELETON LOADER
=========================== */
function DestinationSkeleton() {
  return (
    <div className="animate-pulse space-y-6 p-6">
      <div className="h-96 bg-gray-200 rounded-xl" />
      <div className="h-8 w-2/3 bg-gray-200 rounded" />
      <div className="h-6 w-1/3 bg-gray-200 rounded" />
      <div className="grid md:grid-cols-3 gap-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="h-48 bg-gray-200 rounded-lg"
          />
        ))}
      </div>
    </div>
  );
}
