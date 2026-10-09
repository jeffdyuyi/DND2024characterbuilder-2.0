'use client';

import React from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import GlassNav from '@/components/GlassNav';
import PillButton from '@/components/PillButton';
import { useCharacterStore } from '@/store/characterStore';
import { getClassDefinition } from '@/engine/characterData';
import styles from './layout.module.css';

const STEPS = [
  { path: 'species', label: '种族' },
  { path: 'background', label: '背景' },
  { path: 'class', label: '职业基础' },
  { path: 'abilities', label: '属性分配' },
  { path: 'class-detail', label: '职业进阶' },
  { path: 'multiclass', label: '兼职详情' },
  { path: 'feats', label: '专长精选' },
  { path: 'spells', label: '法术准备' },
  { path: 'equipment', label: '装备' },
  { path: 'character-options', label: '附加选项' },
  { path: 'details', label: '细节' },
];

function BuilderShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const charId = searchParams.get('id') || '';

  const { characters, updateActiveCharacter } = useCharacterStore();
  const character = charId ? characters[charId] : null;
  const [isHomebrewLoading, setIsHomebrewLoading] = React.useState(false);

  const handleToggleHomebrew = async () => {
    if (!character) return;
    const nextVal = !character.allowHomebrew;
    updateActiveCharacter({ allowHomebrew: nextVal });
    if (nextVal) {
      setIsHomebrewLoading(true);
      try {
        const { loadHomebrewAll } = await import('@/platform/catalogLoader');
        await loadHomebrewAll();
      } catch (err) {
        console.warn('Homebrew 加载失败:', err);
      } finally {
        setIsHomebrewLoading(false);
      }
    }
  };

  const filteredSteps = STEPS.filter((step) => {
    if (step.path === 'multiclass' && !character?.isMulticlassingEnabled) {
      return false;
    }
    return true;
  });

  // Determine current step index within filtered steps
  const currentSegment = pathname.split('/').filter(Boolean).pop() || '';
  const currentIndex = filteredSteps.findIndex((s) => s.path === currentSegment);
  const stepIndex = currentIndex >= 0 ? currentIndex : 0;

  const navigateTo = (index: number) => {
    if (index < 0 || index >= filteredSteps.length) return;
    router.push(`/builder/${filteredSteps[index].path}?id=${charId}`);
  };

  const validateCurrentStep = (): boolean => {
    return true;
  };

  const handlePrev = () => navigateTo(stepIndex - 1);
  const handleNext = () => {
    if (!validateCurrentStep()) return;

    if (stepIndex === filteredSteps.length - 1) {
      router.push(`/sheet/view/?id=${encodeURIComponent(charId)}`);
    } else {
      navigateTo(stepIndex + 1);
    }
  };

  const progressPercent = (stepIndex / (filteredSteps.length - 1)) * 100;

  return (
    <div className={styles.builderLayout}>
      <GlassNav
        backLabel="角色库"
        backHref="/"
        title={`步骤 ${stepIndex + 1} / ${filteredSteps.length}`}
        actions={
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {character && (
              <PillButton
                size="sm"
                variant={character.allowHomebrew ? 'primary' : 'outline'}
                onClick={handleToggleHomebrew}
                title={
                  character.allowHomebrew
                    ? '点击禁用第三方扩展 / Homebrew'
                    : '点击启用第三方扩展 / Homebrew'
                }
              >
                {isHomebrewLoading
                  ? '扩展载入中...'
                  : `第三方扩展 / Homebrew: ${character.allowHomebrew ? '开' : '关'}`}
              </PillButton>
            )}
            {charId && (
              <PillButton
                size="sm"
                variant="outline"
                onClick={() => router.push(`/sheet/view/?id=${encodeURIComponent(charId)}`)}
              >
                返回角色卡
              </PillButton>
            )}
          </div>
        }
      />

      {/* Progress Bar */}
      <div className={styles.progress}>
        <div className={styles.progress__bar}>
          {/* Background line */}
          <div className={styles.progress__line}>
            <div className={styles.progress__lineFill} style={{ width: `${progressPercent}%` }} />
          </div>

          {filteredSteps.map((step, i) => (
            <div key={step.path} className={styles.progress__step}>
              <div
                className={[
                  styles.progress__dot,
                  i === stepIndex ? styles['progress__dot--active'] : '',
                  i < stepIndex ? styles['progress__dot--done'] : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              />
              <span
                className={[
                  styles.progress__label,
                  i === stepIndex ? styles['progress__label--active'] : '',
                  i < stepIndex ? styles['progress__label--done'] : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                {step.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Step Content */}
      <main className={styles.builder__content}>{children}</main>

      {/* Footer Navigation */}
      <div className={styles.builder__footer}>
        <div className={styles.builder__footerInner}>
          <PillButton variant="outline" size="sm" onClick={handlePrev} disabled={stepIndex === 0}>
            <ChevronLeft size={14} />
            上一步
          </PillButton>

          <span className={styles.builder__footerInfo}>{STEPS[stepIndex]?.label}</span>

          <PillButton size="sm" onClick={handleNext}>
            {stepIndex === STEPS.length - 1 ? '完成' : '下一步'}
            {stepIndex < STEPS.length - 1 && <ChevronRight size={14} />}
          </PillButton>
        </div>
      </div>
    </div>
  );
}

export default function BuilderLayout({ children }: { children: React.ReactNode }) {
  return (
    <React.Suspense fallback={<div style={{ minHeight: '100vh' }} />}>
      <BuilderShell>{children}</BuilderShell>
    </React.Suspense>
  );
}
