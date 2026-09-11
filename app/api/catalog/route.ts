import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import fs from 'fs/promises';
import path from 'path';

const CATALOG_PATH = path.join(process.cwd(), 'lib', 'catalog.json');

export async function GET() {
    try {
        const data = await fs.readFile(CATALOG_PATH, 'utf-8');
        return NextResponse.json(JSON.parse(data));
    } catch (error) {
        console.error('Error reading catalog:', error);
        return NextResponse.json({ error: 'Failed to read catalog' }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    const unauthorized = requireAdmin(req);
    if (unauthorized) return unauthorized;

    try {
        const body = await req.json();
        const { type, item } = body;

        if (!type || !item) {
            return NextResponse.json({ error: 'Missing type or item' }, { status: 400 });
        }

        const data = await fs.readFile(CATALOG_PATH, 'utf-8');
        const catalog = JSON.parse(data);

        if (type === 'art') {
            catalog.artWorks.unshift({ ...item, id: Date.now() });
        } else if (type === 'photography') {
            catalog.photographyItems.unshift({ ...item, id: Date.now() });
        } else {
            return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
        }

        await fs.writeFile(CATALOG_PATH, JSON.stringify(catalog, null, 2));

        return NextResponse.json({ message: 'Item added successfully', catalog });
    } catch (error) {
        console.error('Error updating catalog:', error);
        return NextResponse.json({ error: 'Failed to update catalog' }, { status: 500 });
    }
}
