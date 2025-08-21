import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';

export async function GET(request: NextRequest, { params }: { params: { path: string[] } }) {
  try {
    const filePath = path.join(process.cwd(), 'zkit', ...params.path);
    
    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }
    
    const fileContent = fs.readFileSync(filePath);
    const fileName = path.basename(filePath);
    
    // Determine content type based on file extension
    let contentType = 'application/octet-stream';
    if (fileName.endsWith('.json')) {
      contentType = 'application/json';
    } else if (fileName.endsWith('.wasm')) {
      contentType = 'application/wasm';
    } else if (fileName.endsWith('.zkey')) {
      contentType = 'application/octet-stream';
    }
    
    return new NextResponse(fileContent, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000', // Cache for 1 year
      },
    });
  } catch (error) {
    console.error('Error serving zkit file:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}