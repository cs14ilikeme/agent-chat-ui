import { NextRequest, NextResponse } from 'next/server';

const GA_GO_API = process.env.GAGO_API_URL || 'http://127.0.0.1:8765';

/**
 * Proxy all requests to GA-Go backend to avoid CORS issues.
 * Browser calls /api/gago/health → server fetches http://127.0.0.1:8765/health
 */
async function proxyRequest(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const pathname = '/' + path.join('/');
  const url = `${GA_GO_API}${pathname}`;

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Forward auth token if present
    const authHeader = req.headers.get('Authorization');
    if (authHeader) {
      headers['Authorization'] = authHeader;
    }

    const fetchOptions: RequestInit = {
      method: req.method,
      headers,
    };

    if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
      fetchOptions.body = await req.text();
    }

    const response = await fetch(url, fetchOptions);
    const data = await response.text();

    return new NextResponse(data, {
      status: response.status,
      headers: { 'Content-Type': response.headers.get('Content-Type') || 'application/json' },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'GA-Go proxy error', message: error?.message || 'Connection failed' },
      { status: 502 }
    );
  }
}

export const GET = proxyRequest;
export const POST = proxyRequest;
export const PUT = proxyRequest;
export const PATCH = proxyRequest;
export const DELETE = proxyRequest;
