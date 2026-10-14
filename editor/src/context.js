// Contexto do editor: o que qualquer componente pode precisar, sem repassar de pai para filho.
//   dispatch   -> aplica uma alteração ao estado (ver reducer em state.js)
//   schema     -> esquema dos blocos vindo do servidor
//   media      -> Map id -> imagem da biblioteca (para miniaturas); addMedia registra uma nova
//   focusLater -> foca um elemento (seletor CSS) depois que a tela for redesenhada
import { createContext, useContext } from "react";

export const EditorContext = createContext(null);
export const useEditor = () => useContext(EditorContext);
