// Desfazer/refazer. Como cada alteração gera um objeto novo (ver state.js), o histórico é só
// uma lista das versões anteriores (past) e das desfeitas (future) — nada é copiado à mão.
//
// "saved" guarda a versão que está gravada no servidor. "Há alterações não salvas?" passa a ser
// simplesmente doc !== saved: se você desfizer tudo até a versão salva, o aviso some sozinho.
import { reducer } from "./state.js";

const LIMIT = 100;     // passos guardados
const MERGE_MS = 800;  // digitação contínua no mesmo campo vira UM passo (Ctrl+Z não desfaz letra por letra)

export const initialHistory = { past: [], doc: null, future: [], saved: null, last: null };

export function historyReducer(state, action) {
  switch (action.type) {
    case "load":   // dados vindos do servidor: começa o histórico do zero
      return { past: [], doc: action.doc, future: [], saved: action.doc, last: null };
    case "start":  // página nova (modelo padrão ou em branco): ainda não existe versão salva
      return { past: [], doc: action.doc, future: [], saved: null, last: null };
    case "saved":  // salvou: a resposta do servidor vira a versão atual e a salva; o histórico continua
      return { ...state, doc: action.doc, saved: action.doc, last: null };
    case "undo":
      if (!state.past.length) return state;
      return { ...state, past: state.past.slice(0, -1), doc: state.past[state.past.length - 1], future: [state.doc, ...state.future], last: null };
    case "redo":
      if (!state.future.length) return state;
      return { ...state, past: [...state.past, state.doc], doc: state.future[0], future: state.future.slice(1), last: null };
    default: {
      const next = reducer(state.doc, action);
      if (next === state.doc) return state;
      const key = action.type === "set" ? action.path.join(".") : null;
      const merge = key && state.last && state.last.key === key && action.time - state.last.time < MERGE_MS;
      return {
        past: merge ? state.past : [...state.past, state.doc].slice(-LIMIT),
        doc: next,
        future: [], // uma alteração nova descarta o que tinha sido desfeito
        saved: state.saved,
        last: key ? { key, time: action.time } : null,
      };
    }
  }
}
