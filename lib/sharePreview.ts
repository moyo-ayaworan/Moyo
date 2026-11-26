import { query } from '@/lib/db';
import { defaultSiteSettings } from '@/lib/siteSettings';
import { getExhibition } from '@/lib/artArchive';
// Resolve public imagery at request time so CMS edits are reflected without a code change.
export async function sharePreviewImage(path:string):Promise<string> {
 if(path.startsWith('/stillbounds')||path.startsWith('/mofolio'))return '/mofolio/app-graduation-editor.webp';
 if(path.startsWith('/art/exhibitions/'))return getExhibition(path.split('/').at(-1) || '')?.references[0]?.src || '';
 try {
  if(path.includes('/shop/products/')){const id=path.split('/').at(-1)?.match(/(?:^|-)(\d+)$/)?.[1];if(id)return (await query('SELECT image FROM digital_products WHERE id=$1 AND is_active=TRUE',[id])).rows[0]?.image || '';}
  if(path.includes('/shop'))return (await query('SELECT image FROM digital_products WHERE section=$1 AND is_active=TRUE ORDER BY display_order,created_at DESC LIMIT 1',[path.startsWith('/art')?'art':'photography'])).rows[0]?.image || '';
  const content=(await query('SELECT homepage_hero_image,about_image,site_settings FROM content WHERE id=1')).rows[0] || {};
  const settings=content.site_settings || {};
  if(path==='/')return settings.entry?.desktopImage || defaultSiteSettings.entry.desktopImage;
  if(path==='/art'||path==='/art/about')return (path.endsWith('/about')?settings.art?.aboutImage:settings.art?.heroImage) || defaultSiteSettings.art.heroImage;
  if(path.startsWith('/art'))return (await query('SELECT image FROM artworks ORDER BY is_featured DESC,created_at DESC LIMIT 1')).rows[0]?.image || defaultSiteSettings.art.heroImage;
  if(path==='/photography/about')return content.about_image || '';
  if(path==='/photography')return content.homepage_hero_image || '';
  if(path.startsWith('/photography'))return (await query(`SELECT COALESCE(NULLIF(c.cover_image_url,''),i.image_url) image FROM photography_categories c LEFT JOIN photography_category_images i ON i.category_id=c.id WHERE c.is_active=TRUE ORDER BY c.display_order,c.created_at DESC,i.display_order LIMIT 1`)).rows[0]?.image || '';
 } catch { /* A branded page-specific card remains available during content outages. */ }
 return '';
}
