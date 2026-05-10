import { useState } from 'react';
import { AppShell } from './components/AppShell';
import { FolderTabs, type FolderTabValue } from './components/FolderTabs';
import { ViewToggle, type ContentView } from './components/ViewToggle';
import { ListToolbar } from './components/ListToolbar';
import { TodoList } from './components/TodoList';
import { TodoInput } from './components/TodoInput';
import { TimelineView } from './components/TimelineView';
import { MixView } from './components/MixView';
import { TemplatePanel } from './components/templates/TemplatePanel';
import { useDayRollover } from './hooks/useDayRollover';
import { useSeedTemplates } from './components/templates/useSeedTemplates';
import { useTodoStore } from './store/useTodoStore';

function App() {
  useDayRollover();
  useSeedTemplates();

  const activeStoreDay = useTodoStore((s) => s.activeDay);
  const setStoreDay = useTodoStore((s) => s.setActiveDay);

  const [contentView, setContentView] = useState<ContentView>('list');
  const [templateOpen, setTemplateOpen] = useState(false);

  const activeTab: FolderTabValue =
    activeStoreDay === 'tomorrow' ? 'tomorrow' : 'today';

  return (
    <AppShell
      header={<FolderTabs activeTab={activeTab} onChange={(tab) => setStoreDay(tab)} />}
      footer={<TodoInput onTemplateClick={() => setTemplateOpen(true)} />}
      contentInset={52}
    >
      <ListToolbar day={activeStoreDay} />

      {contentView === 'timetable' ? (
        <TimelineView day={activeStoreDay} />
      ) : contentView === 'mix' ? (
        <MixView day={activeStoreDay} />
      ) : (
        <TodoList />
      )}

      <ViewToggle active={contentView} onChange={setContentView} />

      <TemplatePanel
        open={templateOpen}
        onClose={() => setTemplateOpen(false)}
      />
    </AppShell>
  );
}

export default App;
