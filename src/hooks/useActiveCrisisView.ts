import { useMemo } from 'react';
import { useCrisisStore } from '../store/crisisStore';
import { buildActiveCrisisView, type ActiveCrisisView } from '../utils/activeCrisisView';

export function useActiveCrisisView(): ActiveCrisisView | null {
  const currentPipeline = useCrisisStore((s) => s.currentPipeline);
  const pipelineStatus = useCrisisStore((s) => s.pipelineStatus);
  const activeCrises = useCrisisStore((s) => s.activeCrises);

  return useMemo(
    () => buildActiveCrisisView(currentPipeline, pipelineStatus, activeCrises),
    [currentPipeline, pipelineStatus, activeCrises],
  );
}
