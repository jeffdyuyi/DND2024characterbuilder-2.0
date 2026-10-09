import { expect, it } from 'vitest';
import { InMemoryCatalogService } from '@/catalog/catalog';
import { FiveEToolsCnLoader } from '@/source/fiveetools-cn/loader';
import { createDefaultFiveEToolsSource, createDefaultHomebrewSource } from '@/source/fiveetools-cn/client';
import { discoverHomebrewManifest } from '@/source/homebrew/manifest';

it.skipIf(process.env.RUN_LIVE_DATA !== '1')('真实双源能够发现、载入并注册到 Catalog', async () => {
  const catalog = new InMemoryCatalogService();
  const core = new FiveEToolsCnLoader(createDefaultFiveEToolsSource(), catalog);
  const summaries = await Promise.all([
    core.loadRaces({ refresh: true }),
    core.loadBackgrounds({ refresh: true }),
    core.loadFeats({ refresh: true }),
    core.loadClasses({ refresh: true }),
    core.loadSpells({ refresh: true }),
    core.loadItems({ refresh: true }),
    core.loadCharacterOptions({ refresh: true }),
  ]);
  for (const summary of summaries) {
    expect(summary.count, `${summary.kind}: ${summary.warnings.map((item) => item.message).join('; ')}`).toBeGreaterThan(0);
    expect(summary.failedFiles ?? 0).toBe(0);
  }

  const manifest = await discoverHomebrewManifest({ refresh: true });
  const wanted = ['class', 'subclass', 'race', 'background', 'feat', 'spell', 'item', 'optionalfeature'];
  const samplePaths = wanted
    .map((category) => manifest.entries.find((entry) => entry.category === category)?.path)
    .filter((path): path is string => Boolean(path));
  expect(samplePaths).toHaveLength(wanted.length);

  const brew = new FiveEToolsCnLoader(createDefaultHomebrewSource(), catalog);
  const brewSummary = await brew.loadClassFiles(samplePaths, { refresh: true });
  expect(brewSummary.failedFiles, brewSummary.warnings.map((item) => item.message).join('; ')).toBe(0);
  expect(brewSummary.count).toBeGreaterThan(0);
  expect(catalog.list('class').length).toBeGreaterThan(0);
  expect(catalog.list('spell').length).toBeGreaterThan(0);
  expect(catalog.list('item').length + catalog.list('baseitem').length).toBeGreaterThan(0);
  console.info('[live-data-acceptance]', JSON.stringify({
    core: summaries.map((summary) => ({ kind: summary.kind, count: summary.count, expectedFiles: summary.expectedFiles, loadedFiles: summary.loadedFiles, failedFiles: summary.failedFiles ?? 0, warnings: summary.warnings.map((warning) => warning.message) })),
    homebrewManifestEntries: manifest.entries.length,
    homebrewSamples: samplePaths,
    homebrewLoaded: brewSummary.count,
    catalog: {
      classes: catalog.list('class').length,
      subclasses: catalog.list('subclass').length,
      spells: catalog.list('spell').length,
      items: catalog.list('item').length + catalog.list('baseitem').length,
      races: catalog.list('race').length,
      feats: catalog.list('feat').length,
      optionalFeatures: catalog.list('optionalfeature').length,
    },
  }));
}, 180_000);
