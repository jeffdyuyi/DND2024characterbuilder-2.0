import { expect, it, vi } from 'vitest';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { InMemoryCatalogService } from '@/catalog/catalog';
import { collectClassAssemblyDiagnostics } from '@/catalog/adapters/classAssembly';
import { FiveEToolsCnLoader } from '@/source/fiveetools-cn/loader';
import {
  createDefaultFiveEToolsSource,
  createDefaultHomebrewSource,
} from '@/source/fiveetools-cn/client';
import { discoverHomebrewManifest } from '@/source/homebrew/manifest';

it.skipIf(process.env.RUN_LIVE_CLASS_AUDIT !== '1' && process.env.REPLAY_CLASS_AUDIT !== '1')(
  '审计真实双源的完整职业装配链',
  async () => {
    const catalog = new InMemoryCatalogService();
    const replay =
      process.env.REPLAY_CLASS_AUDIT === '1'
        ? JSON.parse(readFileSync('scratch/class-audit/documents.json', 'utf8'))
        : undefined;
    const documents: Array<{ pack: string; path: string; result: any }> = [];
    const instrument = (source: ReturnType<typeof createDefaultFiveEToolsSource>) => {
      const fetchJson = source.fetchJson.bind(source);
      vi.spyOn(source, 'fetchJson').mockImplementation(async (path, options) => {
        let result = replay
          ? replay.documents.find(
              (record: any) => record.pack === source.id && record.path === path,
            )?.result
          : await fetchJson(path, options);
        if (
          !result &&
          process.env.FETCH_CLASS_AUDIT_DEPENDENCIES === '1' &&
          (path.startsWith('data/spells/') ||
            path === 'data/generated/gendata-spell-source-lookup.json')
        ) {
          result = await fetchJson(path, options);
        }
        if (!result) throw new Error(`回放缺少文件: ${source.id}:${path}`);
        documents.push({ pack: source.id, path, result });
        return result;
      });
      return source;
    };
    const coreSource = instrument(createDefaultFiveEToolsSource());
    const core = new FiveEToolsCnLoader(coreSource, catalog);
    const coreSummary = await core.loadClasses({ refresh: true });
    expect(
      coreSummary.failedFiles ?? 0,
      coreSummary.warnings.map((item) => item.message).join('; '),
    ).toBe(0);
    expect(coreSummary.count).toBeGreaterThan(0);

    const manifest = replay?.manifest || (await discoverHomebrewManifest({ refresh: true }));
    const homebrewPaths = manifest.entries
      .filter((entry: any) => entry.category === 'class' || entry.category === 'subclass')
      .map((entry: any) => entry.path);
    expect(homebrewPaths.length).toBeGreaterThan(0);

    // Mirror runtime order: official spells are available before Homebrew copies
    // embedded in class files. Keep the original narrow baseline for comparison.
    const spellDependencies =
      process.env.WITH_CLASS_AUDIT_DEPENDENCIES === '1'
        ? await core.loadSpells({ refresh: true })
        : undefined;
    if (spellDependencies)
      expect(
        spellDependencies.failedFiles ?? 0,
        spellDependencies.warnings.map((warning) => warning.message).join('; '),
      ).toBe(0);

    const homebrew = new FiveEToolsCnLoader(instrument(createDefaultHomebrewSource()), catalog);
    const homebrewSummary = await homebrew.loadClassFiles(homebrewPaths, { refresh: true });
    expect(
      homebrewSummary.failedFiles ?? 0,
      homebrewSummary.warnings.map((item) => item.message).join('; '),
    ).toBe(0);

    const diagnostics = collectClassAssemblyDiagnostics(catalog);
    const countBySource = (values: string[]) =>
      values.reduce<Record<string, number>>((counts, value) => {
        const source = value.startsWith('5etools-cn:')
          ? '5etools-cn'
          : value.startsWith('homebrew-tjliqy:')
            ? 'homebrew-tjliqy'
            : 'other';
        counts[source] = (counts[source] || 0) + 1;
        return counts;
      }, {});
    const genericChoices = diagnostics.choiceParsing.filter((value) =>
      value.includes('feature-choice-generic:'),
    );
    const unresolvedChoices = diagnostics.choiceParsing.filter((value) =>
      value.includes('feature-choice-unresolved:'),
    );
    const report = {
      auditScope: {
        officialSpellDependencies: Boolean(spellDependencies),
        replay: Boolean(replay),
      },
      sources: {
        fiveetoolsCn: {
          entries: coreSummary.count,
          expectedFiles: coreSummary.expectedFiles,
          loadedFiles: coreSummary.loadedFiles,
          warnings: coreSummary.warnings.map((item) => item.message),
          spellDependencies,
        },
        homebrew: {
          manifestRevision: manifest.revision,
          files: homebrewPaths.length,
          entries: homebrewSummary.count,
          loadedFiles: homebrewSummary.loadedFiles,
          warningCount: homebrewSummary.warnings.length,
          warningSamples: homebrewSummary.warnings.slice(0, 10).map((item) => item.message),
          warnings: homebrewSummary.warnings,
        },
      },
      catalog: {
        classes: catalog.list('class').length,
        subclasses: catalog.list('subclass').length,
        classFeatures: catalog.list('classFeature').length,
        subclassFeatures: catalog.list('subclassFeature').length,
      },
      diagnostics: {
        unresolvedReferenceCount: diagnostics.unresolvedReferences.length,
        unresolvedReferencesBySource: countBySource(diagnostics.unresolvedReferences),
        unresolvedReferenceSamples: diagnostics.unresolvedReferences.slice(0, 30),
        referenceFailures: diagnostics.referenceFailures,
        choiceParsingCount: diagnostics.choiceParsing.length,
        choiceParsingBySource: countBySource(diagnostics.choiceParsing),
        genericChoiceCount: genericChoices.length,
        unresolvedChoiceCount: unresolvedChoices.length,
        genericChoiceSamples: genericChoices.slice(0, 20),
        unresolvedChoiceSamples: unresolvedChoices.slice(0, 20),
      },
    };
    if (process.env.WRITE_CLASS_AUDIT === '1') {
      mkdirSync('scratch/class-audit', { recursive: true });
      const label = replay ? 'after' : 'before';
      writeFileSync(`scratch/class-audit/${label}.json`, JSON.stringify(report, null, 2));
      writeFileSync(
        `scratch/class-audit/${label}-catalog.json`,
        JSON.stringify(
          ['class', 'subclass', 'classFeature', 'subclassFeature', 'spell'].flatMap((kind) =>
            catalog.list(kind as any),
          ),
        ),
      );
      if (!replay || process.env.FETCH_CLASS_AUDIT_DEPENDENCIES === '1')
        writeFileSync(
          'scratch/class-audit/documents.json',
          JSON.stringify({ manifest, documents }),
        );
    }
    console.info('[live-class-diagnostics]', JSON.stringify(report));
    vi.restoreAllMocks();
  },
  600_000,
);
