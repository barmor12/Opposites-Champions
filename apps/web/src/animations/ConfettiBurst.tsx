import { useEffect, useRef } from 'react';
import { useConfettiBursts, type ConfettiBurstOptions } from './useConfettiBursts';

export interface ConfettiBurstProps extends ConfettiBurstOptions {
  /** כל שינוי בערך (שונה מ־0) יורה פרץ */
  trigger: number;
  x?: number;
  y?: number;
  className?: string;
}

/** גרסה דקלרטיבית: יורה פרץ בכל שינוי של trigger */
export function ConfettiBurst({ trigger, x = 50, y = 50, className, ...opts }: ConfettiBurstProps) {
  const [node, fire] = useConfettiBursts(opts);
  const last = useRef(0);
  useEffect(() => {
    if (trigger && trigger !== last.current) {
      last.current = trigger;
      fire(x, y);
    }
  }, [trigger, fire, x, y]);
  return <div className={className}>{node}</div>;
}
