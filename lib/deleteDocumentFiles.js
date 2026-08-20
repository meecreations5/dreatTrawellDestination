// lib/deleteDocumentFiles.js

import { getStorage, ref, deleteObject, listAll } from "firebase/storage";
import { db } from "./firebase";
import { doc, deleteDoc } from "firebase/firestore";

const storage = getStorage();

/**
 * Delete a single version file
 */
export async function deleteVersionFile(documentId, fileName) {
  const fileRef = ref(storage, `documents/${documentId}/${fileName}`);
  await deleteObject(fileRef);
}

/**
 * Delete entire document (ALL versions + Firestore doc)
 */
export async function deleteEntireDocument(documentId) {
  // 1️⃣ Delete all storage files
  const folderRef = ref(storage, `documents/${documentId}`);
  const result = await listAll(folderRef);

  await Promise.all(
    result.items.map(item => deleteObject(item))
  );

  // 2️⃣ Delete Firestore document
  await deleteDoc(doc(db, "documents", documentId));
}
