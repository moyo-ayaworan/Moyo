import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { mergeSiteSettings } from '@/lib/siteSettings';

async function getContent() {
  const { rows } = await query('SELECT * FROM content WHERE id=1');
  return rows[0];
}

export async function GET() {
  const content = await getContent();
  return NextResponse.json({
    content: {
      homepage: { heroText: content.homepage_hero_text, heroImage: content.homepage_hero_image },
      about: { text: content.about_text, image: content.about_image },
      settings: mergeSiteSettings(content.site_settings),
    },
  });
}

export async function PUT(req: NextRequest) {
  const unauthorized = await requireAdmin(req);
  if (unauthorized) return unauthorized;

  const body = await req.json();
  const homepage = body.homepage || {};
  const about = body.about || {};
  const settings = mergeSiteSettings(body.settings);

  const { rows } = await query(
    `UPDATE content
     SET homepage_hero_text=$1, homepage_hero_image=$2, about_text=$3, about_image=$4, site_settings=$5
     WHERE id=1
     RETURNING *`,
    [homepage.heroText ?? '', homepage.heroImage ?? '', about.text ?? '', about.image ?? '', settings]
  );

  const updated = rows[0];
  return NextResponse.json({
    content: {
      homepage: { heroText: updated.homepage_hero_text, heroImage: updated.homepage_hero_image },
      about: { text: updated.about_text, image: updated.about_image },
      settings: mergeSiteSettings(updated.site_settings),
    },
  });
}
