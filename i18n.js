(function exposeLowstateI18n(root) {
  const LANGUAGE_KEY = "type-todo.language.v1";
  const messages = {
    en: {
      todo: "TO DO", today: "TODAY", done: "DONE", all: "ALL", late: "LATE", urgent: "URGENT",
      filter: "FILTER", tags: "TAGS", unprocessed: "UNPROCESSED", processed: "PROCESSED",
      processAll: "PROCESS ALL", copyAll: "COPY ALL", language: "Language", trash: "Trash",
      restoreLast: "RESTORE LAST", emptyTrash: "EMPTY", taskFilters: "Task filters",
      welcomeTitle: "CAPTURE FIRST. ORGANIZE LATER.",
      welcomeBody: "Type a task, use ＋ for details, or press the global shortcut for instant capture.",
      emptyActive: "all quiet around here.", emptyActiveHint: "Type a task or press the quick-capture shortcut.",
      emptyToday: "nothing due today.", emptyTodayHint: "Enjoy the breathing room.",
      emptyDone: "nothing completed yet.", emptyDoneHint: "Small progress still counts.",
      emptyLate: "nothing overdue.", emptyLateHint: "You're all caught up.",
      emptyAll: "no tasks yet.", emptyAllHint: "Capture the first thing on your mind.",
      emptyCategory: "nothing in this category.", emptyCategoryHint: "Choose another filter or add a task.",
      emptyBrain: "nothing waiting to be processed.", emptyBrainHint: "Capture an idea, link, or note — #tags work too.",
      emptyBrainProcessed: "nothing processed yet.", emptyBrainProcessedHint: "Process notes or convert them into tasks.",
      taskDeleted: "Task moved to Trash", noteDeleted: "Note moved to Trash", undo: "UNDO",
      taskCompleted: "Task completed", taskReopened: "Task reopened", restored: "Restored from Trash",
      trashEmpty: "Trash is empty", trashCleared: "Trash emptied", converted: "Converted to task",
      brainProcessed: "Brain Inbox processed", copied: "Copied", copyFailed: "Couldn't copy to clipboard",
      date: "DATE", noCategory: "No category", newCategory: "＋ New category", noTags: "No tags yet",
      allTags: "All tags", confirmEmptyTrash: "Empty Trash permanently? This cannot be undone.",
      tasks: "TASKS", brainInbox: "BRAIN INBOX", normal: "NORMAL", tomorrow: "TOMORROW", weekend: "WEEKEND",
      nextWeek: "NEXT WEEK", noDate: "✕ NO DATE", appearance: "Appearance", style: "Style", theme: "Theme",
      textSize: "Text size", cover: "Cover", notebook: "NOTEBOOK", minimal: "MINIMAL", light: "LIGHT", dark: "DARK",
      small: "SMALL", large: "LARGE", data: "Data", backup: "⤓ BACKUP", restore: "⤒ RESTORE", shortcuts: "Shortcuts",
      taskPlaceholder: "type a task...", brainPlaceholder: "capture an idea, link, or note... #tag",
      settings: "Settings", back: "Back", window: "Window", alwaysOnTop: "Always on top", on: "ON", off: "OFF",
      globalDesktop: "Global (desktop app)", inApp: "In-app", showHide: "Show / hide the gadget",
      quickCapture: "Quick-capture a task", brainDump: "Brain dump", focusInput: "Focus the input", closeCancel: "Close / cancel",
      newTask: "New task", newBrain: "New brain capture", addTask: "Add task", addCapture: "Add capture",
      completeTask: "Complete task", reopenTask: "Reopen task", markProcessed: "Mark as processed", markUnprocessed: "Mark as unprocessed",
      clearedTasks: "{count} completed task(s) moved to Trash", backupSaved: "BACKUP SAVED",
    },
    pt: {
      todo: "A FAZER", today: "HOJE", done: "FEITAS", all: "TODAS", late: "ATRASADAS", urgent: "URGENTE",
      filter: "FILTRAR", tags: "TAGS", unprocessed: "PENDENTES", processed: "PROCESSADAS",
      processAll: "PROCESSAR", copyAll: "COPIAR", language: "Idioma", trash: "Lixeira",
      restoreLast: "RESTAURAR", emptyTrash: "ESVAZIAR", taskFilters: "Filtros de tarefas",
      welcomeTitle: "CAPTURE AGORA. ORGANIZE DEPOIS.",
      welcomeBody: "Digite uma tarefa, use ＋ para detalhes ou acione o atalho global para capturar na hora.",
      emptyActive: "tudo tranquilo por aqui.", emptyActiveHint: "Digite uma tarefa ou use o atalho de captura rápida.",
      emptyToday: "nada para hoje.", emptyTodayHint: "Aproveite o espaço para respirar.",
      emptyDone: "nada concluído ainda.", emptyDoneHint: "Todo pequeno progresso conta.",
      emptyLate: "nada atrasado.", emptyLateHint: "Está tudo em dia.",
      emptyAll: "nenhuma tarefa ainda.", emptyAllHint: "Capture a primeira coisa que vier à cabeça.",
      emptyCategory: "nada nesta categoria.", emptyCategoryHint: "Escolha outro filtro ou adicione uma tarefa.",
      emptyBrain: "nada esperando processamento.", emptyBrainHint: "Capture uma ideia, link ou nota — #tags também funcionam.",
      emptyBrainProcessed: "nada processado ainda.", emptyBrainProcessedHint: "Processe notas ou converta-as em tarefas.",
      taskDeleted: "Tarefa movida para a Lixeira", noteDeleted: "Nota movida para a Lixeira", undo: "DESFAZER",
      taskCompleted: "Tarefa concluída", taskReopened: "Tarefa reaberta", restored: "Restaurado da Lixeira",
      trashEmpty: "A Lixeira está vazia", trashCleared: "Lixeira esvaziada", converted: "Convertida em tarefa",
      brainProcessed: "Brain Inbox processado", copied: "Copiado", copyFailed: "Não foi possível copiar",
      date: "DATA", noCategory: "Sem categoria", newCategory: "＋ Nova categoria", noTags: "Nenhuma tag ainda",
      allTags: "Todas as tags", confirmEmptyTrash: "Esvaziar a Lixeira permanentemente? Esta ação não pode ser desfeita.",
      tasks: "TAREFAS", brainInbox: "BRAIN INBOX", normal: "NORMAL", tomorrow: "AMANHÃ", weekend: "FIM DE SEMANA",
      nextWeek: "PRÓXIMA SEMANA", noDate: "✕ SEM DATA", appearance: "Aparência", style: "Estilo", theme: "Tema",
      textSize: "Tamanho do texto", cover: "Capa", notebook: "CADERNO", minimal: "MINIMAL", light: "CLARO", dark: "ESCURO",
      small: "PEQUENO", large: "GRANDE", data: "Dados", backup: "⤓ BACKUP", restore: "⤒ RESTAURAR", shortcuts: "Atalhos",
      taskPlaceholder: "digite uma tarefa...", brainPlaceholder: "capture uma ideia, link ou nota... #tag",
      settings: "Configurações", back: "Voltar", window: "Janela", alwaysOnTop: "Sempre visível", on: "LIGADO", off: "DESLIGADO",
      globalDesktop: "Globais (app desktop)", inApp: "No app", showHide: "Mostrar / esconder o gadget",
      quickCapture: "Captura rápida de tarefa", brainDump: "Captura no Brain Inbox", focusInput: "Focar no campo", closeCancel: "Fechar / cancelar",
      newTask: "Nova tarefa", newBrain: "Nova captura mental", addTask: "Adicionar tarefa", addCapture: "Adicionar captura",
      completeTask: "Concluir tarefa", reopenTask: "Reabrir tarefa", markProcessed: "Marcar como processada", markUnprocessed: "Marcar como pendente",
      clearedTasks: "{count} tarefa(s) concluída(s) movida(s) para a Lixeira", backupSaved: "BACKUP SALVO",
    },
  };

  let language = root.localStorage?.getItem(LANGUAGE_KEY)
    || (root.navigator?.language?.toLowerCase().startsWith("pt") ? "pt" : "en");

  function t(key) {
    return messages[language]?.[key] || messages.en[key] || key;
  }

  function apply(container = root.document) {
    container?.querySelectorAll("[data-i18n]").forEach((element) => {
      element.textContent = t(element.dataset.i18n);
    });
    container?.querySelectorAll("[data-i18n-aria]").forEach((element) => {
      element.setAttribute("aria-label", t(element.dataset.i18nAria));
    });
    container?.querySelectorAll("[data-i18n-placeholder]").forEach((element) => {
      element.setAttribute("placeholder", t(element.dataset.i18nPlaceholder));
    });
    if (root.document?.documentElement) root.document.documentElement.lang = language === "pt" ? "pt-BR" : "en";
  }

  function setLanguage(next) {
    language = next === "pt" ? "pt" : "en";
    root.localStorage?.setItem(LANGUAGE_KEY, language);
    apply();
    return language;
  }

  root.LowstateI18n = { LANGUAGE_KEY, messages, t, apply, setLanguage, get language() { return language; } };
})(typeof globalThis !== "undefined" ? globalThis : this);
