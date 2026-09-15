import { memo } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Character } from '../../api/types';
import { CharacterCard } from '../CharacterCard';

interface SortableCharacterProps {
  character: Character;
}

export const SortableCharacter = memo(function SortableCharacter({ character }: SortableCharacterProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: String(character.id),
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 1000 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <CharacterCard character={character} isDragging={isDragging} />
    </div>
  );
});
