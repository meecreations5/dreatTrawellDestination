// admin/documents/checkFiles.js

"use client";

import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { listDocumentFiles } from "@/lib/listDocumentFiles";

export default function CheckFiles() {
    const [documents, setDocuments] = useState([]);
    const [selectedDocId, setSelectedDocId] = useState("");
    const [files, setFiles] = useState([]);
    const [error, setError] = useState("");

    // Load documents list
    useEffect(() => {
        const loadDocs = async () => {
            const snap = await getDocs(collection(db, "documents"));
            setDocuments(snap.docs.map(d => ({
                id: d.id,
                ...d.data()
            })));
        };
        loadDocs();
    }, []);

    // Load files when document changes
    useEffect(() => {
        if (!selectedDocId) return;

        const loadFiles = async () => {
            setError("");
            setFiles([]);
            try {
                const result = await listDocumentFiles(selectedDocId);
                setFiles(result);
            } catch (e) {
                setError(e.message || "Failed to load files");
            }
        };

        loadFiles();
    }, [selectedDocId]);

    return (
        <div className="bg-gray-100 p-4 rounded mt-8">
            <h2 className="font-semibold mb-3">
                Document Files (View / Download)
            </h2>

            {/* DOCUMENT SELECTOR */}
            <select
                value={selectedDocId}
                onChange={e => setSelectedDocId(e.target.value)}
                className="border p-2 rounded w-full mb-3"
            >
                <option value="">Select Document</option>
                {documents.map(doc => (
                    <option key={doc.id} value={doc.id}>
                        {doc.name} ({doc.type})
                    </option>
                ))}
            </select>

            {error && (
                <p className="text-red-600 text-sm">{error}</p>
            )}

            {/* FILE LIST */}
            {files.map(file => (
                <li
                    key={file.name}
                    className="bg-white p-2 rounded shadow flex justify-between items-center"
                >
                    <span className="truncate">{file.name}</span>

                    <div className="flex gap-3">
                        <a
                            href={file.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 underline"
                        >
                            View
                        </a>

                        <a
                            href={file.url}
                            download
                            className="text-green-600 underline"
                        >
                            Download
                        </a>

                        {/* DELETE VERSION */}
                        <button
                            onClick={async () => {
                                const confirm = window.confirm(
                                    `Delete file ${file.name}?`
                                );
                                if (!confirm) return;

                                const { deleteVersionFile } = await import(
                                    "@/lib/deleteDocumentFiles"
                                );

                                await deleteVersionFile(selectedDocId, file.name);

                                // Refresh file list
                                const refreshed = await listDocumentFiles(selectedDocId);
                                setFiles(refreshed);
                            }}
                            className="text-red-600 underline"
                        >
                            Delete
                        </button>
                    </div>
                </li>
            ))}


            {selectedDocId && (
                <button
                    onClick={async () => {
                        const confirm = window.confirm(
                            "This will delete ALL versions of this document. Continue?"
                        );
                        if (!confirm) return;

                        const { deleteEntireDocument } = await import(
                            "@/lib/deleteDocumentFiles"
                        );

                        await deleteEntireDocument(selectedDocId);

                        setSelectedDocId("");
                        setFiles([]);
                        alert("Document deleted");
                    }}
                    className="bg-red-600 text-white px-3 py-1 rounded text-sm mb-3"
                >
                    Delete Entire Document
                </button>
            )}

        </div>
    );
}
