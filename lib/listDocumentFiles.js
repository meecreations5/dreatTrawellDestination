// lib/listCocumentFiles.js

import { getStorage, ref, listAll, getDownloadURL } from "firebase/storage";

export async function listDocumentFiles(documentId) {
  const storage = getStorage();
  const folderRef = ref(storage, `documents/${documentId}`);

  const result = await listAll(folderRef);

  return Promise.all(
    result.items.map(async (item) => ({
      name: item.name,
      url: await getDownloadURL(item)
    }))
  );
}
