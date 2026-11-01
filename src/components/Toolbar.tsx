import React from 'react';
import WarmTooltip, { WarmTooltipGroup } from './reactbits/WarmTooltip';

interface ToolbarProps {
  onCommand: (cmd: string) => void;
  onInsert: (text: string) => void;
  onHeading1: () => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  onCommand,
  onInsert,
  onHeading1
}) => {
  const preventFocusLoss = (e: React.MouseEvent) => {
    e.preventDefault();
  };

  return (
    <WarmTooltipGroup delay={320} warmWindow={400}>
      <div
        className="editor-toolbar"
        role="toolbar"
        aria-label="Text Formatting Toolbar"
        onMouseDown={preventFocusLoss}
      >
        <div className="toolbar-pill-group">
          <WarmTooltip content="Bold" shortcut="⌘B" side="top">
            <button
              type="button"
              className="tool-btn"
              onClick={() => onCommand('bold')}
              aria-label="Bold"
            >
              <i className="ph ph-text-b"></i>
            </button>
          </WarmTooltip>

          <WarmTooltip content="Italic" shortcut="⌘I" side="top">
            <button
              type="button"
              className="tool-btn"
              onClick={() => onCommand('italic')}
              aria-label="Italic"
            >
              <i className="ph ph-text-italic"></i>
            </button>
          </WarmTooltip>

          <WarmTooltip content="Underline" shortcut="⌘U" side="top">
            <button
              type="button"
              className="tool-btn"
              onClick={() => onCommand('underline')}
              aria-label="Underline"
            >
              <i className="ph ph-text-underline"></i>
            </button>
          </WarmTooltip>

          <WarmTooltip content="Strikethrough" shortcut="⌘⇧X" side="top">
            <button
              type="button"
              className="tool-btn"
              onClick={() => onCommand('strikeThrough')}
              aria-label="Strikethrough"
            >
              <i className="ph ph-text-strikethrough"></i>
            </button>
          </WarmTooltip>

          <span className="toolbar-divider" aria-hidden="true" />

          <WarmTooltip content="Align Left" side="top">
            <button
              type="button"
              className="tool-btn"
              onClick={() => onCommand('justifyLeft')}
              aria-label="Align Left"
            >
              <i className="ph ph-text-align-left"></i>
            </button>
          </WarmTooltip>

          <WarmTooltip content="Align Center" side="top">
            <button
              type="button"
              className="tool-btn"
              onClick={() => onCommand('justifyCenter')}
              aria-label="Align Center"
            >
              <i className="ph ph-text-align-center"></i>
            </button>
          </WarmTooltip>

          <WarmTooltip content="Align Right" side="top">
            <button
              type="button"
              className="tool-btn"
              onClick={() => onCommand('justifyRight')}
              aria-label="Align Right"
            >
              <i className="ph ph-text-align-right"></i>
            </button>
          </WarmTooltip>

          <WarmTooltip content="Justify Full" side="top">
            <button
              type="button"
              className="tool-btn"
              onClick={() => onCommand('justifyFull')}
              aria-label="Justify Full"
            >
              <i className="ph ph-text-align-justify"></i>
            </button>
          </WarmTooltip>

          <span className="toolbar-divider" aria-hidden="true" />

          <WarmTooltip content="Bullet List" shortcut="•" side="top">
            <button
              type="button"
              className="tool-btn"
              onClick={() => onCommand('insertUnorderedList')}
              aria-label="Bullet List"
            >
              <i className="ph ph-list-bullets"></i>
            </button>
          </WarmTooltip>

          <WarmTooltip content="Numbered List" shortcut="1." side="top">
            <button
              type="button"
              className="tool-btn"
              onClick={() => onCommand('insertOrderedList')}
              aria-label="Numbered List"
            >
              <i className="ph ph-list-numbers"></i>
            </button>
          </WarmTooltip>

          <WarmTooltip content="Centered Heading" shortcut="H1" side="top">
            <button
              type="button"
              className="tool-btn"
              onClick={onHeading1}
              aria-label="Centered Heading"
            >
              <i className="ph ph-text-h-one"></i>
            </button>
          </WarmTooltip>

          <span className="toolbar-divider" aria-hidden="true" />

          <WarmTooltip content="Insert Hash" shortcut="#" side="top">
            <button
              type="button"
              className="tool-btn"
              onClick={() => onInsert('# ')}
              aria-label="Insert #"
            >
              <i className="ph ph-hash"></i>
            </button>
          </WarmTooltip>

          <WarmTooltip content="Insert Bullet Dot" shortcut="•" side="top">
            <button
              type="button"
              className="tool-btn"
              onClick={() => onInsert('• ')}
              aria-label="Insert Bullet Dot"
            >
              <i className="ph-fill ph-dot-outline"></i>
            </button>
          </WarmTooltip>

          <WarmTooltip content="Insert Arrow" shortcut="→" side="top">
            <button
              type="button"
              className="tool-btn"
              onClick={() => onInsert('→ ')}
              aria-label="Insert Arrow"
            >
              <i className="ph ph-arrow-right"></i>
            </button>
          </WarmTooltip>

          <WarmTooltip content="Insert Star" shortcut="★" side="top">
            <button
              type="button"
              className="tool-btn"
              onClick={() => onInsert('★ ')}
              aria-label="Insert Star"
            >
              <i className="ph ph-star"></i>
            </button>
          </WarmTooltip>

          <WarmTooltip content="Clear Formatting" shortcut="⌘\\" side="top">
            <button
              type="button"
              className="tool-btn"
              onClick={() => onCommand('removeFormat')}
              aria-label="Clear Formatting"
            >
              <i className="ph ph-eraser"></i>
            </button>
          </WarmTooltip>
        </div>
      </div>
    </WarmTooltipGroup>
  );
};
