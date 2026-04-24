const DIALOG_BASE_Z_INDEX = 2000;

let dialogStackState = null;
let dialogIdSeed = 0;

function getDocumentRef() {
  return typeof document !== 'undefined' ? document : null;
}

function getWindowRef() {
  return typeof window !== 'undefined' ? window : null;
}

function ensureDialogStack() {
  const documentRef = getDocumentRef();
  if (!documentRef?.body) {
    return null;
  }

  if (dialogStackState?.documentRef === documentRef) {
    return dialogStackState;
  }

  const host = documentRef.createElement('div');
  host.className = 'task-dialog-stack';
  documentRef.body.appendChild(host);

  dialogStackState = {
    documentRef,
    host,
    dialogs: []
  };

  return dialogStackState;
}

function isTopDialog(dialogId) {
  const dialogs = dialogStackState?.dialogs || [];
  return dialogs.length > 0 && dialogs[dialogs.length - 1]?.id === dialogId;
}

function syncDialogStackState() {
  const dialogs = dialogStackState?.dialogs || [];
  const documentRef = dialogStackState?.documentRef;

  if (!documentRef?.body) {
    return;
  }

  documentRef.body.classList.toggle('task-dialog-open', dialogs.length > 0);

  dialogs.forEach((dialog, index) => {
    const isNested = index > 0;
    const isTopLayer = index === dialogs.length - 1;

    dialog.root.classList.toggle('task-dialog--nested', isNested);
    dialog.root.style.zIndex = String(DIALOG_BASE_Z_INDEX + index * 10);

    if (isTopLayer) {
      dialog.root.removeAttribute('aria-hidden');
      dialog.panel.setAttribute('aria-modal', 'true');
    } else {
      dialog.root.setAttribute('aria-hidden', 'true');
      dialog.panel.setAttribute('aria-modal', 'false');
    }
  });
}

function createDialogTemplate({ titleId, title, panelClassName = '' }) {
  const dialogPanelClassName = `task-dialog-panel ${panelClassName}`.trim();

  return `
    <div class="task-dialog-mask shared-overlay-mask" data-role="mask"></div>
    <div class="${dialogPanelClassName}" role="dialog" aria-modal="true" aria-labelledby="${titleId}">
      <div class="task-dialog-header">
        <h3 class="task-dialog-title" id="${titleId}">${title}</h3>
        <button type="button" class="task-dialog-close" data-role="cancel" aria-label="关闭">×</button>
      </div>
      <div class="task-dialog-body" data-role="body"></div>
    </div>
  `;
}

function focusDialogTarget(focusTarget) {
  const windowRef = getWindowRef();

  if (!focusTarget || typeof focusTarget.focus !== 'function') {
    return;
  }

  windowRef?.setTimeout(() => {
    focusTarget.focus();

    if (typeof focusTarget.setSelectionRange === 'function' && typeof focusTarget.value === 'string') {
      focusTarget.setSelectionRange(focusTarget.value.length, focusTarget.value.length);
    }
  }, 0);
}

