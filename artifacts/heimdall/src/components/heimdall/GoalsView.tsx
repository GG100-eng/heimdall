import { useState, type FormEvent, type KeyboardEvent } from 'react';
import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react';
import { newGoalId, type GoalsSpec } from '@/lib/goals';

function ChipList({
  label,
  values,
  placeholder,
  testId,
  onChange,
}: {
  label: string;
  values: string[];
  placeholder: string;
  testId: string;
  onChange: (values: string[]) => void;
}) {
  const [draft, setDraft] = useState('');
  const add = () => {
    const next = draft.trim();
    if (!next) return;
    if (values.some((value) => value.toLowerCase() === next.toLowerCase())) {
      setDraft('');
      return;
    }
    onChange([...values, next]);
    setDraft('');
  };
  return (
    <section className="goals-block" data-testid={`section-${testId}`}>
      <header className="goals-block-header"><h2>{label}</h2></header>
      <div className="chip-row">
        {values.map((value) => (
          <button
            key={value}
            type="button"
            className="goal-chip"
            onClick={() => onChange(values.filter((item) => item !== value))}
            aria-label={`Remove ${value}`}
            data-testid={`button-remove-${testId}-${value}`}
          >
            {value}<span aria-hidden="true">×</span>
          </button>
        ))}
      </div>
      <div className="chip-add">
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              add();
            }
          }}
          placeholder={placeholder}
          aria-label={`Add ${label.toLowerCase()}`}
          data-testid={`input-add-${testId}`}
        />
        <button type="button" onClick={add} data-testid={`button-add-${testId}`}>Add</button>
      </div>
    </section>
  );
}

export function GoalsView({
  spec,
  status,
  saving,
  source,
  onChange,
  onSave,
}: {
  spec: GoalsSpec;
  status: string;
  saving: boolean;
  source: 'live' | 'local' | 'seed';
  onChange: (spec: GoalsSpec) => void;
  onSave: () => void;
}) {
  const setGoal = (index: number, patch: Partial<GoalsSpec['goals'][number]>) => {
    onChange({
      ...spec,
      goals: spec.goals.map((goal, current) => (current === index ? { ...goal, ...patch } : goal)),
    });
  };
  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= spec.goals.length) return;
    const goals = [...spec.goals];
    const [item] = goals.splice(index, 1);
    goals.splice(target, 0, item);
    onChange({ ...spec, goals });
  };
  const addGoal = () => {
    onChange({
      ...spec,
      goals: [...spec.goals, { id: newGoalId(), title: '', detail: '', active: true }],
    });
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSave();
  };
  const sourceLabel = source === 'live' ? 'Live /goals.json' : source === 'local' ? 'Saved on this phone' : 'Seeded spec';
  return (
    <form className="goals-page" onSubmit={submit}>
      <p className="goals-lede">
        This is the ranking spec. Weekday pushes at 08:10 and 14:10 IST GET <code>/goals.json</code>.
      </p>
      <p className="goals-source" data-testid="text-goals-source">{sourceLabel}</p>

      <label className="goals-field">
        <span>Current intent</span>
        <input
          value={spec.intent}
          onChange={(event) => onChange({ ...spec, intent: event.target.value })}
          maxLength={120}
          placeholder="One line — what matters now"
          aria-label="Current intent"
          data-testid="input-intent"
        />
      </label>

      <section className="goals-block">
        <header className="goals-block-header">
          <h2>Goals</h2>
          <button type="button" className="goals-text-button" onClick={addGoal} data-testid="button-add-goal">
            <Plus size={15} /> Add
          </button>
        </header>
        <div className="goal-list">
          {spec.goals.map((goal, index) => (
            <article key={goal.id} className={`goal-card ${goal.active ? '' : 'is-inactive'}`} data-testid={`card-goal-${goal.id}`}>
              <div className="goal-toolbar">
                <div className="goal-reorder">
                  <button type="button" aria-label="Move goal up" disabled={index === 0} onClick={() => move(index, -1)} data-testid={`button-goal-up-${goal.id}`}><ChevronUp size={16} /></button>
                  <button type="button" aria-label="Move goal down" disabled={index === spec.goals.length - 1} onClick={() => move(index, 1)} data-testid={`button-goal-down-${goal.id}`}><ChevronDown size={16} /></button>
                </div>
                <label className="goal-active">
                  <input
                    type="checkbox"
                    checked={goal.active}
                    onChange={(event) => setGoal(index, { active: event.target.checked })}
                    data-testid={`input-goal-active-${goal.id}`}
                  />
                  {goal.active ? 'Active' : 'Off'}
                </label>
                <button
                  type="button"
                  className="goal-delete"
                  aria-label="Delete goal"
                  onClick={() => {
                    if (!goal.title || window.confirm('Delete this goal?')) {
                      onChange({ ...spec, goals: spec.goals.filter((item) => item.id !== goal.id) });
                    }
                  }}
                  data-testid={`button-goal-delete-${goal.id}`}
                >
                  <Trash2 size={15} />
                </button>
              </div>
              <textarea
                className="goal-title-input"
                value={goal.title}
                onChange={(event) => setGoal(index, { title: event.target.value })}
                placeholder="Goal title"
                aria-label="Goal title"
                rows={3}
                data-testid={`input-goal-title-${goal.id}`}
              />
              <textarea
                className="goal-detail-input"
                value={goal.detail}
                onChange={(event) => setGoal(index, { detail: event.target.value })}
                placeholder="Optional detail"
                aria-label="Goal detail"
                rows={2}
                data-testid={`input-goal-detail-${goal.id}`}
              />
            </article>
          ))}
        </div>
      </section>

      <ChipList
        label="Exclude"
        values={spec.exclude}
        placeholder="Add something ranking should skip"
        testId="exclude"
        onChange={(exclude) => onChange({ ...spec, exclude })}
      />
      <ChipList
        label="Geos"
        values={spec.geos}
        placeholder="Add a geo or remote"
        testId="geos"
        onChange={(geos) => onChange({ ...spec, geos })}
      />

      <div className="goals-save-bar">
        {status && <p className="goals-status goals-status-sticky" data-testid="text-goals-status" role="status">{status}</p>}
        <button type="submit" className="goals-save" disabled={saving} data-testid="button-save-goals">
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </form>
  );
}
