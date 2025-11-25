/**
 * Utility functions for URL slug conversion
 */

/**
 * Converts a name to a URL-friendly slug
 * - Converts to lowercase
 * - Replaces spaces with dashes
 * - Removes special characters
 * - Trims dashes from start and end
 */
export function nameToSlug(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-') // Replace spaces with dashes
    .replace(/[^a-z0-9-]/g, '') // Remove special characters except dashes
    .replace(/-+/g, '-') // Replace multiple dashes with single dash
    .replace(/^-+|-+$/g, '') // Trim dashes from start and end
}

/**
 * Converts a slug back to a name
 * - Replaces dashes with spaces
 * - Capitalizes first letter of each word
 */
export function slugToName(slug: string): string {
  return slug
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

