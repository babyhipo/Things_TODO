import { useEffect, useRef, useState } from 'react';
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
import { formatTime } from '../../lib/timeFormatter';
import { parseTime } from '../../lib/timeParser';
import styles from './TemplateEditor.module.css';

interface LocalItem {
  localId: string;
  text: string;
  time: number | null;
  parentId: string | null;
  order: number;
}

function genId() {
  return `li-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function buildDisplayValue(item: LocalItem): string {
  if (item.time !== null) {
    return item.text ? `${formatTime(item.time)} ${item.text}` : formatTime(item.time);
  }
  return item.text;
}

/* ── 드래그 핸들 아이콘 ── */
function DragHandleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="3" y="4"  width="10" height="1.5" rx="0.75" fill="currentColor" />
      <rect x="3" y="7.25" width="10" height="1.5" rx="0.75" fill="currentColor" />
      <rect x="3" y="10.5" width="10" height="1.5" rx="0.75" fill="currentColor" />
    </svg>
  );
}

/* ── 개별 정렬 가능 항목 ── */
interface SortableItemProps {
  item: LocalItem;
  editingId: string | null;
  draft: string;
  onStartEdit: (item: LocalItem) => void;
  onDraftChange: (v: string) => void;
  onCommit: (localId: string) => void;
  onCancel: () => void;
  onDelete: (localId: string) => void;
}

function SortableItem({
  item,
  editingId,
  draft,
  onStartEdit,
  onDraftChange,
  onCommit,
  onCancel,
  onDelete,
}: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.localId });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.45 : undefined,
    zIndex: isDragging ? 10 : undefined,
  };

  const isEditing = editingId === item.localId;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`${styles.itemRow} ${isDragging ? styles.itemRowDragging : ''}`}
    >
      {/* 드래그 핸들 */}
      <button
        type="button"
        className={styles.dragHandle}
        aria-label="드래그로 순서 변경"
        {...attributes}
        {...listeners}
      >
        <DragHandleIcon />
      </button>

      {/* 시간 배지 (편집 중이 아닐 때만) */}
      {item.time !== null && !isEditing && (
        <span className={styles.timeBadge}>{formatTime(item.time)}</span>
      )}

      {/* 텍스트 / 편집 입력 */}
      {isEditing ? (
        <input
          type="text"
          className={styles.itemEditInput}
          value={draft}
          autoFocus
          onChange={(e) => onDraftChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter')  { e.preventDefault(); onCommit(item.localId); }
            if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
          }}
          onBlur={() => onCommit(item.localId)}
          placeholder="6시 기상..."
          autoComplete="off"
        />
      ) : (
        <button
          type="button"
          className={styles.itemText}
          onClick={() => onStartEdit(item)}
        >
          {item.text || <span className={styles.emptyText}>(내용 없음)</span>}
        </button>
      )}

      {/* 삭제 */}
      <button
        type="button"
        className={styles.itemDeleteBtn}
        onClick={() => onDelete(item.localId)}
        onMouseDown={(e) => e.preventDefault()}
        aria-label="항목 삭제"
      >
        ×
      </button>
    </div>
  );
}

/* ── 메인 에디터 ── */
interface TemplateEditorProps {
  templateId: string;
  onClose: () => void;
}

export function TemplateEditor({ templateId, onClose }: TemplateEditorProps) {
  const templates    = useTodoStore((s) => s.templates);
  const updateTemplate = useTodoStore((s) => s.updateTemplate);

  const template = templates.find((t) => t.id === templateId);

  const [name, setName] = useState(template?.name ?? '');
  const [items, setItems] = useState<LocalItem[]>(() =>
    (template?.items ?? [])
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((item) => ({
        localId: genId(),
        text: item.text,
        time: item.time,
        parentId: item.parentId,
        order: item.order,
      })),
  );

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft]         = useState('');
  const [addValue, setAddValue]   = useState('');
  const addInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor,   { activationConstraint: { delay: 150, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  if (!template) return null;

  /* ── 항목 편집 ── */
  const startEdit = (item: LocalItem) => {
    setEditingId(item.localId);
    setDraft(buildDisplayValue(item));
  };

  const commitEdit = (localId: string) => {
    const value = draft.trim();
    if (!value) {
      setItems((prev) => prev.filter((i) => i.localId !== localId));
    } else {
      const { time, cleanText } = parseTime(value);
      setItems((prev) =>
        prev.map((i) => (i.localId === localId ? { ...i, text: cleanText, time } : i)),
      );
    }
    setEditingId(null);
    setDraft('');
  };

  const cancelEdit = () => { setEditingId(null); setDraft(''); };

  const deleteItem = (localId: string) => {
    setItems((prev) => prev.filter((i) => i.localId !== localId));
  };

  /* ── 드래그 앤 드롭 ── */
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids      = items.map((i) => i.localId);
    const oldIndex = ids.indexOf(String(active.id));
    const newIndex = ids.indexOf(String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;
    setItems((prev) => arrayMove(prev, oldIndex, newIndex));
  };

  /* ── 항목 추가 ── */
  const addItem = () => {
    const value = addValue.trim();
    if (!value) return;
    const { time, cleanText } = parseTime(value);
    setItems((prev) => [
      ...prev,
      { localId: genId(), text: cleanText, time, parentId: null, order: prev.length },
    ]);
    setAddValue('');
    addInputRef.current?.focus();
  };

  /* ── 저장 ── */
  const handleSave = () => {
    const trimmedName = name.trim();
    if (!trimmedName) return;
    const templateItems = items.map((item, i) => ({
      text: item.text,
      time: item.time,
      parentId: item.parentId,
      tempId: genId(),
      order: i,
    }));
    updateTemplate(templateId, trimmedName, templateItems);
    onClose();
  };

  const itemIds = items.map((i) => i.localId);

  return (
    <>
      <div className={styles.backdrop} onClick={onClose} aria-hidden="true" />

      <div className={styles.sheet} role="dialog" aria-modal="true" aria-label="템플릿 수정">
        <div className={styles.dragHandle2} />

        {/* 헤더 */}
        <div className={styles.header}>
          <button type="button" className={styles.cancelBtn} onClick={onClose}>취소</button>
          <h2 className={styles.title}>템플릿 수정</h2>
          <button
            type="button"
            className={styles.saveBtn}
            onClick={handleSave}
            disabled={!name.trim()}
          >
            저장
          </button>
        </div>

        {/* 이름 */}
        <div className={styles.nameSection}>
          <label className={styles.sectionLabel}>이름</label>
          <input
            type="text"
            className={styles.nameInput}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="템플릿 이름"
            autoComplete="off"
          />
        </div>

        {/* 항목 목록 */}
        <div className={styles.itemList}>
          <p className={styles.sectionLabel} style={{ padding: '10px 16px 4px' }}>
            할 일 목록 ({items.length}개)
          </p>

          {items.length === 0 && (
            <p className={styles.emptyItems}>항목이 없습니다. 아래에서 추가해보세요.</p>
          )}

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
              {items.map((item) => (
                <SortableItem
                  key={item.localId}
                  item={item}
                  editingId={editingId}
                  draft={draft}
                  onStartEdit={startEdit}
                  onDraftChange={setDraft}
                  onCommit={commitEdit}
                  onCancel={cancelEdit}
                  onDelete={deleteItem}
                />
              ))}
            </SortableContext>
          </DndContext>
        </div>

        {/* 항목 추가 */}
        <div className={styles.addSection}>
          <input
            ref={addInputRef}
            type="text"
            className={styles.addInput}
            value={addValue}
            onChange={(e) => setAddValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addItem(); } }}
            placeholder="6시 기상, 8시 헬스..."
            autoComplete="off"
            enterKeyHint="done"
          />
          <button
            type="button"
            className={styles.addBtn}
            onClick={addItem}
            disabled={!addValue.trim()}
            aria-label="항목 추가"
          >
            +
          </button>
        </div>
      </div>
    </>
  );
}
