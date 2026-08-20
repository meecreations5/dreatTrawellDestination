"use client";

import { useState } from "react";
import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject
} from "firebase/storage";
import { app } from "@/lib/firebase";

const storage = getStorage(app);

export default function MediaUploader({
  label,
  multiple = false,
  value,
  onChange,
  path
}) {
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  /* =========================
     UPLOAD
  ========================= */
  const upload = async (files) => {
    if (!files || files.length === 0) return;

    setUploading(true);
    const uploaded = [];

    for (const file of Array.from(files)) {
      const filePath = `${path}/${Date.now()}-${file.name}`;
      const fileRef = ref(storage, filePath);

      await uploadBytes(fileRef, file);
      const url = await getDownloadURL(fileRef);

      uploaded.push({
        url,
        path: filePath
      });
    }

    onChange(
      multiple
        ? [...(value || []), ...uploaded]
        : uploaded[0]
    );

    setUploading(false);
  };

  /* =========================
     DELETE
  ========================= */
  const removeImage = async (img, index) => {
    if (!img?.path) return;
    if (!confirm("Remove this image?")) return;

    try {
      setDeleting(true);
      await deleteObject(ref(storage, img.path));

      if (multiple) {
        const updated = [...(value || [])];
        updated.splice(index, 1);
        onChange(updated);
      } else {
        onChange(null);
      }
    } catch (err) {
      console.error("Delete failed", err);
      alert("You are not authorized to delete this file");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">{label}</label>

      {/* DROP ZONE */}
      <div
        onDrop={(e) => {
          e.preventDefault();
          upload(e.dataTransfer.files);
        }}
        onDragOver={(e) => e.preventDefault()}
        className="border-2 border-dashed rounded p-4 text-center text-sm text-gray-500 hover:border-blue-400"
      >
        Drag & drop images here
      </div>

      <input
        type="file"
        accept="image/*"
        multiple={multiple}
        onChange={(e) => upload(e.target.files)}
      />

      {uploading && (
        <p className="text-xs text-blue-600">Uploading…</p>
      )}
      {deleting && (
        <p className="text-xs text-red-600">Deleting…</p>
      )}

      {/* PREVIEW */}
      <div className="flex gap-3 flex-wrap">
        {multiple
          ? value?.map((img, i) => (
              <div key={i} className="relative group">
                <img
                  src={img.url}
                  className="h-20 w-20 object-cover rounded border cursor-pointer"
                  onClick={() => window.open(img.url, "_blank")}
                />
                <button
                  onClick={() => removeImage(img, i)}
                  className="absolute -top-2 -right-2 hidden group-hover:flex bg-red-600 text-white w-5 h-5 rounded-full text-xs items-center justify-center"
                >
                  ✕
                </button>
              </div>
            ))
          : value?.url && (
              <div className="relative group">
                <img
                  src={value.url}
                  className="h-28 w-28 object-cover rounded border cursor-pointer"
                  onClick={() => window.open(value.url, "_blank")}
                />
                <button
                  onClick={() => removeImage(value)}
                  className="absolute -top-2 -right-2 hidden group-hover:flex bg-red-600 text-white w-6 h-6 rounded-full text-xs items-center justify-center"
                >
                  ✕
                </button>
              </div>
            )}
      </div>
    </div>
  );
}
