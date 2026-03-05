'use server';

import {
  createAdminClient,
  listAll,
  DATABASE_ID,
  PANELS_COLLECTION_ID,
  CATEGORIES_COLLECTION_ID,
  LINKS_COLLECTION_ID,
  LIBRARY_COLLECTION_ID,
  PDF_BUCKET_ID,
  ID,
  Query,
  type AppDocument,
} from '@/lib/appwrite';
import { InputFile } from 'node-appwrite/file';
import { revalidatePath } from 'next/cache';

function getErrorCode(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null) return undefined;

  const value = error as {
    code?: unknown;
    status?: unknown;
    response?: { status?: unknown };
  };

  const code =
    typeof value.code === 'number'
      ? value.code
      : typeof value.status === 'number'
        ? value.status
        : typeof value.response?.status === 'number'
          ? value.response.status
          : undefined;

  return code;
}

function isCollectionNotFound(error: unknown) {
  return getErrorCode(error) === 404;
}

function isConflict(error: unknown) {
  return getErrorCode(error) === 409;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;

  if (typeof error !== 'object' || error === null) return '';

  const value = error as { message?: unknown };
  return typeof value.message === 'string' ? value.message : '';
}

function hasInvalidOrderTypeError(error: unknown) {
  const message = getErrorMessage(error);
  return (
    message.includes('Attribute "order" has invalid type') ||
    message.includes("Attribute 'order' has invalid type")
  );
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function ensurePanelsCollection(databases: ReturnType<typeof createAdminClient>['databases']) {
  try {
    await databases.getCollection(DATABASE_ID, PANELS_COLLECTION_ID);
    return;
  } catch (error) {
    if (!isCollectionNotFound(error)) throw error;
  }

  try {
    await databases.createCollection(DATABASE_ID, PANELS_COLLECTION_ID, 'Panels');
  } catch (error) {
    if (!isConflict(error)) throw error;
  }

  try {
    await databases.createStringAttribute({
      databaseId: DATABASE_ID,
      collectionId: PANELS_COLLECTION_ID,
      key: 'name',
      size: 255,
      required: true,
    });
  } catch (error) {
    if (!isConflict(error)) throw error;
  }

  try {
    await databases.createIntegerAttribute({
      databaseId: DATABASE_ID,
      collectionId: PANELS_COLLECTION_ID,
      key: 'order',
      required: false,
      min: 0,
      max: 100000,
      xdefault: 0,
    });
  } catch (error) {
    if (!isConflict(error)) throw error;
  }

  await wait(1500);
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export async function getCategories() {
  const { databases } = createAdminClient();

  const allCategories = await listAll(databases, DATABASE_ID, CATEGORIES_COLLECTION_ID, [
    Query.orderAsc('order'),
  ]);

  const allLinks = await listAll(databases, DATABASE_ID, LINKS_COLLECTION_ID, [
    Query.orderAsc('order'),
  ]);

  const result = allCategories.map((cat) => ({
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

  // Ensure complete serialization by using JSON round-trip to strip non-serializable properties
  return JSON.parse(JSON.stringify(result));
}

export async function createPanel(panelName: string) {
  const name = panelName.trim();
  if (!name) {
    return { error: 'Panel name is required' };
  }

  const { databases } = createAdminClient();

  try {
    await ensurePanelsCollection(databases);

    const existingPanels = await listAll(databases, DATABASE_ID, PANELS_COLLECTION_ID);

    const panelExists = existingPanels.some(
      (panel) => ((panel.name as string) || '').toLowerCase() === name.toLowerCase(),
    );
    if (panelExists) {
      return { error: 'Panel already exists' };
    }

    const maxOrder = existingPanels.reduce((max, panel) => {
      const panelOrder = Number(panel.order ?? 0);
      return panelOrder > max ? panelOrder : max;
    }, -1);

    let lastError: unknown = null;
    let includeOrder = true;

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const payload = includeOrder ? { name, order: maxOrder + 1 } : { name };

        await databases.createDocument(DATABASE_ID, PANELS_COLLECTION_ID, ID.unique(), payload);
        lastError = null;
        break;
      } catch (error) {
        if (includeOrder && hasInvalidOrderTypeError(error)) {
          includeOrder = false;
          lastError = error;
          continue;
        }

        lastError = error;
        await wait(800);
      }
    }

    if (lastError) {
      throw lastError;
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to create panel';
    return { error: message };
  }

  revalidatePath('/');
  return { success: true };
}

export async function createCategory(formData: FormData) {
  const name = formData.get('name') as string;
  const panel = (formData.get('panel') as string) || 'Work';
  if (!name) return;

  const { databases } = createAdminClient();

  const last = await databases.listDocuments(DATABASE_ID, CATEGORIES_COLLECTION_ID, [
    Query.equal('panel', [panel]),
    Query.orderDesc('order'),
    Query.limit(1),
  ]);
  const order = last.documents.length > 0 ? (last.documents[0].order as number) + 1 : 0;

  await databases.createDocument(DATABASE_ID, CATEGORIES_COLLECTION_ID, ID.unique(), {
    name,
    panel,
    order,
  });

  revalidatePath('/');
}

export async function deleteCategory(id: string) {
  const { databases } = createAdminClient();

  // Delete all child links first (no cascade in Appwrite)
  const links = await listAll(databases, DATABASE_ID, LINKS_COLLECTION_ID, [
    Query.equal('categoryId', [id]),
  ]);
  await Promise.all(
    links.map((link) => databases.deleteDocument(DATABASE_ID, LINKS_COLLECTION_ID, link.$id)),
  );

  await databases.deleteDocument(DATABASE_ID, CATEGORIES_COLLECTION_ID, id);
  revalidatePath('/');
}

export async function deletePanel(panelName: string) {
  const { databases } = createAdminClient();

  try {
    const panelDocs = await listAll(databases, DATABASE_ID, PANELS_COLLECTION_ID, [
      Query.equal('name', [panelName]),
    ]);

    await Promise.all(
      panelDocs.map((panelDoc) =>
        databases.deleteDocument(DATABASE_ID, PANELS_COLLECTION_ID, panelDoc.$id),
      ),
    );
  } catch {
    // Panels collection may not exist in older setups.
  }

  const categories = await listAll(databases, DATABASE_ID, CATEGORIES_COLLECTION_ID, [
    Query.equal('panel', [panelName]),
  ]);

  for (const cat of categories) {
    const links = await listAll(databases, DATABASE_ID, LINKS_COLLECTION_ID, [
      Query.equal('categoryId', [cat.$id]),
    ]);
    await Promise.all(
      links.map((link) => databases.deleteDocument(DATABASE_ID, LINKS_COLLECTION_ID, link.$id)),
    );
    await databases.deleteDocument(DATABASE_ID, CATEGORIES_COLLECTION_ID, cat.$id);
  }

  revalidatePath('/');
}

export async function moveCategoryToPanel(categoryId: string, panelName: string) {
  const id = categoryId.trim();
  const panel = panelName.trim();

  if (!id || !panel) {
    return { error: 'Category and panel are required' };
  }

  const { databases } = createAdminClient();

  try {
    const category = (await databases.getDocument(
      DATABASE_ID,
      CATEGORIES_COLLECTION_ID,
      id,
    )) as AppDocument;

    if ((category.panel as string) === panel) {
      return { success: true };
    }

    const lastInPanel = await databases.listDocuments(DATABASE_ID, CATEGORIES_COLLECTION_ID, [
      Query.equal('panel', [panel]),
      Query.orderDesc('order'),
      Query.limit(1),
    ]);

    const nextOrder =
      lastInPanel.documents.length > 0 ? (lastInPanel.documents[0].order as number) + 1 : 0;

    await databases.updateDocument(DATABASE_ID, CATEGORIES_COLLECTION_ID, id, {
      panel,
      order: nextOrder,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to move folder';
    return { error: message };
  }

  revalidatePath('/');
  return { success: true };
}

// ---------------------------------------------------------------------------
// Links
// ---------------------------------------------------------------------------

export async function createLink(formData: FormData) {
  const name = formData.get('name') as string;
  const url = formData.get('url') as string;
  const description = formData.get('description') as string | null;
  const categoryId = formData.get('categoryId') as string;
  if (!name || !url || !categoryId) return;

  const { databases } = createAdminClient();

  const last = await databases.listDocuments(DATABASE_ID, LINKS_COLLECTION_ID, [
    Query.equal('categoryId', [categoryId]),
    Query.orderDesc('order'),
    Query.limit(1),
  ]);
  const order = last.documents.length > 0 ? (last.documents[0].order as number) + 1 : 0;

  await databases.createDocument(DATABASE_ID, LINKS_COLLECTION_ID, ID.unique(), {
    name,
    url,
    description: description || '',
    categoryId,
    source: 'manual',
    order,
  });

  revalidatePath('/');
}

export async function updateLink(formData: FormData) {
  const id = formData.get('id') as string;
  const name = formData.get('name') as string;
  const url = formData.get('url') as string;
  const description = formData.get('description') as string | null;
  const categoryId = formData.get('categoryId') as string;
  if (!id || !name || !url || !categoryId) return;

  const { databases } = createAdminClient();

  await databases.updateDocument(DATABASE_ID, LINKS_COLLECTION_ID, id, {
    name,
    url,
    description: description || '',
    categoryId,
  });

  revalidatePath('/');
}

export async function deleteLink(id: string) {
  const { databases } = createAdminClient();
  await databases.deleteDocument(DATABASE_ID, LINKS_COLLECTION_ID, id);
  revalidatePath('/');
}

export async function updateCategoryOrder(updates: { id: string; order: number }[]) {
  const { databases } = createAdminClient();
  await Promise.all(
    updates.map((u) =>
      databases.updateDocument(DATABASE_ID, CATEGORIES_COLLECTION_ID, u.id, { order: u.order }),
    ),
  );
}

export async function updateLinkOrder(
  updates: { id: string; order: number; categoryId: string }[],
) {
  const { databases } = createAdminClient();
  await Promise.all(
    updates.map((u) =>
      databases.updateDocument(DATABASE_ID, LINKS_COLLECTION_ID, u.id, {
        order: u.order,
        categoryId: u.categoryId,
      }),
    ),
  );
}

// ---------------------------------------------------------------------------
// Bookmark Import
// ---------------------------------------------------------------------------

export async function importBookmarks(htmlContent: string) {
  type BookmarkNode =
    | { type: 'folder'; name: string; children: BookmarkNode[] }
    | { type: 'link'; name: string; url: string };

  function parseBookmarkHtml(html: string): BookmarkNode[] {
    const tokenRegex =
      /<DL>|<\/DL>|<H3[^>]*>([\s\S]*?)<\/H3>|<A\s[^>]*?HREF="([^"]*)"[^>]*>([\s\S]*?)<\/A>/gi;

    const root: BookmarkNode[] = [];
    const stack: BookmarkNode[][] = [root];
    let pendingFolder: { type: 'folder'; name: string; children: BookmarkNode[] } | null = null;
    let match: RegExpExecArray | null;

    while ((match = tokenRegex.exec(html)) !== null) {
      const token = match[0];

      if (match[1] !== undefined) {
        pendingFolder = { type: 'folder', name: match[1].trim(), children: [] };
        stack[stack.length - 1].push(pendingFolder);
      } else if (match[2] !== undefined) {
        stack[stack.length - 1].push({ type: 'link', name: (match[3] || '').trim(), url: match[2] });
      } else if (/^<DL>/i.test(token)) {
        if (pendingFolder) {
          stack.push(pendingFolder.children);
          pendingFolder = null;
        } else {
          stack.push(stack[stack.length - 1]);
        }
      } else if (/^<\/DL>/i.test(token)) {
        if (stack.length > 1) stack.pop();
      }
    }

    return root;
  }

  const { databases } = createAdminClient();
  const tree = parseBookmarkHtml(htmlContent);
  let importedCount = 0;
  let skippedCount = 0;

  async function insertLink(url: string, name: string, categoryId: string) {
    try {
      // Check for duplicate by URL
      const existing = await databases.listDocuments(DATABASE_ID, LINKS_COLLECTION_ID, [
        Query.equal('url', [url]),
        Query.limit(1),
      ]);

      if (existing.documents.length > 0) {
        await databases.updateDocument(DATABASE_ID, LINKS_COLLECTION_ID, existing.documents[0].$id, {
          name,
          categoryId,
          source: 'chrome',
        });
      } else {
        const lastLink = await databases.listDocuments(DATABASE_ID, LINKS_COLLECTION_ID, [
          Query.equal('categoryId', [categoryId]),
          Query.orderDesc('order'),
          Query.limit(1),
        ]);
        const nextOrder = lastLink.documents.length > 0 ? (lastLink.documents[0].order as number) + 1 : 0;

        await databases.createDocument(DATABASE_ID, LINKS_COLLECTION_ID, ID.unique(), {
          name,
          url,
          description: '',
          categoryId,
          source: 'chrome',
          order: nextOrder,
        });
      }
      importedCount++;
    } catch (e) {
      console.error(`[importBookmarks] Failed to upsert link "${name}" (${url}):`, e);
      skippedCount++;
    }
  }

  async function getOrCreateCategory(categoryName: string, panelName: string) {
    const existing = await databases.listDocuments(DATABASE_ID, CATEGORIES_COLLECTION_ID, [
      Query.equal('name', [categoryName]),
      Query.equal('panel', [panelName]),
      Query.limit(1),
    ]);

    if (existing.documents.length > 0) return existing.documents[0];

    const last = await databases.listDocuments(DATABASE_ID, CATEGORIES_COLLECTION_ID, [
      Query.equal('panel', [panelName]),
      Query.orderDesc('order'),
      Query.limit(1),
    ]);
    const order = last.documents.length > 0 ? (last.documents[0].order as number) + 1 : 0;

    return databases.createDocument(DATABASE_ID, CATEGORIES_COLLECTION_ID, ID.unique(), {
      name: categoryName,
      panel: panelName,
      order,
    });
  }

  function collectLinks(nodes: BookmarkNode[]): { name: string; url: string }[] {
    const links: { name: string; url: string }[] = [];
    for (const node of nodes) {
      if (node.type === 'link') {
        links.push({ name: node.name, url: node.url });
      } else {
        links.push(...collectLinks(node.children));
      }
    }
    return links;
  }

  const totalLinksInTree = collectLinks(tree).length;
  console.log(
    `[importBookmarks] Parsed tree: ${tree.length} top-level nodes, ${totalLinksInTree} total links found`,
  );

  for (const topNode of tree) {
    if (topNode.type === 'link') {
      const cat = await getOrCreateCategory('Uncategorized', 'Imported');
      await insertLink(topNode.url, topNode.name, cat.$id);
      continue;
    }

    const panelName = topNode.name;
    const subFolders = topNode.children.filter((n) => n.type === 'folder') as Extract<
      BookmarkNode,
      { type: 'folder' }
    >[];
    const directLinks = topNode.children.filter((n) => n.type === 'link') as Extract<
      BookmarkNode,
      { type: 'link' }
    >[];

    if (subFolders.length === 0 && directLinks.length > 0) {
      const cat = await getOrCreateCategory(panelName, 'Imported');
      for (const link of directLinks) {
        await insertLink(link.url, link.name, cat.$id);
      }
      continue;
    }

    for (const sub of subFolders) {
      const cat = await getOrCreateCategory(sub.name, panelName);
      const links = collectLinks(sub.children);
      for (const link of links) {
        await insertLink(link.url, link.name, cat.$id);
      }
    }

    if (directLinks.length > 0) {
      const cat = await getOrCreateCategory('Uncategorized', panelName);
      for (const link of directLinks) {
        await insertLink(link.url, link.name, cat.$id);
      }
    }
  }

  console.log(`[importBookmarks] Done: ${importedCount} imported, ${skippedCount} skipped`);
  revalidatePath('/');
  return { imported: importedCount, skipped: skippedCount, totalFound: totalLinksInTree };
}

// ---------------------------------------------------------------------------
// Library (PDF uploads via Appwrite Storage)
// ---------------------------------------------------------------------------

export async function getLibraryItems() {
  const { databases } = createAdminClient();

  const docs = await listAll(databases, DATABASE_ID, LIBRARY_COLLECTION_ID, [
    Query.orderAsc('folderOrder'),
    Query.orderAsc('order'),
  ]);

  const result = docs.map((doc) => ({
    id: doc.$id,
    name: doc.name as string,
    fileId: doc.fileId as string,
    folder: doc.folder as string,
    order: doc.order as number,
    folderOrder: doc.folderOrder as number,
    viewUrl: `/api/file?id=${doc.fileId as string}`,
  }));

  // Ensure complete serialization by using JSON round-trip to strip non-serializable properties
  return JSON.parse(JSON.stringify(result));
}

export async function uploadPdfs(formData: FormData) {
  const files = formData.getAll('files') as File[];
  const folder = (formData.get('folder') as string)?.trim() || 'Uploads';
  if (files.length === 0 || !files[0]?.name) return { uploaded: 0 };

  const { storage, databases } = createAdminClient();
  let uploaded = 0;

  for (const file of files) {
    if (!file.name || file.size === 0) continue;

    // Upload to Appwrite Storage
    const buffer = Buffer.from(await file.arrayBuffer());
    const inputFile = InputFile.fromBuffer(buffer, file.name);
    const storageFile = await storage.createFile(PDF_BUCKET_ID, ID.unique(), inputFile);

    // Determine folder order
    const existingInFolder = await databases.listDocuments(DATABASE_ID, LIBRARY_COLLECTION_ID, [
      Query.equal('folder', [folder]),
      Query.orderDesc('order'),
      Query.limit(1),
    ]);

    let folderOrder = 0;
    let nextOrder = 0;

    if (existingInFolder.documents.length > 0) {
      folderOrder = existingInFolder.documents[0].folderOrder as number;
      nextOrder = (existingInFolder.documents[0].order as number) + 1;
    } else {
      // New folder — get max folderOrder
      const allItems = await databases.listDocuments(DATABASE_ID, LIBRARY_COLLECTION_ID, [
        Query.orderDesc('folderOrder'),
        Query.limit(1),
      ]);
      folderOrder =
        allItems.documents.length > 0 ? (allItems.documents[0].folderOrder as number) + 1 : 0;
    }

    await databases.createDocument(DATABASE_ID, LIBRARY_COLLECTION_ID, ID.unique(), {
      name: file.name.replace(/\.pdf$/i, ''),
      fileId: storageFile.$id,
      folder,
      order: nextOrder,
      folderOrder,
    });

    uploaded++;
  }

  revalidatePath('/');
  return { uploaded };
}

export async function deleteLibraryItem(id: string) {
  const { databases, storage } = createAdminClient();

  // Get file info and delete from storage
  const doc = await databases.getDocument(DATABASE_ID, LIBRARY_COLLECTION_ID, id);
  try {
    await storage.deleteFile(PDF_BUCKET_ID, doc.fileId as string);
  } catch {
    // File may already be deleted
  }

  await databases.deleteDocument(DATABASE_ID, LIBRARY_COLLECTION_ID, id);
  revalidatePath('/');
}

export async function updateLibraryFolderOrder(
  updates: { folder: string; folderOrder: number }[],
) {
  const { databases } = createAdminClient();

  for (const update of updates) {
    const docs = await listAll(databases, DATABASE_ID, LIBRARY_COLLECTION_ID, [
      Query.equal('folder', [update.folder]),
    ]);
    await Promise.all(
      docs.map((doc) =>
        databases.updateDocument(DATABASE_ID, LIBRARY_COLLECTION_ID, doc.$id, {
          folderOrder: update.folderOrder,
        }),
      ),
    );
  }

  revalidatePath('/');
}

export async function updateLibraryItemOrder(
  updates: { id: string; order: number; folder: string }[],
) {
  const { databases } = createAdminClient();
  await Promise.all(
    updates.map((u) =>
      databases.updateDocument(DATABASE_ID, LIBRARY_COLLECTION_ID, u.id, {
        order: u.order,
        folder: u.folder,
      }),
    ),
  );
  revalidatePath('/');
}
