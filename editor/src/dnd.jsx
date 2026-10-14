// Arrastar e soltar (dnd-kit), compartilhado por blocos e itens de lista.
// Funciona com mouse, toque e TECLADO: foco na alça ⠿, espaço/Enter para pegar, setas para
// mover, espaço/Enter para soltar, Esc para cancelar. Leitores de tela recebem as instruções
// e o andamento em português.
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";

const instructions = {
  draggable: "Para mover, pressione espaço ou Enter, use as setas para cima e para baixo e pressione espaço ou Enter de novo para soltar. Esc cancela.",
};

// ids: chaves (_key) na ordem atual; label(id): nome para anunciar; onMove(from, to): aplica a mudança.
export function SortableList({ ids, label, onMove, children }) {
  const sensors = useSensors(
    // distance: o arraste só começa após mover 5 px — um clique simples na alça não arrasta.
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const position = (id) => ids.indexOf(id) + 1;
  const announcements = {
    onDragStart: ({ active }) => `${label(active.id)} selecionado, na posição ${position(active.id)} de ${ids.length}.`,
    onDragOver: ({ active, over }) => (over ? `${label(active.id)} sobre a posição ${position(over.id)} de ${ids.length}.` : `${label(active.id)} fora da lista.`),
    onDragEnd: ({ active, over }) => (over ? `${label(active.id)} solto na posição ${position(over.id)} de ${ids.length}.` : `${label(active.id)} solto fora da lista; nada mudou.`),
    onDragCancel: ({ active }) => `Movimento cancelado. ${label(active.id)} voltou à posição ${position(active.id)}.`,
  };

  function handleDragEnd({ active, over }) {
    if (!over || active.id === over.id) return;
    onMove(ids.indexOf(active.id), ids.indexOf(over.id));
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter}
      onDragEnd={handleDragEnd} accessibility={{ announcements, screenReaderInstructions: instructions }}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>{children}</SortableContext>
    </DndContext>
  );
}

// Para o item: ref e estilo do elemento que se move, e props da alça que inicia o arraste.
export function useSortableItem(id) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id });
  return {
    itemRef: setNodeRef,
    // translate (sem scale): o item se desloca sem distorcer. Estilo via React = CSSOM, permitido pela CSP.
    itemStyle: { transform: transform ? `translate3d(0, ${Math.round(transform.y)}px, 0)` : undefined, transition },
    isDragging,
    handleProps: { ref: setActivatorNodeRef, ...attributes, ...listeners },
  };
}

// Alça de arraste (⠿).
export function DragHandle({ handleProps, label }) {
  return (
    <button type="button" className="drag-handle" aria-label={label} title="Arrastar para reordenar" {...handleProps}>
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        {[6, 12, 18].map((y) => [9, 15].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.6" fill="currentColor" />))}
      </svg>
    </button>
  );
}
