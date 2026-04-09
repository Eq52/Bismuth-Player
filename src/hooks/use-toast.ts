// Lightweight toast utility for SimPlayer integration
// Simpler version adapted from shadcn/ui toast pattern

import * as React from 'react';

interface ToastProps {
  id?: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

type Toast = Omit<ToastProps, 'id'>;

const TOAST_LIMIT = 3;
const TOAST_REMOVE_DELAY = 5000;

interface ToasterToast extends Required<Pick<ToastProps, 'id'>>, Toast {}

let count = 0;
function genId() {
  count = (count + 1) % Number.MAX_SAFE_INTEGER;
  return count.toString();
}

// Simple global toast state
const listeners: Array<(state: ToasterToast[]) => void> = [];
let memoryState: ToasterToast[] = [];
const toastTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

function dispatch(action: { type: 'ADD' | 'REMOVE'; toast?: ToasterToast; toastId?: string }) {
  switch (action.type) {
    case 'ADD':
      if (action.toast) {
        memoryState = [action.toast, ...memoryState].slice(0, TOAST_LIMIT);
        listeners.forEach((listener) => listener(memoryState));
      }
      break;
    case 'REMOVE': {
      const id = action.toastId;
      memoryState = id ? memoryState.filter((t) => t.id !== id) : [];
      listeners.forEach((listener) => listener(memoryState));
      break;
    }
  }
}

function addToRemoveQueue(toastId: string) {
  if (toastTimeouts.has(toastId)) return;
  const timeout = setTimeout(() => {
    toastTimeouts.delete(toastId);
    dispatch({ type: 'REMOVE', toastId });
  }, TOAST_REMOVE_DELAY);
  toastTimeouts.set(toastId, timeout);
}

export function toast({ ...props }: Toast) {
  const id = genId();
  dispatch({
    type: 'ADD',
    toast: {
      ...props,
      id,
      open: true,
    },
  });
  addToRemoveQueue(id);
  return { id, dismiss: () => dispatch({ type: 'REMOVE', toastId: id }) };
}

export function useToast() {
  const [state, setState] = React.useState<ToasterToast[]>(memoryState);
  React.useEffect(() => {
    listeners.push(setState);
    return () => {
      const index = listeners.indexOf(setState);
      if (index > -1) listeners.splice(index, 1);
    };
  }, []);
  return {
    toasts: state,
    toast,
    dismiss: (toastId?: string) => dispatch({ type: 'REMOVE', toastId }),
  };
}
