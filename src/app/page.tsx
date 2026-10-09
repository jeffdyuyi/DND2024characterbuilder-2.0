'use client';

import SourceBookPicker, { SourceBookSettings } from '@/components/SourceBookPicker';
import React, { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Upload, Scroll, Copy, Trash2 } from 'lucide-react';
import { useCharacterStore } from '@/store/characterStore';
import { CharacterState } from '@/types/characterState';
import GlassNav from '@/components/GlassNav';
import PillButton from '@/components/PillButton';
import styles from './page.module.css';
import { getSpeciesDefinition, getClassDefinition } from '@/engine/characterData';

export default function CharacterLibrary() {
  const router = useRouter();
  const { characters, createCharacter, deleteCharacter, cloneCharacter } = useCharacterStore();
  const [sourceSettings, setSourceSettings] = useState<SourceBookSettings>({});
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const charList = Object.values(characters);

  function getTotalLevel(char: CharacterState) {
    return char.classes?.reduce((sum, c) => sum + c.level, 0) || 0;
  }

  function getClassSummary(char: CharacterState) {
    if (!char.classes || char.classes.length === 0) return '未选择职业';
    return char.classes
      .map((c) => {
        const def = getClassDefinition(c.classId);
        return `${def?.name || c.classId} Lv.${c.level}`;
      })
      .join(' / ');
  }

  function getSpeciesLabel(char: CharacterState) {
    const def = getSpeciesDefinition(char);
    return def?.name || char.speciesId || '未知种族';
  }

  const handleCreate = () => {
    const id = createCharacter(sourceSettings);
    if (!id) {
      console.error('Failed to create character ID');
      return;
    }
    router.push(`/builder/species?id=${encodeURIComponent(id)}`);
  };

  const handleEdit = (id: string) => {
    if (!id) return;
    useCharacterStore.getState().loadCharacter(id);
    router.push(`/sheet/view/?id=${encodeURIComponent(id)}`);
  };

  const handleClone = (id: string) => {
    cloneCharacter(id);
  };

  const handleDelete = (id: string) => {
    deleteCharacter(id);
    setDeleteConfirmId(null);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string) as CharacterState;
        if (data.id) {
          useCharacterStore.setState((state) => ({
            characters: { ...state.characters, [data.id]: data },
          }));
        }
      } catch {
        console.error('Failed to parse imported character file');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
    setShowCreateMenu(false);
  };

  const filteredChars = charList.filter((char) => {
    const nameMatch = (char.name || '').toLowerCase().includes(searchQuery.toLowerCase());
    const speciesMatch = getSpeciesLabel(char).toLowerCase().includes(searchQuery.toLowerCase());
    const classMatch = getClassSummary(char).toLowerCase().includes(searchQuery.toLowerCase());
    return nameMatch || speciesMatch || classMatch;
  });

  return (
    <div className={styles.library}>
      <GlassNav />

      {/* Hero Banner */}
      <div className={styles.library__hero}>
        <div className={styles.library__titleRow}>
          <div>
            <h1 className={styles.library__title}>
              <Scroll size={30} color="var(--color-gold-bright)" />
              角色库
            </h1>
            <p className={styles.library__subtitle}>
              D&D 2024 / 5E 角色卡管理 ({charList.length} 位)
            </p>
          </div>
          <div className={styles.library__controls}>
            <input
              type="text"
              placeholder="搜索英雄、种族或职业..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={styles.library__search}
            />
          </div>
        </div>
      </div>

      {/* Hidden File Input for Import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={handleImport}
        style={{ display: 'none' }}
      />

      {/* Card Grid */}
      <div className={styles.library__grid}>
        {/* Create Card */}
        <div
          className={styles.createCard}
          onClick={() => !showCreateMenu && setShowCreateMenu(true)}
        >
          {showCreateMenu ? (
            <div className={styles.charCard__confirmOverlay}>
              <div
                style={{
                  fontWeight: 700,
                  fontSize: 16,
                  color: 'var(--color-gold-bright)',
                  marginBottom: 8,
                }}
              >
                开始新的冒险
              </div>
              <SourceBookPicker value={sourceSettings} onChange={setSourceSettings} />
              <div className={styles.charCard__confirmActions}>
                <PillButton
                  size="md"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCreate();
                  }}
                  style={{ width: '100%' }}
                >
                  引导式创建
                </PillButton>
                <PillButton
                  variant="outline"
                  size="md"
                  onClick={(e) => {
                    e.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                  style={{ width: '100%' }}
                >
                  导入 JSON
                </PillButton>
                <PillButton
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowCreateMenu(false);
                  }}
                  style={{ width: '100%', marginTop: 8 }}
                >
                  取消
                </PillButton>
              </div>
            </div>
          ) : (
            <>
              <div
                className={styles.createCardIcon}
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: '50%',
                  background: 'rgba(197, 160, 89, 0.1)',
                  border: '1px solid var(--color-border-gold)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--color-gold-bright)',
                }}
              >
                <Plus size={32} />
              </div>
              <div
                style={{
                  fontWeight: 700,
                  fontSize: 18,
                  color: 'var(--color-gold-bright)',
                  fontFamily: 'var(--font-family-serif)',
                }}
              >
                新建角色
              </div>
              <div style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
                开启一段全新的 2024 传奇旅程
              </div>
            </>
          )}
        </div>

        {filteredChars.map((char) => (
          <div key={char.id} className={styles.charCard}>
            {/* Delete Confirmation Overlay */}
            {deleteConfirmId === char.id && (
              <div className={styles.charCard__confirmOverlay}>
                <span className={styles.charCard__confirmText}>
                  确定删除「{char.name || '未命名角色'}」？
                </span>
                <div className={styles.charCard__confirmActions}>
                  <PillButton variant="danger" size="sm" onClick={() => handleDelete(char.id)}>
                    确认删除
                  </PillButton>
                  <PillButton variant="outline" size="sm" onClick={() => setDeleteConfirmId(null)}>
                    取消
                  </PillButton>
                </div>
              </div>
            )}

            {/* Card Image / Avatar */}
            <div
              className={styles.charCard__image}
              onClick={() => handleEdit(char.id)}
              style={{ cursor: 'pointer' }}
            >
              {char.avatarUrl ? (
                <div
                  style={{
                    width: '100%',
                    height: '100%',
                    backgroundImage: `url(${char.avatarUrl})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                  }}
                />
              ) : (
                <div className={styles.charCard__placeholder}>
                  <Scroll size={48} opacity={0.3} />
                  <span style={{ fontSize: 12, opacity: 0.7 }}>未设置头像</span>
                </div>
              )}
              <div className={styles.charCard__levelBadge}>Lv.{getTotalLevel(char)}</div>
            </div>

            {/* Card Content */}
            <div className={styles.charCard__content}>
              <div
                className={styles.charCard__name}
                onClick={() => handleEdit(char.id)}
                style={{ cursor: 'pointer' }}
              >
                {char.name || '未命名英雄'}
              </div>
              <div className={styles.charCard__info}>
                {getSpeciesLabel(char)} · {getClassSummary(char)}
              </div>

              <div className={styles.charCard__actions}>
                <PillButton size="sm" onClick={() => handleEdit(char.id)} style={{ flex: 1 }}>
                  详情卡
                </PillButton>
                <PillButton
                  variant="outline"
                  size="sm"
                  onClick={() => handleClone(char.id)}
                  title="复制角色"
                >
                  <Copy size={14} />
                </PillButton>
                <PillButton
                  variant="danger"
                  size="sm"
                  onClick={() => setDeleteConfirmId(char.id)}
                  title="删除角色"
                >
                  <Trash2 size={14} />
                </PillButton>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Mobile FAB button */}
      <button className={styles.mobileFab} onClick={handleCreate}>
        <Plus size={20} />
        <span>新建角色</span>
      </button>
    </div>
  );
}
