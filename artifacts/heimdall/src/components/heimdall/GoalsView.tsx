import { useEffect, useMemo, useState, type FormEvent, type KeyboardEvent } from 'react';
import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react';
import {
  cloneGoals,
  emptyGoal,
  loadGoalsDocument,
  publishGoals,
  type GoalItem,
  type GoalsDocument,
} from '@/lib/goals';

function ChipEditor({
  label,
  items,
  placeholder,
  testId,
  onChange,
}: {
  label: string;
  items: string[];
  placeholder: string;
  testId: string;
  onChange: (items: string[]) => void;
}) {
  const [draft, setDraft] = useState('');
  const add = () => {
    const value = draft.trim();
    if (!value || items.includes(value)) {
      setDraft('');
      return;
    }
    onChange([...items, value]);
    setDraft('');
  };
  const onKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      add();
    }
  };
  return (
    <section className="goals-block" data-testid={`section-${testId}`}>
      <h2>{label}</h2>
      <div className="chip-row">
        {items.map((item) => (
          <button
            key={item}
            type="button"
            className="goal-chip"
            onClick={() => onChange(items.filter((entry) => entry !== item))}
            aria-label={`Remove ${item}`}
            data-testid={`button-remove-${testId}-${item}`}
          >
            {item} <span aria-hidden="true">×</span>
          </button>
        ))}
      </div>
      <div className="chip-add">
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={onKey}
          placeholder={placeholder}
          aria-label={`Add ${label.toLowerCase()}`}
          data-testid={`input-add-${testId}`}
        />
        <button type="button" onClick={add} data-testid={`button-add-${testId}`}>Add</button>
      </div>
    </section>
  );
}

function GoalRow({
  goal,
  index,
  total,
  onChange,
  onMove,
  onDelete,
}: {
  goal: GoalItem;
  index: number;
  total: number;
  onChange: (goal: GoalItem) => void;
  onMove: (direction: -1 | 1) => void;
  onDelete: () => void;
}) {
  return (
    <article className={`goal-row ${goal.active ? '' : 'is-inactive'}`} data-testid={`card-goal-${goal.id}`}>
      <div className="goal-row-top">
        <label className="goal-active">
          <input
            type="checkbox"
            checked={goal.active}
            onChange={(event) => onChange({ ...goal, active: event.target.checked })}
            data-testid={`input-goal-active-${goal.id}`}
          />
          <span>{goal.active ? 'Active' : 'Off'}</span>
        </label>
        <div className="goal-reorder">
          <button type="button" aria-label="Move goal up" disabled={index === 0} onClick={() => onMove(-1)} data-testid={`button-goal-up-${goal.id}`}><ChevronUp size={16} /></button>
          <button type="button" aria-label="Move goal down" disabled={index === total - 1} onClick={() => onMove(1)} data-testid={`button-goal-down-${goal.id}`}><ChevronDown size={16} /></button>
          <button type="button" className="goal-delete" aria-label="Delete goal" onClick={onDelete} data-testid={`button-goal-delete-${goal.id}`}><Trash2 size={15} /></button>
        </div>
      </div>
      <input
        className="goal-title-input"
        value={goal.title}
        onChange={(event) => onChange({ ...goal, title: event.target.value })}
        placeholder="Goal title"
        aria-label="Goal title"
        data-testid={`input-goal-title-${goal.id}`}
      />
      <textarea
        className="goal-detail-input"
        value={goal.detail}
        onChange={(event) => onChange({ ...goal, detail: event.target.value })}
        placeholder="Optional detail"
        aria-label="Goal detail"
        rows={3}
        data-testid={`input-goal-detail-${goal.id}`}
      />
    </article>
  );
}

