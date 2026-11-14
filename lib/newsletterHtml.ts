import sanitizeHtml from 'sanitize-html';

export function sanitizeNewsletterHtml(value: string) {
  return sanitizeHtml(value, {
    allowedTags: ['p', 'div', 'br', 'h2', 'h3', 'strong', 'b', 'em', 'i', 'u', 's', 'ul', 'ol', 'li', 'blockquote', 'a'],
    allowedAttributes: { a: ['href', 'title'] },
    allowedSchemes: ['https', 'http', 'mailto'],
    allowProtocolRelative: false,
    disallowedTagsMode: 'discard',
  });
}
