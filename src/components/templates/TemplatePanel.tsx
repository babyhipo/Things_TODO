import { useEffect, useId, useState } from 'react';
import { useTodoStore } from '../../store/useTodoStore';
import { TemplateEditor } from './TemplateEditor';
import styles from './TemplatePanel.module.css';
import type { DayKey } from '../../types/todo';

interface TemplatePanelProps {
  open?: boolean;
  onClose?: () => void;
  embedded?: boolean;
}

function PencilIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      />
      <path
        d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      />
    </svg>
  );
}

function TemplatePanelContent({ onClose, embedded }: { onClose?: () => void; embedded?: boolean }) {
  const templates = useTodoStore((s) => s.templates);
  const activeDay = useTodoStore((s) => s.activeDay);
  const applyTemplate = useTodoStore((s) => s.applyTemplate);
  const saveAsTemplate = useTodoStore((s) => s.saveAsTemplate);
  const deleteTemplate = useTodoStore((s) => s.deleteTemplate);
  const titleId = useId(); // eslint-disable-line @typescript-eslint/no-unused-vars

  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);

  const handleApply = (templateId: string, day?: DayKey) => {
    applyTemplate(day ?? activeDay, templateId);
    if (!embedded) onClose?.();
  };

  const handleDelete = (templateId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteTemplate(templateId);
  };

  const handleEditOpen = (templateId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingTemplateId(templateId);
  };

  const handleSave = () => {
    const name = window.prompt('템플릿 이름을 입력하세요');
    if (name === null) return;
    const trimmed = name.trim();
    if (trimmed === '') return;
    saveAsTemplate(activeDay, trimmed);
  };

  const dayLabel = activeDay === 'today' ? '오늘 할 일' : '내일 계획';

  if (embedded) {
    return (
      <div className={styles.embedded}>
        <div className={styles.embeddedHeader}>
          <h2 className={styles.embeddedTitle}>템플릿 관리</h2>
          <p className={styles.embeddedSubtitle}>
            자주 사용하는 일정을 템플릿으로 저장해두세요
          </p>
        </div>

        <div className={styles.list}>
          {templates.length === 0 ? (
            <div className={styles.emptyEmbedded}>
              <p className={styles.emptyTitle}>저장된 템플릿이 없습니다</p>
              <p className={styles.emptyDesc}>
                목록/시간표 탭에서 일정을 작성하고<br />아래 버튼으로 저장해보세요
              </p>
            </div>
          ) : (
            templates.map((tpl) => (
              <div key={tpl.id} className={styles.embeddedItem}>
                <div className={styles.embeddedItemInfo}>
                  <span className={styles.itemName}>{tpl.name}</span>
                  <span className={styles.itemMeta}>
                    {tpl.items.length}개 항목
                    {tpl.isBuiltIn ? ' · 기본' : ''}
                  </span>
                </div>

                <div className={styles.embeddedItemRight}>
                  <button
                    type="button"
                    className={styles.applyTodayBtn}
                    onClick={() => handleApply(tpl.id, 'today')}
                  >
                    오늘
                  </button>
                  <button
                    type="button"
                    className={styles.applyTomorrowBtn}
                    onClick={() => handleApply(tpl.id, 'tomorrow')}
                  >
                    내일
                  </button>
                  <button
                    type="button"
                    className={styles.editBtn}
                    onClick={(e) => handleEditOpen(tpl.id, e)}
                    aria-label={`${tpl.name} 수정`}
                    title="템플릿 수정"
                  >
                    <PencilIcon />
                  </button>
                  {!tpl.isBuiltIn && (
                    <button
                      type="button"
                      className={styles.deleteBtn}
                      onClick={(e) => handleDelete(tpl.id, e)}
                      aria-label={`${tpl.name} 삭제`}
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        <div className={styles.embeddedFooter}>
          <button type="button" className={styles.saveBtn} onClick={handleSave}>
            + 현재 '{dayLabel}'을 템플릿으로 저장
          </button>
        </div>

        {editingTemplateId && (
          <TemplateEditor
            templateId={editingTemplateId}
            onClose={() => setEditingTemplateId(null)}
          />
        )}
      </div>
    );
  }

  return (
    <>
      <div className={styles.header}>
        <h2 id={titleId} className={styles.title}>
          템플릿
        </h2>
        {onClose && (
          <button
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="닫기"
          >
            ×
          </button>
        )}
      </div>

      <div className={styles.list}>
        {templates.length === 0 ? (
          <p className={styles.empty}>저장된 템플릿이 없습니다</p>
        ) : (
          templates.map((tpl) => (
            <div key={tpl.id} className={styles.item}>
              <button
                type="button"
                className={styles.itemMain}
                onClick={() => handleApply(tpl.id)}
              >
                <span className={styles.itemName}>{tpl.name}</span>
                <span className={styles.itemMeta}>
                  {tpl.items.length}개 항목
                  {tpl.isBuiltIn ? ' · 기본' : ''}
                </span>
              </button>
              {!tpl.isBuiltIn && (
                <button
                  type="button"
                  className={styles.deleteBtn}
                  onClick={(e) => handleDelete(tpl.id, e)}
                  aria-label={`${tpl.name} 삭제`}
                >
                  삭제
                </button>
              )}
            </div>
          ))
        )}
      </div>

      <div className={styles.footer}>
        <button type="button" className={styles.saveBtn} onClick={handleSave}>
          + 현재 '{dayLabel}'을 템플릿으로 저장
        </button>
      </div>
    </>
  );
}

export function TemplatePanel({ open, onClose, embedded }: TemplatePanelProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (embedded) {
    return <TemplatePanelContent embedded />;
  }

  return (
    <>
      <div
        className={`${styles.backdrop} ${open ? styles.backdropOpen : ''}`}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className={`${styles.sheet} ${open ? styles.sheetOpen : ''}`}
        role="dialog"
        aria-modal="true"
        aria-hidden={!open}
      >
        <TemplatePanelContent onClose={onClose} />
      </div>
    </>
  );
}
