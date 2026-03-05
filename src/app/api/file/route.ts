import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/appwrite';

const PDF_BUCKET_ID = process.env.NEXT_PUBLIC_APPWRITE_PDF_BUCKET_ID!;

export async function GET(request: NextRequest) {
  // Verify session cookie
  const session = request.cookies.get('appwrite-session');
  if (!session?.value) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const fileId = request.nextUrl.searchParams.get('id');
  if (!fileId) {
    return NextResponse.json({ error: 'No file ID provided' }, { status: 400 });
  }

  try {
    const { storage } = createAdminClient();
    const buffer = await storage.getFileView(PDF_BUCKET_ID, fileId);
    const file = await storage.getFile(PDF_BUCKET_ID, fileId);

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': file.mimeType || 'application/pdf',
        'Content-Disposition': `inline; filename="${file.name}"`,
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch {
    return NextResponse.json({ error: 'File not found or not accessible' }, { status: 404 });
  }
}
