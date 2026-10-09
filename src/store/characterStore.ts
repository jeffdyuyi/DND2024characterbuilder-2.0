import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { safeLocalStorage } from '@/utils/safeStorage';
import { CharacterState } from '@/types/characterState';
import { defaultCatalog } from '@/catalog/catalog';
import { migrateCharacterCatalogReferences } from '@/catalog/references';
import type { SourceSelection } from '@/types/sourceSelection';
import { validateSourceSelection } from '@/catalog/sourcePolicy';

interface CharacterStore {
  characters: Record<string, CharacterState>;
  activeCharacterId: string | null;

  // Library Actions
  createCharacter: (sources?: {
    sourceSelection?: SourceSelection;
    allowHomebrew?: boolean;
  }) => string;
  updateCharacterSources: (
    id: string,
    sources: { sourceSelection: SourceSelection; allowHomebrew: boolean },
  ) => void;
  loadCharacter: (id: string) => void;
  deleteCharacter: (id: string) => void;
  cloneCharacter: (id: string) => string;

  // Active Character Updates
  updateActiveCharacter: (updates: Partial<CharacterState>) => void;
  updateManualOverrides: (overrides: Partial<CharacterState['manualOverrides']>) => void;
  migrateCatalogReferences: () => void;
}

// Robust ID generation helper
const generateId = (): string => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for non-secure contexts or older environments
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};

const createEmptyCharacter = (id: string): CharacterState => ({
  id,
  name: '未命名角色',
  playerName: '',
  allowHomebrew: false,
  classes: [],
  baseAbilityScores: { str: 8, dex: 8, con: 8, int: 8, wis: 8, cha: 8 },
  backgroundAbilityBonuses: {},
  backgroundSelections: {},
  selectedFeats: [],
  featSelections: {},
  selectedSkills: [],
  expertiseSkills: [],
  equipmentChoiceMode: 'package',
  equipmentIds: [],
  inventoryEntries: [],
  equippedWeaponIds: [],
  attunedItemIds: [],
  currency: { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 },
  higherLevelGoldRolled: false,
  higherLevelGoldAmount: 0,
  hitDiceUsed: 0,
  hitDiceUsedMap: {},
  deathSaves: { success: 0, failure: 0 },
  conditions: [],
  preparedSpellIds: [],
  cantripIds: [],
  knownSpellIds: [],
  spellbookIds: [],
  spellSlotUsage: {},
  resourceUsage: {},
  selectedLanguages: [],
  useSpeciesASI: true,
  isMulticlassingEnabled: false,
  customMarkers: [],
  encumbranceMode: 'standard',
  containers: [],
  manualOverrides: {},
  proficiencies: {
    skills: [],
    saves: [],
    tools: [],
    languages: [],
  },
  schemaVersion: 2,
  contentSnapshots: {},
});

export const useCharacterStore = create<CharacterStore>()(
  persist(
    (set, get) => ({
      characters: {},
      activeCharacterId: null,

      createCharacter: (sources) => {
        const id = generateId();
        const newChar = createEmptyCharacter(id);
        if (sources?.sourceSelection)
          newChar.sourceSelection = validateSourceSelection(sources.sourceSelection);
        if (sources?.allowHomebrew !== undefined) newChar.allowHomebrew = sources.allowHomebrew;
        set((state) => ({
          characters: { ...state.characters, [id]: newChar },
          activeCharacterId: id,
        }));
        return id;
      },

      updateCharacterSources: (id, sources) => {
        const sourceSelection = validateSourceSelection(sources.sourceSelection);
        set((state) => {
          const character = state.characters[id];
          if (!character) return state;
          return {
            characters: {
              ...state.characters,
              [id]: {
                ...character,
                sourceSelection,
                allowHomebrew: sources.allowHomebrew,
              },
            },
          };
        });
      },

      loadCharacter: (id) => {
        set({ activeCharacterId: id });
      },

      deleteCharacter: (id) => {
        set((state) => {
          const newChars = { ...state.characters };
          delete newChars[id];
          return {
            characters: newChars,
            activeCharacterId: state.activeCharacterId === id ? null : state.activeCharacterId,
          };
        });
      },

      cloneCharacter: (id) => {
        const state = get();
        const charToClone = state.characters[id];
        if (!charToClone) return '';

        const newId = generateId();
        const clonedChar = structuredClone(charToClone);
        clonedChar.id = newId;
        clonedChar.name = `${charToClone.name} (副本)`;

        set((s) => ({
          characters: { ...s.characters, [newId]: clonedChar },
        }));
        return newId;
      },

      updateActiveCharacter: (updates) => {
        set((state) => {
          if (!state.activeCharacterId) return state;
          const current = state.characters[state.activeCharacterId];
          if (!current) return state;
          return {
            characters: {
              ...state.characters,
              [state.activeCharacterId]: { ...current, ...updates },
            },
          };
        });
      },

      updateManualOverrides: (overrides) => {
        set((state) => {
          if (!state.activeCharacterId) return state;
          const current = state.characters[state.activeCharacterId];
          if (!current) return state;
          const newOverrides = { ...(current.manualOverrides || {}), ...overrides };
          return {
            characters: {
              ...state.characters,
              [state.activeCharacterId]: { ...current, manualOverrides: newOverrides },
            },
          };
        });
      },

      migrateCatalogReferences: () => {
        set((state) => ({
          characters: Object.fromEntries(
            Object.entries(state.characters).map(([id, character]) => [
              id,
              migrateCharacterCatalogReferences(character, defaultCatalog),
            ]),
          ),
        }));
      },
    }),
    {
      name: 'dnd2024-characters',
      version: 2,
      storage: createJSONStorage(() => safeLocalStorage),
      migrate: (persisted: any) => ({
        ...persisted,
        characters: Object.fromEntries(
          Object.entries(persisted?.characters || {}).map(([id, value]) => [
            id,
            {
              ...(value as CharacterState),
              schemaVersion: 2,
              contentSnapshots: (value as CharacterState).contentSnapshots || {},
            },
          ]),
        ),
      }),
    },
  ),
);
