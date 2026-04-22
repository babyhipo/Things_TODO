import { useState } from 'react';
import { AppShell } from './components/AppShell';
import { DayTabs } from './components/DayTabs';
import { TodoList } from './components/TodoList';
import { TodoInput } from './components/TodoInput';
import { TemplatePanel } from './components/templates/TemplatePanel';
import { useDayRollover } from './hooks/useDayRollover';
import { useSeedTemplates } from './components/templates/useSeedTemplates';

function App() {
  useDayRollover();
  useSeedTemplates();

  const [templateOpen, setTemplateOpen] = useState(false);

  return (
    <>
      <AppShell
        header={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ flex: 1 }}>
              <DayTabs />
            </div>
            <button
              type="button"
              onClick={() => setTemplateOpen(true)}
              aria-label="템플릿 열기"
              style={{
                minWidth: 44,
                minHeight: 44,
                color: 'var(--color-text-muted, #8A8A82)',
                fontSize: 13,
                padding: '0 12px',
                cursor: 'pointer',
              }}
            >
              템플릿
            </button>
          </div>
        }
        footer={<TodoInput />}
      >
        <TodoList />
      </AppShell>
      <TemplatePanel open={templateOpen} onClose={() => setTemplateOpen(false)} />
    </>
  );
}

export default App;
