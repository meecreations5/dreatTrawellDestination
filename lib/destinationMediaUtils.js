function createId(prefix = "id") {
  if (
    typeof window !== "undefined" &&
    window.crypto &&
    typeof window.crypto.randomUUID === "function"
  ) {
    return `${prefix}_${window.crypto.randomUUID()}`;
  }

  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

export function extractYouTubeId(url = "") {
  if (!url || typeof url !== "string") return "";

  const patterns = [
    /youtube\.com\/watch\?v=([^&]+)/,
    /youtube\.com\/embed\/([^?&]+)/,
    /youtu\.be\/([^?&]+)/,
    /youtube\.com\/shorts\/([^?&]+)/
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match?.[1]) return match[1];
  }

  return "";
}

export function getYouTubeEmbedUrl(youtubeId = "") {
  if (!youtubeId) return "";
  return `https://www.youtube.com/embed/${youtubeId}`;
}

export function getYouTubeThumbnailUrl(youtubeId = "") {
  if (!youtubeId) return "";
  return `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`;
}

export function createImageMediaItem(fileData = {}) {
  return {
    id: createId("media"),
    type: "image",
    source: "upload",

    url: fileData.url || "",
    path: fileData.path || "",
    thumbnailUrl: fileData.thumbnailUrl || fileData.url || "",

    title: fileData.title || "",
    caption: fileData.caption || "",
    altText: fileData.altText || "",

    order: fileData.order || 1,
    featured: Boolean(fileData.featured),
    active: fileData.active ?? true,

    createdAt: new Date().toISOString()
  };
}

export function createUploadedVideoMediaItem(fileData = {}) {
  return {
    id: createId("media"),
    type: "video",
    source: "upload",

    url: fileData.url || "",
    path: fileData.path || "",
    thumbnailUrl: fileData.thumbnailUrl || "",

    title: fileData.title || "",
    caption: fileData.caption || "",
    altText: "",

    order: fileData.order || 1,
    featured: Boolean(fileData.featured),
    active: fileData.active ?? true,

    createdAt: new Date().toISOString()
  };
}

export function createYouTubeMediaItem(youtubeUrl = "", extra = {}) {
  const youtubeId = extractYouTubeId(youtubeUrl);

  return {
    id: createId("media"),
    type: "video",
    source: "youtube",

    youtubeUrl,
    youtubeId,
    embedUrl: getYouTubeEmbedUrl(youtubeId),
    thumbnailUrl: getYouTubeThumbnailUrl(youtubeId),

    title: extra.title || "",
    caption: extra.caption || "",
    altText: "",

    order: extra.order || 1,
    featured: Boolean(extra.featured),
    active: extra.active ?? true,

    createdAt: new Date().toISOString()
  };
}

export function normalizeMediaGallery(items = []) {
  if (!Array.isArray(items)) return [];

  return items
    .filter(Boolean)
    .map((item, index) => ({
      id: item.id || createId("media"),
      type: item.type || "image",
      source: item.source || "upload",

      url: item.url || "",
      path: item.path || "",
      thumbnailUrl: item.thumbnailUrl || "",

      youtubeUrl: item.youtubeUrl || "",
      youtubeId: item.youtubeId || "",
      embedUrl: item.embedUrl || "",

      title: item.title || "",
      caption: item.caption || "",
      altText: item.altText || "",

      order: Number(item.order || index + 1),
      featured: Boolean(item.featured),
      active: item.active ?? true,

      createdAt: item.createdAt || "",
      updatedAt: item.updatedAt || ""
    }))
    .sort((a, b) => a.order - b.order);
}