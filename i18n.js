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
      viewWeek: "Week", viewDay: "Day", viewMonth: "Month", viewHabits: "Habits", views: "Views",
      toSchedule: "To schedule", overdueTitle: "Overdue", moveAllToday: "All to today", moveToday: "Move to today",
      inboxPlaceholder: "Capture… #tag 14:30", addInline: "Add",
      goToday: "Today", previous: "Previous", next: "Next", weekNumber: "Week {n}", weekProgress: "{done} of {total} done",
      inboxEmpty: "Nothing waiting. Capture ideas here and drag them into a day.",
      dayEmpty: "Free",
      comingTitle: "Coming in the next step", comingDay: "A timeline of the day with time blocks — and, later, your imported calendars.",
      comingMonth: "The whole month at a glance, with a click to open any day.",
      comingHabits: "Recurring habits and weekly goals, tracked next to your tasks.",
      editItem: "Edit", fieldTitle: "Title", fieldDate: "Date", fieldTime: "Time", fieldDuration: "Duration",
      fieldCategory: "Category", fieldNotes: "Notes", notesPlaceholder: "Details, links, anything…",
      noTimeOption: "No time", noDateOption: "Unscheduled", tomorrowOption: "Tomorrow", nextWeekOption: "Next week",
      urgentToggle: "Urgent", save: "Save", cancel: "Cancel", deleteItem: "Delete", noneCategory: "None",
      newCategoryName: "New category", addCategory: "Add", itemDeleted: "Moved to Trash", itemRestored: "Restored",
      weekStartsOn: "Week starts on", monday: "MONDAY", sunday: "SUNDAY", trashCount: "{count} item(s) in Trash",
      restoreFailed: "Couldn't restore that file — is it a Lowstate backup?", confirmRestore: "Replace all current data with this backup?",
      updateAvailable: "Update {version}", download: "Download", close: "Close", markDone: "Mark as done", markOpen: "Mark as not done",
      migratedNotice: "Your tasks from the notebook were brought into the planner.",
      weeklyGoals: "Weekly goals", goalPlaceholder: "+ Add a goal for this week", removeGoal: "Remove goal",
      weekNotes: "Notes", notesFreePlaceholder: "Ideas, reflections, anything for this week…",
      holidays: "Holidays", holidaysBrazil: "BRAZIL", holidaysOff: "OFF", months: "Months",
      coverColor: "Cover color", coverGreen: "Green", coverNavy: "Navy", coverWine: "Wine", coverBlack: "Black",
      coverPink: "Pink", coverMustard: "Mustard", coverLavender: "Lavender", coverTeal: "Teal",
      quotes: "Page quote", quotesProverbs: "PROVERBS", quotesMotivational: "MOTIVATIONAL", quotesIronic: "IRONIC", quotesOff: "NONE",
      water: "Water", waterGlasses: "{n} of {total} glasses", waterLiters: "{n} of {total}", addGlass: "One more glass",
      removeGlass: "One glass less", glassN: "Glass {n}", waterUnit: "Count water in", waterUnitGlasses: "GLASSES",
      waterUnitLiters: "LITERS", glassSize: "Glass size", waterGoal: "Daily goal",
      dayMood: "Mood of the day", "mood-great": "Great", "mood-good": "Good", "mood-okay": "Okay", "mood-tiring": "Tiring", "mood-stressed": "Stressful", "mood-rough": "Rough",
      "moon-new": "New moon", "moon-waxing-crescent": "Waxing crescent", "moon-first-quarter": "First quarter",
      "moon-waxing-gibbous": "Waxing gibbous", "moon-full": "Full moon", "moon-waning-gibbous": "Waning gibbous",
      "moon-last-quarter": "Last quarter", "moon-waning-crescent": "Waning crescent",
      todayTasks: "For this day", dayCapturePlaceholder: "What do you need to do? #tag 14:30 !urgent",
      dayNotes: "Notes", dayNotesPlaceholder: "Thoughts, details, anything about this day…",
      dayOfYear: "Day {n} of {total}", addAtTime: "Add at {time}", moreItems: "+{n} more", openDay: "Open {date}",
      timeline: "Timeline", dayEmptyList: "Nothing here yet — start writing what this day needs.",
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
      viewWeek: "Semana", viewDay: "Dia", viewMonth: "Mês", viewHabits: "Hábitos", views: "Visões",
      toSchedule: "A agendar", overdueTitle: "Atrasadas", moveAllToday: "Tudo para hoje", moveToday: "Mover para hoje",
      inboxPlaceholder: "Capturar… #tag 14h", addInline: "Adicionar",
      goToday: "Hoje", previous: "Anterior", next: "Próxima", weekNumber: "Semana {n}", weekProgress: "{done} de {total} feitas",
      inboxEmpty: "Nada esperando. Capture ideias aqui e arraste para um dia.",
      dayEmpty: "Livre",
      comingTitle: "Chega na próxima etapa", comingDay: "Uma linha do tempo do dia com blocos de horário — e, depois, seus calendários importados.",
      comingMonth: "O mês inteiro de uma vez, com um clique para abrir qualquer dia.",
      comingHabits: "Hábitos recorrentes e metas da semana, ao lado das suas tarefas.",
      editItem: "Editar", fieldTitle: "Título", fieldDate: "Data", fieldTime: "Horário", fieldDuration: "Duração",
      fieldCategory: "Categoria", fieldNotes: "Notas", notesPlaceholder: "Detalhes, links, o que precisar…",
      noTimeOption: "Sem horário", noDateOption: "A agendar", tomorrowOption: "Amanhã", nextWeekOption: "Próxima semana",
      urgentToggle: "Urgente", save: "Salvar", cancel: "Cancelar", deleteItem: "Excluir", noneCategory: "Nenhuma",
      newCategoryName: "Nova categoria", addCategory: "Adicionar", itemDeleted: "Movido para a Lixeira", itemRestored: "Restaurado",
      weekStartsOn: "Semana começa na", monday: "SEGUNDA", sunday: "DOMINGO", trashCount: "{count} item(ns) na Lixeira",
      restoreFailed: "Não foi possível restaurar — é um backup do Lowstate?", confirmRestore: "Substituir todos os dados atuais por este backup?",
      updateAvailable: "Atualização {version}", download: "Baixar", close: "Fechar", markDone: "Marcar como feita", markOpen: "Marcar como não feita",
      migratedNotice: "Suas tarefas do caderno foram trazidas para o planner.",
      weeklyGoals: "Metas da semana", goalPlaceholder: "+ Adicionar uma meta para esta semana", removeGoal: "Remover meta",
      weekNotes: "Notas", notesFreePlaceholder: "Ideias, reflexões, o que quiser desta semana…",
      holidays: "Feriados", holidaysBrazil: "BRASIL", holidaysOff: "DESLIGADO", months: "Meses",
      coverColor: "Cor da capa", coverGreen: "Verde", coverNavy: "Azul-marinho", coverWine: "Vinho", coverBlack: "Preto",
      coverPink: "Rosa", coverMustard: "Mostarda", coverLavender: "Lavanda", coverTeal: "Azul-petróleo",
      quotes: "Frase da página", quotesProverbs: "PROVÉRBIOS", quotesMotivational: "MOTIVACIONAL", quotesIronic: "IRÔNICA", quotesOff: "NENHUMA",
      water: "Água", waterGlasses: "{n} de {total} copos", waterLiters: "{n} de {total}", addGlass: "Mais um copo",
      removeGlass: "Um copo a menos", glassN: "Copo {n}", waterUnit: "Contar água em", waterUnitGlasses: "COPOS",
      waterUnitLiters: "LITROS", glassSize: "Tamanho do copo", waterGoal: "Meta diária",
      dayMood: "Humor do dia", "mood-great": "Ótimo", "mood-good": "Bom", "mood-okay": "Normal", "mood-tiring": "Cansativo", "mood-stressed": "Estressante", "mood-rough": "Difícil",
      "moon-new": "Lua nova", "moon-waxing-crescent": "Lua crescente", "moon-first-quarter": "Quarto crescente",
      "moon-waxing-gibbous": "Crescente gibosa", "moon-full": "Lua cheia", "moon-waning-gibbous": "Minguante gibosa",
      "moon-last-quarter": "Quarto minguante", "moon-waning-crescent": "Lua minguante",
      todayTasks: "Para este dia", dayCapturePlaceholder: "O que você precisa fazer? #tag 14h !urgente",
      dayNotes: "Notas", dayNotesPlaceholder: "Pensamentos, detalhes, o que quiser deste dia…",
      dayOfYear: "Dia {n} de {total}", addAtTime: "Adicionar às {time}", moreItems: "+{n}", openDay: "Abrir {date}",
      timeline: "Horários", dayEmptyList: "Nada aqui ainda — comece a escrever o que este dia precisa.",
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
    container?.querySelectorAll("[data-i18n-title]").forEach((element) => {
      element.setAttribute("title", t(element.dataset.i18nTitle));
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
