import { useEffect, useId } from 'react';
import { useTodoStore } from '../../store/useTodoStore';
import styles from './TemplatePanel.module.css';

interface TemplatePanelProps {
  open: boolean;
  onClose: () => void;
}

export function TemplatePanel({ open, onClose }: TemplatePanelProps) {
  const templates = useTodoStore((s) => s.templates);
  const activeDay = useTodoStore((s) => s.activeDay);
  const applyTemplate = useTodoStore((s) => s.applyTemplate);
  const saveAsTemplate = useTodoStore((s) => s.saveAsTemplate);
  const deleteTemplate = useTodoStore((s) => s.deleteTemplate);

  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const handleApply = (templateId: string) => {
    applyTemplate(activeDay, templateId);
    onClose();
  };

  const handleDelete = (templateId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteTemplate(templateId);
  };

  const handleSave = () => {
    const name = window.prompt('템플릿 이름을 입력하세요');
    if (name === null) return;
    const trimmed = name.trim();
    if (trimmed === '') return;
    saveAsTemplate(activeDay, trimmed);
  };

  const dayLabel = activeDay === 'today' ? '오늘 할 일' : '내일 계획';

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
        aria-labelledby={titleId}
        aria-hidden={!open}
      >
        <div className={styles.header}>
          <h2 id={titleId} className={styles.title}>
            템플릿
          </h2>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="닫기"
          >
            ×
          </button>
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
      </div>
    </>
  );
}
