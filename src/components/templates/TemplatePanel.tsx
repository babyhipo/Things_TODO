import { useEffect, useId, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useTodoStore } from '../../store/useTodoStore';
import { TemplateEditor } from './TemplateEditor';
import { formatTime } from '../../lib/timeFormatter';
import styles from './TemplatePanel.module.css';
import type { DayKey } from '../../types/todo';

function GripIcon() {
  return (
    <svg width="10" height="18" viewBox="0 0 10 18" fill="none" aria-hidden="true">
      <circle cx="5" cy="3"  r="1.5" fill="currentColor" />
      <circle cx="5" cy="9"  r="1.5" fill="currentColor" />
      <circle cx="5" cy="15" r="1.5" fill="currentColor" />
    </svg>
  );
}

function formatItemPreview(items: { text: string; time: number | null }[]): string {
  return items
    .map((it) => (it.time !== null ? `${formatTime(it.time)} ${it.text}` : it.text))
    .join('  ·  ');
}

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

interface SortableItemProps {
  tpl: { id: string; name: string; items: { text: string; time: number | null }[]; isBuiltIn?: boolean };
  onApply: (id: string, day?: DayKey) => void;
  onEdit: (id: string, e: React.MouseEvent) => void;
  onDelete: (id: string, e: React.MouseEvent) => void;
}

function SortableTemplateItem({ tpl, onApply, onEdit, onDelete }: SortableItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: tpl.id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.45 : undefined,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style} className={styles.item}>
      <div className={styles.itemInfo}>
        <span className={styles.itemName}>{tpl.name}</span>
        <span className={styles.itemDetail}>{formatItemPreview(tpl.items)}</span>
      </div>
      <div className={styles.itemActions}>
        <button type="button" className={styles.applyTodayBtn} onClick={() => onApply(tpl.id, 'today')}>오늘</button>
        <button type="button" className={styles.applyTomorrowBtn} onClick={() => onApply(tpl.id, 'tomorrow')}>내일</button>
        <button type="button" className={styles.editBtn} onClick={(e) => onEdit(tpl.id, e)} aria-label={`${tpl.name} 수정`}><PencilIcon /></button>
        {!tpl.isBuiltIn && (
          <button type="button" className={styles.deleteBtn} onClick={(e) => onDelete(tpl.id, e)} aria-label={`${tpl.name} 삭제`}>×</button>
        )}
        <button type="button" className={styles.gripHandle} aria-label="드래그로 순서 변경" {...attributes} {...listeners}>
          <GripIcon />
        </button>
      </div>
    </div>
  );
}

function TemplatePanelContent({ onClose, embedded }: { onClose?: () => void; embedded?: boolean }) {
  const templates = useTodoStore((s) => s.templates);
  const activeDay = useTodoStore((s) => s.activeDay);
  const applyTemplate = useTodoStore((s) => s.applyTemplate);
  const saveAsTemplate = useTodoStore((s) => s.saveAsTemplate);
  const deleteTemplate = useTodoStore((s) => s.deleteTemplate);
  const reorderTemplates = useTodoStore((s) => s.reorderTemplates);
  const titleId = useId(); // eslint-disable-line @typescript-eslint/no-unused-vars

  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = templates.map((t) => t.id);
    const oldIndex = ids.indexOf(String(active.id));
    const newIndex = ids.indexOf(String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;
    reorderTemplates(arrayMove(ids, oldIndex, newIndex));
  };

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
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={templates.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          <div className={styles.list}>
            {templates.length === 0 ? (
              <p className={styles.empty}>저장된 템플릿이 없습니다</p>
            ) : (
              templates.map((tpl) => (
                <SortableTemplateItem
                  key={tpl.id}
                  tpl={tpl}
                  onApply={handleApply}
                  onEdit={handleEditOpen}
                  onDelete={handleDelete}
                />
              ))
            )}
          </div>
        </SortableContext>
      </DndContext>

      {editingTemplateId && (
        <TemplateEditor
          templateId={editingTemplateId}
          onClose={() => setEditingTemplateId(null)}
        />
      )}
    </>
  );
}

export function TemplatePanel({ open, onClose, embedded }: TemplatePanelProps) {
  const activeDay = useTodoStore((s) => s.activeDay);
  const saveAsTemplate = useTodoStore((s) => s.saveAsTemplate);
  const createEmptyTemplate = useTodoStore((s) => s.createEmptyTemplate);
  const [newEditId, setNewEditId] = useState<string | null>(null);

  const handleCreateNew = () => {
    const id = createEmptyTemplate();
    setNewEditId(id);
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // 모달 열릴 때 배경 스크롤 잠금
  useEffect(() => {
    const main = document.querySelector('main') as HTMLElement | null;
    if (!main) return;
    if (open) {
      main.style.overflow = 'hidden';
      main.style.touchAction = 'none';
    } else {
      main.style.overflow = '';
      main.style.touchAction = '';
    }
    return () => {
      main.style.overflow = '';
      main.style.touchAction = '';
    };
  }, [open]);

  const handleSave = () => {
    const name = window.prompt('템플릿 이름을 입력하세요');
    if (name === null) return;
    const trimmed = name.trim();
    if (trimmed === '') return;
    saveAsTemplate(activeDay, trimmed);
  };

  if (embedded) {
    return <TemplatePanelContent embedded />;
  }

  return createPortal(
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
      <div className={`${styles.bottomBar} ${open ? styles.bottomBarOpen : ''}`}>
        <button
          type="button"
          className={styles.closeBtnFixed}
          onClick={onClose}
          aria-label="템플릿 닫기"
        >
          ×
        </button>
        <button
          type="button"
          className={styles.saveBtnFixed}
          onClick={handleSave}
        >
          +현재 일정 템플릿화
        </button>
        <button
          type="button"
          className={styles.createBtnFixed}
          onClick={handleCreateNew}
        >
          +새로 만들기
        </button>
      </div>

      {newEditId && (
        <TemplateEditor
          templateId={newEditId}
          onClose={() => setNewEditId(null)}
        />
      )}
    </>,
    document.body,
  );
}
