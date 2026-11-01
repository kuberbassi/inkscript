import React from 'react';

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
    <div
      className="editor-toolbar"
      role="toolbar"
      aria-label="Text Formatting Toolbar"
      onMouseDown={preventFocusLoss}
    >
      {/* Row 1: Text Styles & Alignment (8 equal columns) */}
      <div className="toolbar-row">
        <button
          type="button"
          className="tool-btn"
          onClick={() => onCommand('bold')}
          title="Bold (Ctrl+B)"
        >
          <i className="ph-bold ph-text-b"></i>
        </button>
        <button
          type="button"
          className="tool-btn"
          onClick={() => onCommand('italic')}
          title="Italic (Ctrl+I)"
        >
          <i className="ph-bold ph-text-italic"></i>
        </button>
        <button
          type="button"
          className="tool-btn"
          onClick={() => onCommand('underline')}
          title="Underline (Ctrl+U)"
        >
          <i className="ph-bold ph-text-underline"></i>
        </button>
        <button
          type="button"
          className="tool-btn"
          onClick={() => onCommand('strikeThrough')}
          title="Strikethrough"
        >
          <i className="ph-bold ph-text-strikethrough"></i>
        </button>
        <button
          type="button"
          className="tool-btn"
          onClick={() => onCommand('justifyLeft')}
          title="Align Left"
        >
          <i className="ph-bold ph-text-align-left"></i>
        </button>
        <button
          type="button"
          className="tool-btn"
          onClick={() => onCommand('justifyCenter')}
          title="Align Center"
        >
          <i className="ph-bold ph-text-align-center"></i>
        </button>
        <button
          type="button"
          className="tool-btn"
          onClick={() => onCommand('justifyRight')}
          title="Align Right"
        >
          <i className="ph-bold ph-text-align-right"></i>
        </button>
        <button
          type="button"
          className="tool-btn"
          onClick={() => onCommand('justifyFull')}
          title="Justify Full"
        >
          <i className="ph-bold ph-text-align-justify"></i>
        </button>
      </div>

      {/* Row 2: Lists, Headings & Symbols (8 equal columns) */}
      <div className="toolbar-row">
        <button
          type="button"
          className="tool-btn"
          onClick={() => onCommand('insertUnorderedList')}
          title="Bullet List"
        >
          <i className="ph-bold ph-list-bullets"></i>
        </button>
        <button
          type="button"
          className="tool-btn"
          onClick={() => onCommand('insertOrderedList')}
          title="Numbered List"
        >
          <i className="ph-bold ph-list-numbers"></i>
        </button>
        <button
          type="button"
          className="tool-btn"
          onClick={onHeading1}
          title="Centered Underlined Heading"
        >
          <i className="ph-bold ph-text-h-one"></i>
        </button>
        <button
          type="button"
          className="tool-btn"
          onClick={() => onInsert('# ')}
          title="Insert # Symbol"
        >
          <i className="ph-bold ph-hash"></i>
        </button>
        <button
          type="button"
          className="tool-btn"
          onClick={() => onInsert('• ')}
          title="Insert Bullet Dot (•)"
        >
          <i className="ph-fill ph-dot-outline"></i>
        </button>
        <button
          type="button"
          className="tool-btn"
          onClick={() => onInsert('→ ')}
          title="Insert Arrow (→)"
        >
          <i className="ph-bold ph-arrow-right"></i>
        </button>
        <button
          type="button"
          className="tool-btn"
          onClick={() => onInsert('★ ')}
          title="Insert Star (★)"
        >
          <i className="ph-fill ph-star"></i>
        </button>
        <button
          type="button"
          className="tool-btn"
          onClick={() => onCommand('removeFormat')}
          title="Clear Formatting"
        >
          <i className="ph-bold ph-eraser"></i>
        </button>
      </div>
    </div>
  );
};
