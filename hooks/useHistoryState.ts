import { useState, useCallback } from 'react';

type SetStateAction<S> = S | ((prevState: S) => S);

export const useHistoryState = <T>(initialState: T | (() => T)) => {
  const [history, setHistory] = useState<T[]>(() => [
      typeof initialState === 'function' 
        ? (initialState as () => T)() 
        : initialState
  ]);
  const [index, setIndex] = useState(0);

  const state = history[index];

  const setState = useCallback((action: SetStateAction<T>) => {
    const newState = typeof action === 'function' 
      ? (action as (prevState: T) => T)(state) 
      : action;
    
    if (JSON.stringify(newState) === JSON.stringify(state)) {
        return;
    }

    const newHistory = history.slice(0, index + 1);
    newHistory.push(newState);
    
    setHistory(newHistory);
    setIndex(newHistory.length - 1);
  }, [history, index, state]);

  const undo = useCallback(() => {
    if (index > 0) {
      setIndex(prevIndex => prevIndex - 1);
    }
  }, [index]);

  const redo = useCallback(() => {
    if (index < history.length - 1) {
      setIndex(prevIndex => prevIndex + 1);
    }
  }, [index, history.length]);

  const canUndo = index > 0;
  const canRedo = index < history.length - 1;

  return { state, setState, undo, redo, canUndo, canRedo };
};