function createDialogInstance(options = {}) {
  const stack = ensureDialogStack();
  if (!stack) {
    return null;
  }

  const {
    title = '操作确认',
    panelClassName = ''
  } = options;

  const root = stack.documentRef.createElement('div');
  const titleId = `taskDialogTitle-${++dialogIdSeed}`;

  root.className = 'task-dialog';
  root.innerHTML = createDialogTemplate({ titleId, title, panelClassName });
  stack.host.appendChild(root);

  const activeElement = stack.documentRef.activeElement;
  const hasHTMLElementConstructor = typeof HTMLElement !== 'undefined';

  const dialog = {
    id: titleId,
    root,
    panel: root.querySelector('.task-dialog-panel'),
    body: root.querySelector('[data-role="body"]'),
    closeButton: root.querySelector('[data-role="cancel"]'),
    resolver: null,
    cleanup: null,
    previousActiveElement: hasHTMLElementConstructor && activeElement instanceof HTMLElement ? activeElement : null
  };

  const handleRequestClose = () => {
    if (!isTopDialog(dialog.id)) {
      return;
    }

    closeDialog(dialog.id, { cancelled: true });
  };

  let mouseDownTarget = null;

  root.addEventListener('mousedown', event => {
    mouseDownTarget = event.target;
  });

  root.addEventListener('click', event => {
    const isClickOnMask = event.target === root || event.target?.dataset?.role === 'mask';
    const isMouseDownOnMask = mouseDownTarget === root || mouseDownTarget?.dataset?.role === 'mask';
    mouseDownTarget = null;
    if (isClickOnMask && isMouseDownOnMask) {
      handleRequestClose();
    }
  });

  dialog.closeButton?.addEventListener('click', handleRequestClose);

  root.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || !isTopDialog(dialog.id)) {
      return;
    }

    event.preventDefault();
    handleRequestClose();
  });

  return dialog;
}

function removeDialogInstance(dialog) {
  dialog.cleanup?.();
  dialog.body.innerHTML = '';
  dialog.root.remove();
}

function restoreDialogFocus(dialog) {
  if (dialog.previousActiveElement && typeof dialog.previousActiveElement.focus === 'function') {
    dialog.previousActiveElement.focus();
  }
}

function closeDialog(dialogId, result = { cancelled: true }) {
  const dialogs = dialogStackState?.dialogs;
  if (!dialogs?.length) {
    return;
  }

  const dialogIndex = dialogs.findIndex(dialog => dialog.id === dialogId);
  if (dialogIndex === -1) {
    return;
  }

  const [dialog] = dialogs.splice(dialogIndex, 1);
  const resolver = dialog.resolver;

  removeDialogInstance(dialog);
  syncDialogStackState();
  restoreDialogFocus(dialog);
  resolver?.(result);
}

function openStackedDialog(options = {}) {
  const dialog = createDialogInstance(options);
  if (!dialog) {
    return Promise.resolve({ cancelled: true });
  }

  dialogStackState.dialogs.push(dialog);
  syncDialogStackState();

  let renderResult = {};

  try {
    renderResult = typeof options.render === 'function'
      ? options.render({
          body: dialog.body,
          close: result => closeDialog(dialog.id, result),
          depth: dialogStackState.dialogs.length - 1
        }) || {}
      : {};
  } catch (error) {
    closeDialog(dialog.id, { cancelled: true, error });
    throw error;
  }

  dialog.cleanup = typeof renderResult.cleanup === 'function' ? renderResult.cleanup : null;
  focusDialogTarget(renderResult.focusTarget);

  return new Promise(resolve => {
    dialog.resolver = resolve;
  });
}

function createDialogContent(markup, setup) {
  const documentRef = getDocumentRef();
  if (!documentRef) {
    return {
      element: null,
      cleanup: null,
      focusTarget: null
    };
  }

  const wrapper = documentRef.createElement('div');
  wrapper.innerHTML = String(markup || '').trim();

  const element = wrapper.firstElementChild || documentRef.createElement('div');
  const setupResult = typeof setup === 'function' ? setup(element) || {} : {};

  return {
    element,
    cleanup: typeof setupResult.cleanup === 'function' ? setupResult.cleanup : null,
    focusTarget: setupResult.focusTarget || null
  };
}

function getDialogStackSize() {
  return dialogStackState?.dialogs.length || 0;
}

function resetDialogStackForTests() {
  const dialogs = dialogStackState?.dialogs || [];

  while (dialogs.length > 0) {
    const dialog = dialogs.pop();
    removeDialogInstance(dialog);
  }

  dialogStackState?.host?.remove();
  dialogStackState = null;
  dialogIdSeed = 0;
}

export {
  closeDialog,
  createDialogContent,
  getDialogStackSize,
  openStackedDialog,
  resetDialogStackForTests
};