export function GoalsView({ reloadToken = 0 }: { reloadToken?: number }) {
  const [doc, setDoc] = useState<GoalsDocument | null>(null);
  const [baseline, setBaseline] = useState<string>('');
  const [unpublished, setUnpublished] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('');
  const [hintOnce, setHintOnce] = useState(false);

  const dirty = useMemo(() => (doc ? JSON.stringify(doc) !== baseline : false), [doc, baseline]);

  const load = async () => {
    setLoading(true);
    const result = await loadGoalsDocument();
    setDoc(result.doc);
    setBaseline(JSON.stringify(result.doc));
    setUnpublished(result.unpublished);
    setHintOnce(result.unpublished);
    setStatus(result.from === 'remote' ? 'Loaded /goals.json' : result.from === 'local' ? 'Loaded a local draft' : 'Loaded seeded goals');
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, [reloadToken]);

  const update = (patch: Partial<GoalsDocument>) => {
    setDoc((current) => (current ? { ...current, ...patch } : current));
  };

  const updateGoal = (index: number, next: GoalItem) => {
    setDoc((current) => {
      if (!current) return current;
      const goals = current.goals.map((goal, goalIndex) => (goalIndex === index ? next : goal));
      return { ...current, goals };
    });
  };

  const moveGoal = (index: number, direction: -1 | 1) => {
    setDoc((current) => {
      if (!current) return current;
      const target = index + direction;
      if (target < 0 || target >= current.goals.length) return current;
      const goals = [...current.goals];
      const [item] = goals.splice(index, 1);
      goals.splice(target, 0, item);
      return { ...current, goals };
    });
  };

  const deleteGoal = (index: number) => {
    const goal = doc?.goals[index];
    if (!goal) return;
    if (!window.confirm(`Delete “${goal.title || 'this goal'}”?`)) return;
    setDoc((current) => (current ? { ...current, goals: current.goals.filter((_, goalIndex) => goalIndex !== index) } : current));
  };

  const save = async (event?: FormEvent) => {
    event?.preventDefault();
    if (!doc || saving) return;
    setSaving(true);
    setStatus('Saving…');
    const result = await publishGoals(cloneGoals(doc));
    if (result.ok) {
      setDoc(result.doc);
      setBaseline(JSON.stringify(result.doc));
      setUnpublished(false);
      setHintOnce(false);
      setStatus('Published. /goals.json is the source of truth after Pages rebuilds.');
    } else {
      const local = cloneGoals(doc);
      local.updatedAt = new Date().toISOString();
      setDoc(local);
      setBaseline(JSON.stringify(local));
      setUnpublished(true);
      if (!hintOnce) setHintOnce(true);
      setStatus(result.message);
    }
    setSaving(false);
  };

  if (loading || !doc) {
    return <div className="goals-screen goals-loading" data-testid="status-goals-loading">Loading goals…</div>;
  }

  return (
    <form className="goals-screen" onSubmit={save} data-testid="form-goals">
      <div className="goals-toolbar">
        <p>Ranking spec for Feed Filter. Not a job tracker.</p>
        <button type="submit" className="post-submit" disabled={!dirty || saving} data-testid="button-save-goals">
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
      {hintOnce && (
        <div className="publish-hint" data-testid="status-goals-local-only">
          Saved on this device. Publishing live `/goals.json` needs `GITHUB_TOKEN` (or `GH_TOKEN`) on Cloudflare Pages.
        </div>
      )}
      <section className="goals-block">
        <h2>Current intent</h2>
        <input
          className="intent-input"
          value={doc.intent}
          onChange={(event) => update({ intent: event.target.value })}
          maxLength={280}
          placeholder="One-liner. Ranking reads this."
          aria-label="Current intent"
          data-testid="input-intent"
        />
      </section>
      <section className="goals-block">
        <div className="goals-block-head">
          <h2>Active goals</h2>
          <button
            type="button"
            className="text-action"
            onClick={() => update({ goals: [...doc.goals, emptyGoal()] })}
            data-testid="button-add-goal"
          >
            <Plus size={14} /> Add
          </button>
        </div>
        {doc.goals.map((goal, index) => (
          <GoalRow
            key={goal.id}
            goal={goal}
            index={index}
            total={doc.goals.length}
            onChange={(next) => updateGoal(index, next)}
            onMove={(direction) => moveGoal(index, direction)}
            onDelete={() => deleteGoal(index)}
          />
        ))}
      </section>
      <ChipEditor
        label="Exclude"
        items={doc.exclude}
        placeholder="Add an exclude"
        testId="exclude"
        onChange={(exclude) => update({ exclude })}
      />
      <ChipEditor
        label="Geos"
        items={doc.geos}
        placeholder="Optional city or country"
        testId="geos"
        onChange={(geos) => update({ geos })}
      />
      <p className="goals-status" data-testid="status-goals">{unpublished ? 'Local draft · ' : ''}{status}</p>
    </form>
  );
}
