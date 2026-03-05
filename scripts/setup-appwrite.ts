/**
 * Appwrite Setup Script
 *
 * Creates the database, collections, indexes, and storage bucket
 * required by Kerv Command Hub.
 *
 * Usage:
 *   1. Copy .env.local.example → .env.local and fill in APPWRITE_ENDPOINT,
 *      APPWRITE_PROJECT_ID, and APPWRITE_API_KEY.
 *   2. Run:  npx tsx scripts/setup-appwrite.ts
 *   3. The script prints the IDs you need to add to .env.local.
 */

import 'dotenv/config';
import { Client, Databases, Storage, Permission, Role, IndexType, Compression, OrderBy } from 'node-appwrite';

const client = new Client()
  .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1')
  .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID || '')
  .setKey(process.env.NEXT_PUBLIC_APPWRITE_API_KEY || '');

const databases = new Databases(client);
const storage = new Storage(client);

const DB_ID = 'ops-dashboard';

function wait(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Try to create a resource; if it already exists (409), skip silently. */
async function createOrSkip<T>(label: string, fn: () => Promise<T>): Promise<T | null> {
  try {
    const result = await fn();
    console.log(`  ✔ ${label} created`);
    return result;
  } catch (err: unknown) {
    const error = err as any;
    const code = error?.code;
    const status = error?.response?.status || error?.status;
    
    if (code === 409 || status === 409) {
      console.log(`  ⏭ ${label} already exists — skipping`);
      return null;
    }
    
    // If it's a plan limit error, provide helpful guidance
    if (error?.message?.includes('maximum number of databases') || error?.message?.includes('plan')) {
      console.error(`\n❌ Plan limit reached: ${error.message}`);
      console.error('Solution: Delete the existing "ops-dashboard" database in Appwrite Console and re-run this script.\n');
    }
    
    throw err;
  }
}

async function setup() {
  // ── Database ──────────────────────────────────────────────────────────
  console.log('Creating database...');
  await createOrSkip('Database', () => databases.create(DB_ID, 'Ops Dashboard'));

  // ── Panels ────────────────────────────────────────────────────────────
  console.log('Creating panels collection...');
  await createOrSkip('Collection', () => databases.createCollection(DB_ID, 'panels', 'Panels'));
  await createOrSkip('panels.name', () => databases.createStringAttribute({ databaseId: DB_ID, collectionId: 'panels', key: 'name', size: 255, required: true }));
  await createOrSkip('panels.order', () => databases.createIntegerAttribute({ databaseId: DB_ID, collectionId: 'panels', key: 'order', required: false, min: 0, max: 100000, xdefault: 0 }));
  await wait(3000);
  await createOrSkip('panels.idx_order', () => databases.createIndex({
    databaseId: DB_ID,
    collectionId: 'panels',
    key: 'idx_order',
    type: IndexType.Key,
    attributes: ['order'],
    orders: [OrderBy.Asc],
  }));
  await createOrSkip('panels.idx_name', () => databases.createIndex({
    databaseId: DB_ID,
    collectionId: 'panels',
    key: 'idx_name',
    type: IndexType.Unique,
    attributes: ['name'],
  }));

  // ── Categories ────────────────────────────────────────────────────────
  console.log('Creating categories collection...');
  await createOrSkip('Collection', () => databases.createCollection(DB_ID, 'categories', 'Categories'));
  await createOrSkip('categories.name', () => databases.createStringAttribute({ databaseId: DB_ID, collectionId: 'categories', key: 'name', size: 255, required: true }));
  await createOrSkip('categories.panel', () => databases.createStringAttribute({ databaseId: DB_ID, collectionId: 'categories', key: 'panel', size: 255, required: false, xdefault: 'Work' }));
  await createOrSkip('categories.order', () => databases.createIntegerAttribute({ databaseId: DB_ID, collectionId: 'categories', key: 'order', required: false, min: 0, max: 100000, xdefault: 0 }));
  await wait(3000); // attributes need time to be ready
  await createOrSkip('categories.idx_panel_order', () => databases.createIndex({
    databaseId: DB_ID,
    collectionId: 'categories',
    key: 'idx_panel_order',
    type: IndexType.Key,
    attributes: ['panel', 'order'],
    orders: [OrderBy.Asc, OrderBy.Asc],
  }));

  // ── Links ─────────────────────────────────────────────────────────────
  console.log('Creating links collection...');
  await createOrSkip('Collection', () => databases.createCollection(DB_ID, 'links', 'Links'));
  await createOrSkip('links.name', () => databases.createStringAttribute({ databaseId: DB_ID, collectionId: 'links', key: 'name', size: 255, required: true }));
  await createOrSkip('links.url', () => databases.createStringAttribute({ databaseId: DB_ID, collectionId: 'links', key: 'url', size: 2048, required: true }));
  await createOrSkip('links.description', () => databases.createStringAttribute({ databaseId: DB_ID, collectionId: 'links', key: 'description', size: 1024, required: false, xdefault: '' }));
  await createOrSkip('links.order', () => databases.createIntegerAttribute({ databaseId: DB_ID, collectionId: 'links', key: 'order', required: false, min: 0, max: 1000000, xdefault: 0 }));
  await createOrSkip('links.source', () => databases.createStringAttribute({ databaseId: DB_ID, collectionId: 'links', key: 'source', size: 50, required: false, xdefault: 'manual' }));
  await createOrSkip('links.categoryId', () => databases.createStringAttribute({ databaseId: DB_ID, collectionId: 'links', key: 'categoryId', size: 36, required: true }));
  await wait(3000);
  await createOrSkip('links.idx_catId_order', () => databases.createIndex({
    databaseId: DB_ID,
    collectionId: 'links',
    key: 'idx_catId_order',
    type: IndexType.Key,
    attributes: ['categoryId', 'order'],
    orders: [OrderBy.Asc, OrderBy.Asc],
  }));
  // Note: No unique index on url — the full URL (2048 chars) exceeds Appwrite's max index size (767 bytes).
  // Uniqueness is handled at the application level (upsert during bookmark import).

  // ── Library Items ─────────────────────────────────────────────────────
  console.log('Creating library-items collection...');
  await createOrSkip('Collection', () => databases.createCollection(DB_ID, 'library-items', 'Library Items'));
  await createOrSkip('library-items.name', () => databases.createStringAttribute({ databaseId: DB_ID, collectionId: 'library-items', key: 'name', size: 500, required: true }));
  await createOrSkip('library-items.fileId', () => databases.createStringAttribute({ databaseId: DB_ID, collectionId: 'library-items', key: 'fileId', size: 36, required: true }));
  await createOrSkip('library-items.folder', () => databases.createStringAttribute({ databaseId: DB_ID, collectionId: 'library-items', key: 'folder', size: 255, required: false, xdefault: 'Uploads' }));
  await createOrSkip('library-items.order', () => databases.createIntegerAttribute({ databaseId: DB_ID, collectionId: 'library-items', key: 'order', required: false, min: 0, max: 1000000, xdefault: 0 }));
  await createOrSkip('library-items.folderOrder', () => databases.createIntegerAttribute({ databaseId: DB_ID, collectionId: 'library-items', key: 'folderOrder', required: false, min: 0, max: 1000000, xdefault: 0 }));
  await wait(3000);
  await createOrSkip('library-items.idx_folder_order', () => databases.createIndex({
    databaseId: DB_ID,
    collectionId: 'library-items',
    key: 'idx_folder_order',
    type: IndexType.Key,
    attributes: ['folderOrder', 'order'],
    orders: [OrderBy.Asc, OrderBy.Asc],
  }));
  await createOrSkip('library-items.idx_fileId', () => databases.createIndex({
    databaseId: DB_ID,
    collectionId: 'library-items',
    key: 'idx_fileId',
    type: IndexType.Unique,
    attributes: ['fileId'],
  }));

  // ── PDF Storage Bucket ────────────────────────────────────────────────
  console.log('Creating PDF storage bucket...');
  await createOrSkip('Bucket', () => storage.createBucket({
    bucketId: 'pdfs',
    name: 'PDFs',
    permissions: [Permission.read(Role.any())],
    fileSecurity: false,
    enabled: true,
    maximumFileSize: 50000000, // 50 MB (Appwrite max: 50,000,000 bytes)
    allowedFileExtensions: ['pdf'],
    compression: Compression.Gzip,
    encryption: false,
    antivirus: false,
  }));

  // ── Done ──────────────────────────────────────────────────────────────
  console.log('\n=== Setup Complete ===\n');
  console.log('Add these to your .env.local:\n');
  console.log(`NEXT_PUBLIC_APPWRITE_DATABASE_ID=${DB_ID}`);
  console.log(`NEXT_PUBLIC_APPWRITE_PANELS_COLLECTION_ID=panels`);
  console.log(`NEXT_PUBLIC_APPWRITE_CATEGORIES_COLLECTION_ID=categories`);
  console.log(`NEXT_PUBLIC_APPWRITE_LINKS_COLLECTION_ID=links`);
  console.log(`NEXT_PUBLIC_APPWRITE_LIBRARY_COLLECTION_ID=library-items`);
  console.log(`NEXT_PUBLIC_APPWRITE_PDF_BUCKET_ID=pdfs`);
  console.log('\nDon\'t forget to create a user account in the Appwrite Console');
  console.log('(Authentication → Create User) so you can sign in.\n');
}

setup().catch((err) => {
  console.error('Setup failed:', err.message || err);
  process.exit(1);
});
