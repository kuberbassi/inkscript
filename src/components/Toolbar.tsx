import React from 'react';
import WarmTooltip, { WarmTooltipGroup } from './reactbits/WarmTooltip';

interface ToolbarProps {
  onCommand: (cmd: string) => void;
  onInsert: (text: string) => void;
  onHeading1: () => void;
}

interface ToolItem {
  id: string;
  label: string;
  icon: string;
  shortcut?: string;
  action:
    | { type: 'cmd'; cmd: string }
    | { type: 'insert'; text: string }
    | { type: 'heading1' };
}

const TOOL_GROUPS: ToolItem[][] = [
  [
    { id: 'bold', label: 'Bold', icon: 'ph ph-text-b', shortcut: '⌘B', action: { type: 'cmd', cmd: 'bold' } },
    { id: 'italic', label: 'Italic', icon: 'ph ph-text-italic', shortcut: '⌘I', action: { type: 'cmd', cmd: 'italic' } },
    { id: 'underline', label: 'Underline', icon: 'ph ph-text-underline', shortcut: '⌘U', action: { type: 'cmd', cmd: 'underline' } },
    { id: 'strike', label: 'Strikethrough', icon: 'ph ph-text-strikethrough', shortcut: '⌘⇧X', action: { type: 'cmd', cmd: 'strikeThrough' } }
  ],
  [
    { id: 'align-left', label: 'Align Left', icon: 'ph ph-text-align-left', action: { type: 'cmd', cmd: 'justifyLeft' } },
    { id: 'align-center', label: 'Align Center', icon: 'ph ph-text-align-center', action: { type: 'cmd', cmd: 'justifyCenter' } },
    { id: 'align-right', label: 'Align Right', icon: 'ph ph-text-align-right', action: { type: 'cmd', cmd: 'justifyRight' } },
    { id: 'align-justify', label: 'Justify Full', icon: 'ph ph-text-align-justify', action: { type: 'cmd', cmd: 'justifyFull' } }
  ],
  [
    { id: 'bullet-list', label: 'Bullet List', icon: 'ph ph-list-bullets', shortcut: '•', action: { type: 'cmd', cmd: 'insertUnorderedList' } },
    { id: 'num-list', label: 'Numbered List', icon: 'ph ph-list-numbers', shortcut: '1.', action: { type: 'cmd', cmd: 'insertOrderedList' } },
    { id: 'h1', label: 'Centered Heading', icon: 'ph ph-text-h-one', shortcut: 'H1', action: { type: 'heading1' } }
  ],
  [
    { id: 'hash', label: 'Insert Hash', icon: 'ph ph-hash', shortcut: '#', action: { type: 'insert', text: '# ' } },
    { id: 'dot', label: 'Insert Bullet Dot', icon: 'ph-fill ph-dot-outline', shortcut: '•', action: { type: 'insert', text: '• ' } },
    { id: 'arrow', label: 'Insert Arrow', icon: 'ph ph-arrow-right', shortcut: '→', action: { type: 'insert', text: '→ ' } },
    { id: 'star', label: 'Insert Star', icon: 'ph ph-star', shortcut: '★', action: { type: 'insert', text: '★ ' } },
    { id: 'clear-fmt', label: 'Clear Formatting', icon: 'ph ph-eraser', shortcut: '⌘\\', action: { type: 'cmd', cmd: 'removeFormat' } }
  ]
];

export const Toolbar: React.FC<ToolbarProps> = ({
  onCommand,
  onInsert,
  onHeading1
}) => {
  const preventFocusLoss = (e: React.MouseEvent) => {
    e.preventDefault();
  };

  const handleTrigger = (item: ToolItem) => {
    if (item.action.type === 'cmd') {
      onCommand(item.action.cmd);
    } else if (item.action.type === 'insert') {
      onInsert(item.action.text);
    } else {
      onHeading1();
    }
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
          {TOOL_GROUPS.map((group, gIdx) => (
            <React.Fragment key={gIdx}>
              {gIdx > 0 && <span className="toolbar-divider" aria-hidden="true" />}
              {group.map((tool) => (
                <WarmTooltip
                  key={tool.id}
                  content={tool.label}
                  shortcut={tool.shortcut}
                  side="top"
                >
                  <button
                    type="button"
                    className="tool-btn"
                    onClick={() => handleTrigger(tool)}
                    aria-label={tool.label}
                  >
                    <i className={tool.icon}></i>
                  </button>
                </WarmTooltip>
              ))}
            </React.Fragment>
          ))}
        </div>
      </div>
    </WarmTooltipGroup>
  );
};
