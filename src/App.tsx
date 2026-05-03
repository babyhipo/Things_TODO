import { useState } from 'react';
import { AppShell } from './components/AppShell';
import { DateHeader } from './components/DateHeader';
import { DayTabs, type DayTabValue } from './components/DayTabs';
import { BottomNav, type ViewMode } from './components/BottomNav';
import { TodoList } from './components/TodoList';
import { TodoInput } from './components/TodoInput';
import { TimelineView } from './components/TimelineView';
import { TemplatePanel } from './components/templates/TemplatePanel';
import { useDayRollover } from './hooks/useDayRollover';
import { useSeedTemplates } from './components/templates/useSeedTemplates';
import { useTodoStore } from './store/useTodoStore';

function App() {
  useDayRollover();
  useSeedTemplates();

  const activeStoreDay = useTodoStore((s) => s.activeDay);
  const setStoreDay = useTodoStore((s) => s.setActiveDay);

  const [viewMode, setViewMode] = useState<ViewMode>('list');

  // 날짜 탭의 현재 선택 (store day 또는 'template')
  const activeDayTab: DayTabValue =
    viewMode === 'template' ? 'template' : activeStoreDay;

  const handleDayTabChange = (tab: DayTabValue) => {
    if (tab === 'template') {
      setViewMode('template');
    } else {
      setStoreDay(tab);
      // template 모드에서 날짜 탭 클릭 시 목록 뷰로 복귀
      if (viewMode === 'template') setViewMode('list');
    }
  };

  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
  };

  const showInput = viewMode === 'list' || viewMode === 'timetable';

  return (
    <AppShell
      header={
        <>
          <DateHeader />
          <DayTabs activeTab={activeDayTab} onChange={handleDayTabChange} />
        </>
      }
      footer={showInput ? <TodoInput /> : null}
      bottomNav={<BottomNav active={viewMode} onChange={handleViewModeChange} />}
    >
      {viewMode === 'template' ? (
        <TemplatePanel embedded />
      ) : viewMode === 'timetable' ? (
        <TimelineView day={activeStoreDay} />
      ) : (
        <TodoList />
      )}
    </AppShell>
  );
}

export default App;
