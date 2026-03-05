import { Client, Account, Databases, Storage, ID, Query } from 'node-appwrite';
import type { Models } from 'node-appwrite';

export const DATABASE_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;
export const PANELS_COLLECTION_ID = process.env.NEXT_PUBLIC_APPWRITE_PANELS_COLLECTION_ID || 'panels';
export const CATEGORIES_COLLECTION_ID = process.env.NEXT_PUBLIC_APPWRITE_CATEGORIES_COLLECTION_ID!;
export const LINKS_COLLECTION_ID = process.env.NEXT_PUBLIC_APPWRITE_LINKS_COLLECTION_ID!;
export const LIBRARY_COLLECTION_ID = process.env.NEXT_PUBLIC_APPWRITE_LIBRARY_COLLECTION_ID!;
export const PDF_BUCKET_ID = process.env.NEXT_PUBLIC_APPWRITE_PDF_BUCKET_ID!;

export function createAdminClient() {
  const client = new Client()
    .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
    .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!)
    .setKey(process.env.NEXT_PUBLIC_APPWRITE_API_KEY!);

  return {
    account: new Account(client),
    databases: new Databases(client),
    storage: new Storage(client),
  };
}

export function createSessionClient(sessionSecret: string) {
  const client = new Client()
    .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
    .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!);
  client.setSession(sessionSecret);

  return {
    account: new Account(client),
  };
}

/** Document with dynamic custom fields */
export type AppDocument = Models.Document & Record<string, unknown>;

/**
 * Paginate through all documents in a collection.
 */
export async function listAll(
  databases: Databases,
  databaseId: string,
  collectionId: string,
  queries: string[] = [],
): Promise<AppDocument[]> {
  const docs: AppDocument[] = [];
  let lastId: string | undefined;

  while (true) {
    const q = [...queries, Query.limit(100)];
    if (lastId) q.push(Query.cursorAfter(lastId));

    const res = await databases.listDocuments(databaseId, collectionId, q);
    docs.push(...(res.documents as AppDocument[]));

    if (res.documents.length < 100) break;
    lastId = res.documents[res.documents.length - 1].$id;
  }

  return docs;
}

export { ID, Query };
