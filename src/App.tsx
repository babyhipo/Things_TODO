import { useState } from 'react';
import { AppShell } from './components/AppShell';
import { FolderTabs, type FolderTabValue } from './components/FolderTabs';
import { ViewToggle, type ContentView } from './components/ViewToggle';
import { ListToolbar } from './components/ListToolbar';
import { TodoList } from './components/TodoList';
import { TodoInput } from './components/TodoInput';
import { MixView } from './components/MixView';
import { TemplatePanel } from './components/templates/TemplatePanel';
import { useDayRollover } from './hooks/useDayRollover';
import { useSeedTemplates } from './components/templates/useSeedTemplates';
import { useTodoStore } from './store/useTodoStore';
import { useSharedLink } from './hooks/useSharedLink';
import { SharedView } from './components/SharedView';

function App() {
  useDayRollover();
  useSeedTemplates();

  const activeStoreDay = useTodoStore((s) => s.activeDay);
  const setStoreDay = useTodoStore((s) => s.setActiveDay);

  const [contentView, setContentView] = useState<ContentView>('mix');
  const [templateOpen, setTemplateOpen] = useState(false);

  const activeTab: FolderTabValue =
    activeStoreDay === 'tomorrow' ? 'tomorrow' : 'today';

  // 공유 링크로 들어온 경우: 평소 화면 대신 보기 전용 화면만 보여준다
  const shared = useSharedLink();
  if (shared.state.status === 'loading') return null;
  if (shared.state.status === 'ready') {
    return <SharedView day={shared.state.day} onExit={shared.exit} />;
  }

  return (
    <AppShell
      header={
        <>
          <FolderTabs activeTab={activeTab} onChange={(tab) => setStoreDay(tab)} />
          <ListToolbar day={activeStoreDay} />
        </>
      }
      footer={<TodoInput onTemplateClick={() => setTemplateOpen(true)} />}
      contentInset={52}
    >
      {contentView === 'mix' ? (
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
