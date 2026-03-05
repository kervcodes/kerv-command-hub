import 'server-only';

import {
  createAdminClient,
  listAll,
  DATABASE_ID,
  PANELS_COLLECTION_ID,
  CATEGORIES_COLLECTION_ID,
  LINKS_COLLECTION_ID,
  LIBRARY_COLLECTION_ID,
  Query,
} from '@/lib/appwrite';

export async function getPanels() {
  const { databases } = createAdminClient();

  try {
    const docs = await listAll(databases, DATABASE_ID, PANELS_COLLECTION_ID);

    return docs
      .sort((a, b) => Number(a.order ?? 0) - Number(b.order ?? 0))
      .map((doc) => (doc.name as string)?.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

export async function getCategories() {
  const { databases } = createAdminClient();

  const allCategories = await listAll(databases, DATABASE_ID, CATEGORIES_COLLECTION_ID, [
    Query.orderAsc('order'),
  ]);

  const allLinks = await listAll(databases, DATABASE_ID, LINKS_COLLECTION_ID, [
    Query.orderAsc('order'),
  ]);

  return allCategories.map((cat) => ({
    id: cat.$id,
    name: cat.name as string,
    panel: cat.panel as string,
    order: cat.order as number,
    links: allLinks
      .filter((link) => link.categoryId === cat.$id)
      .map((link) => ({
        id: link.$id,
        name: link.name as string,
        url: link.url as string,
        description: (link.description as string) || null,
        categoryId: link.categoryId as string,
        order: link.order as number,
      })),
  }));
}

export async function getLibraryItems() {
  const { databases } = createAdminClient();

  const docs = await listAll(databases, DATABASE_ID, LIBRARY_COLLECTION_ID, [
    Query.orderAsc('folderOrder'),
    Query.orderAsc('order'),
  ]);

  return docs.map((doc) => ({
    id: doc.$id,
    name: doc.name as string,
    fileId: doc.fileId as string,
    folder: doc.folder as string,
    order: doc.order as number,
    folderOrder: doc.folderOrder as number,
    viewUrl: `/api/file?id=${doc.fileId as string}`,
  }));
}
