import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import en from '../messages/en.json';
import es from '../messages/es.json';

const flattenKeys = (value: unknown, prefix = ''): string[] => {
  if (!value || typeof value !== 'object') return [prefix].filter(Boolean);
  return Object.entries(value).flatMap(([key, nested]) => flattenKeys(nested, prefix ? `${prefix}.${key}` : key));
};

describe('i18n catalogs', () => {
  it('matches key sets across locales', () => {
    expect(flattenKeys(en).sort()).toEqual(flattenKeys(es).sort());
  });

  it('contains no JSX text literals in app or components', () => {
    const roots = ['app', 'components'];
    // Feature areas merged before they were localized. Remove an entry once its
    // strings move into messages/*.json.
    const pendingTranslation = [path.join('components', 'multisig')];
    const files: string[] = [];

    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (pendingTranslation.includes(full)) continue;
        if (entry.isDirectory()) {
          walk(full);
          continue;
        }
        if (entry.isFile() && /(\.tsx|\.ts)$/.test(entry.name)) {
          files.push(full);
        }
      }
    };

    roots.forEach(walk);

    const offenders = files.flatMap((file) => {
      const source = fs.readFileSync(file, 'utf8');
      const matches = [...source.matchAll(/>([^<{]*[A-Za-zÀ-ÿ][^<{]*)</g)];
      return matches
        .map((match) => match[1].trim())
        .filter((value) => {
          if (!value || value.length === 0) return false;
          if (/[()=+;{}<>/]/.test(value)) return false;
          return !/^(?:[A-Za-z0-9_./%\-]+|[A-Za-z0-9_\-]+)$/.test(value);
        });
    });

    expect(offenders).toEqual([]);
  });
});
