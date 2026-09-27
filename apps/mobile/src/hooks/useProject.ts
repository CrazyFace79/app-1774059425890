import { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { errorMessage } from '../pure/flow';
import { loadProjectView, type ProjectView } from '../storage/library';

export function useProject(projectId: string): { view: ProjectView | null; loading: boolean; error: string | null } {
  const { revision } = useApp();
  const [view, setView] = useState<ProjectView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    void loadProjectView(projectId)
      .then((next) => {
        if (!alive) return;
        setView(next);
        setError(next ? null : 'El proyecto no existe.');
      })
      .catch((cause) => {
        if (alive) setError(errorMessage(cause));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [projectId, revision]);

  return { view, loading, error };
}
