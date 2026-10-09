import { Suspense } from 'react';
import CharacterSheet from './CharacterSheet';

export default function CharacterSheetPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40 }}>角色加载中...</div>}>
      <CharacterSheet />
    </Suspense>
  );
}
