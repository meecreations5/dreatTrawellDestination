"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import {
  addDoc,
  collection,
  getDocs,
  updateDoc,
  doc,
  serverTimestamp
} from "firebase/firestore";
import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL
} from "firebase/storage";
import { useAuth } from "@/hooks/useAuth";
import CheckFiles from "./CheckFiles";

const storage = getStorage();

/* =========================
   UI HELPERS
========================= */
function Surface({ title, children }) {
  return (
    <section className="bg-white rounded-xl border border-gray-100 p-6 space-y-4">
      <h2 className="text-sm font-semibold text-gray-800">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Input({ label, value, onChange, error, ...props }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-gray-600">
        {label}
      </label>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        {...props}
        className={`mui-input ${
          error
            ? "border-red-500 focus:border-red-500 focus:ring-red-200"
            : ""
        }`}
      />
      {error && (
        <p className="text-xs text-red-600">{error}</p>
      )}
    </div>
  );
}

export default function DocumentsPage() {
  const { user } = useAuth(true);

  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);

  /* CREATE */
  const [form, setForm] = useState({
    name: "",
    type: "companyProfile",
    file: null
  });
  const [errors, setErrors] = useState({});

  /* VERSION FILES */
  const [versionFiles, setVersionFiles] = useState({});

  /* =========================
     LOAD
  ========================= */
  const fetchDocs = async () => {
    const snap = await getDocs(collection(db, "documents"));
    setDocuments(
      snap.docs.map(d => ({ id: d.id, ...d.data() }))
    );
    setLoading(false);
  };

  useEffect(() => {
    fetchDocs();
  }, []);

  /* =========================
     HELPERS
  ========================= */
  const uploadVersion = async (documentId, version, file) => {
    const storageRef = ref(
      storage,
      `documents/${documentId}/v${version}-${file.name}`
    );

    await uploadBytes(storageRef, file);
    const url = await getDownloadURL(storageRef);

    await addDoc(
      collection(db, "documents", documentId, "versions"),
      {
        version,
        fileName: file.name,
        url,
        createdBy: user.email,
        createdAt: serverTimestamp()
      }
    );

    await updateDoc(doc(db, "documents", documentId), {
      currentVersion: version
    });
  };

  /* =========================
     CREATE DOCUMENT
  ========================= */
  const createDocument = async () => {
    const e = {};
    if (!form.name) e.name = "Document name required";
    if (!form.file) e.file = "File required";

    setErrors(e);
    if (Object.keys(e).length) return;

    const refDoc = await addDoc(collection(db, "documents"), {
      name: form.name,
      type: form.type,
      currentVersion: 1,
      active: true,
      createdBy: user.email,
      createdAt: serverTimestamp()
    });

    await uploadVersion(refDoc.id, 1, form.file);

    setForm({ name: "", type: "companyProfile", file: null });
    fetchDocs();
  };

  /* =========================
     UPDATE META
  ========================= */
  const saveMeta = async (docu, updates) => {
    await updateDoc(doc(db, "documents", docu.id), updates);
    fetchDocs();
  };

  /* =========================
     NEW VERSION
  ========================= */
  const uploadNewVersion = async docu => {
    const file = versionFiles[docu.id];
    if (!file) return;

    await uploadVersion(
      docu.id,
      docu.currentVersion + 1,
      file
    );

    setVersionFiles(prev => {
      const c = { ...prev };
      delete c[docu.id];
      return c;
    });

    fetchDocs();
  };

  if (!user || !user.isAdmin) return null;

  return (
    <main className="p-6 max-w-6xl mx-auto space-y-8">

      {/* HEADER */}
      <div>
        <h1 className="text-xl font-semibold text-gray-800">
          Documents
        </h1>
        <p className="text-sm text-gray-500">
          Version-controlled document repository
        </p>
      </div>

      {/* CREATE */}
      <Surface title="Create Document">
        <Input
          label="Document Name"
          value={form.name}
          error={errors.name}
          onChange={v =>
            setForm({ ...form, name: v })
          }
        />

        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-600">
            Document Type
          </label>
          <select
            className="mui-input"
            value={form.type}
            onChange={e =>
              setForm({ ...form, type: e.target.value })
            }
          >
            <option value="companyProfile">
              Company Profile
            </option>
            <option value="pitchDeck">Pitch Deck</option>
            <option value="brochure">Brochure</option>
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-600">
            Upload File
          </label>
          <input
            type="file"
            accept=".pdf,.ppt,.pptx"
            onChange={e =>
              setForm({
                ...form,
                file: e.target.files[0]
              })
            }
            className="mui-input"
          />
          {errors.file && (
            <p className="text-xs text-red-600">
              {errors.file}
            </p>
          )}
        </div>

        <div className="pt-2">
          <button
            onClick={createDocument}
            className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm hover:bg-blue-700"
          >
            Create (v1)
          </button>
        </div>
      </Surface>

      {/* LIST */}
      <Surface title="Document Repository">
        {loading && (
          <p className="text-sm text-gray-500">
            Loading…
          </p>
        )}

        <div className="space-y-4">
          {documents.map(d => (
            <div
              key={d.id}
              className="border border-gray-100 rounded-lg p-4 space-y-3"
            >
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <input
                    defaultValue={d.name}
                    onBlur={e =>
                      saveMeta(d, {
                        name: e.target.value
                      })
                    }
                    className="font-medium text-gray-800 border-b focus:outline-none"
                  />

                  <select
                    defaultValue={d.type}
                    onChange={e =>
                      saveMeta(d, {
                        type: e.target.value
                      })
                    }
                    className="mui-input text-xs max-w-[200px]"
                  >
                    <option value="companyProfile">
                      Company Profile
                    </option>
                    <option value="pitchDeck">
                      Pitch Deck
                    </option>
                    <option value="brochure">
                      Brochure
                    </option>
                  </select>

                  <p className="text-xs text-gray-500">
                    Current Version: v{d.currentVersion}
                  </p>
                </div>

                <button
                  onClick={() =>
                    saveMeta(d, {
                      active: !d.active
                    })
                  }
                  className={`px-3 py-1 rounded text-xs ${
                    d.active
                      ? "bg-green-100 text-green-700"
                      : "bg-gray-200 text-gray-600"
                  }`}
                >
                  {d.active ? "Enabled" : "Disabled"}
                </button>
              </div>

              <div className="flex gap-3 items-center">
                <input
                  type="file"
                  accept=".pdf,.ppt,.pptx"
                  onChange={e =>
                    setVersionFiles(prev => ({
                      ...prev,
                      [d.id]: e.target.files[0]
                    }))
                  }
                  className="text-sm"
                />
                <button
                  onClick={() => uploadNewVersion(d)}
                  className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700"
                >
                  Upload New Version
                </button>
              </div>
            </div>
          ))}
        </div>
      </Surface>

      <CheckFiles />
    </main>
  );
}
