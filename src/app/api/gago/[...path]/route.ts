import { NextRequest, NextResponse } from 'next/server';

const GA_CLAW_HUB_URL = process.env.GA_CLAW_HUB_URL || process.env.GAGO_API_URL || 'http://127.0.0.1:8420';

function normalizeHubPath(pathname: string, method: string): string {
  if (pathname.startsWith('/api/v1/')) return pathname;
  if (method === 'POST' && pathname === '/tasks/submit') return '/api/v1/tasks';
  if (pathname.endsWith('/status')) return `/api/v1${pathname.replace(/\/status$/, '')}`;
  if (pathname.endsWith('/result')) return `/api/v1${pathname.replace(/\/result$/, '')}`;
  return `/api/v1${pathname}`;
}

async function proxyRequest(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const pathname = '/' + path.join('/');

  if (req.method === 'GET') {
    if (pathname === '/collab/rooms') return NextResponse.json({ rooms: [] });
    if (pathname === '/pairings') return NextResponse.json({ pairings: [], count: 0 });
    if (pathname === '/workspaces') return NextResponse.json([]);
    if (pathname === '/artifacts') return NextResponse.json([]);
    if (pathname === '/tool-leases') return NextResponse.json([]);
    if (pathname === '/timeline') return NextResponse.json([]);
    if (pathname === '/services') return NextResponse.json([]);
  }

  const url = `${GA_CLAW_HUB_URL}${normalizeHubPath(pathname, req.method)}`;

  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const authHeader = req.headers.get('Authorization');
    if (authHeader) headers['Authorization'] = authHeader;

    const fetchOptions: RequestInit = { method: req.method, headers };
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
      { error: 'GA-Claw Hub proxy error', message: error?.message || 'Connection failed' },
      { status: 502 }
    );
  }
}

export const GET = proxyRequest;
export const POST = proxyRequest;
export const PUT = proxyRequest;
export const PATCH = proxyRequest;
export const DELETE = proxyRequest;
