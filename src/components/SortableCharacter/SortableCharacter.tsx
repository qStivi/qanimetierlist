import { memo } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Character } from '../../api/types';
import { CharacterCard } from '../CharacterCard';

interface SortableCharacterProps {
  character: Character;
  onDelete: (characterId: number) => void;
}

export const SortableCharacter = memo(function SortableCharacter({ character, onDelete }: SortableCharacterProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: String(character.id),
    // dnd-kit's layout-change reorder animation (useDerivedTransform) assumes
    // reorders come one at a time from a live drag. The Randomize button can
    // reorder the entire pool at once, which drove that hook into a
    // "Maximum update depth exceeded" loop — disabling it removes the slide
    // animation on reorder but keeps the drag-in-progress transform below.
    animateLayoutChanges: () => false,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 1000 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <CharacterCard character={character} isDragging={isDragging} onDelete={onDelete} />
    </div>
  );
});
