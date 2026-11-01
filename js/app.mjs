import {
  addFontFromFile,
  formatText,
  copyFormattedAsMarkdown,
  addPaperFromFile,
  clearPaperBackground,
  applyStencilPreset,
  syncLineGrid
} from './utils/helpers.mjs';
import {
  generateImages,
  downloadAsPDF,
  deleteAll
} from './generate-images.mjs';
import { setInkColor, toggleDrawCanvas } from './utils/draw.mjs';

const pageEl = document.querySelector('.page-a');

const setTextareaStyle = (attrib, v) => (pageEl.style[attrib] = v);

const overlayEl = document.querySelector('.overlay');

/**
 * Add event listeners here, they will be automatically mapped with addEventListener later
 */
const EVENT_MAP = {
  '#generate-image-form': {
    on: 'submit',
    action: (e) => {
      e.preventDefault();
      generateImages();
    }
  },
  '#handwriting-font': {
    on: 'change',
    action: (e) => {
      document.body.style.setProperty('--handwriting-font', e.target.value);
      pageEl.style.fontFamily = e.target.value;
    }
  },
  '#font-size': {
    on: 'input',
    action: (e) => {
      const val = Number(e.target.value);
      if (val > 0 && val <= 30) {
        setTextareaStyle('fontSize', val + 'pt');
        syncLineGrid();
      }
    }
  },
  '#line-height': {
    on: 'input',
    action: (e) => {
      const val = Number(e.target.value);
      if (val >= 0.8 && val <= 4) {
        syncLineGrid();
      }
    }
  },
  '#letter-spacing': {
    on: 'input',
    action: (e) => {
      const val = Number(e.target.value);
      if (val >= -10 && val <= 40) {
        setTextareaStyle('letterSpacing', val + 'pt');
      }
    }
  },
  '#word-spacing': {
    on: 'input',
    action: (e) => {
      const val = Number(e.target.value);
      if (val >= -20 && val <= 100) {
        setTextareaStyle('wordSpacing', val + 'px');
      }
    }
  },
  '#top-padding': {
    on: 'input',
    action: () => {
      syncLineGrid();
    }
  },
  '#left-padding': {
    on: 'input',
    action: () => {
      syncLineGrid();
    }
  },
  '#font-file': {
    on: 'change',
    action: (e) => addFontFromFile(e.target.files[0])
  },
  '#ink-color': {
    on: 'change',
    action: (e) => {
      document.body.style.setProperty('--ink-color', e.target.value);
      pageEl.style.color = e.target.value;
      setInkColor(e.target.value);
    }
  },
  '#page-effects': {
    on: 'change',
    action: (e) => {
      const val = e.target.value;
      if (overlayEl) {
        overlayEl.classList.remove('shadows', 'scanner', 'no-effect');
        if (val === 'shadows' || val === 'scanner') {
          overlayEl.classList.add('shadows');
          overlayEl.style.background =
            'linear-gradient(75deg, rgba(0,0,0,0.28), rgba(0,0,0,0))';
        } else {
          overlayEl.style.background = 'none';
        }
      }
    }
  },
  '#paper-margin-toggle': {
    on: 'change',
    action: (e) => {
      const checked = e.target.checked;
      pageEl.classList.toggle('margined', checked);
      if (checked && pageEl.classList.contains('stencil-ruled')) {
        // Disable built-in stencil red margin if user explicitly turns on CSS margin
        pageEl.classList.remove('stencil-ruled');
        pageEl.classList.add('lines');
        const lineToggle = document.querySelector('#paper-line-toggle');
        if (lineToggle) {
          lineToggle.checked = true;
          const status = document.querySelector(
            'label[for="paper-line-toggle"] .status'
          );
          if (status) status.textContent = 'on';
        }
      }
      syncLineGrid();
    }
  },
  '#paper-line-toggle': {
    on: 'change',
    action: (e) => {
      const checked = e.target.checked;
      pageEl.classList.toggle('lines', checked);
      if (checked && pageEl.classList.contains('stencil-ruled')) {
        pageEl.classList.remove('stencil-ruled');
      }
      syncLineGrid();
    }
  },
  '#draw-diagram-button': {
    on: 'click',
    action: () => {
      toggleDrawCanvas();
    }
  },
  '.draw-container .close-button': {
    on: 'click',
    action: () => {
      toggleDrawCanvas();
    }
  },
  '#download-as-pdf-button': {
    on: 'click',
    action: () => {
      downloadAsPDF();
    }
  },
  '#delete-all-button': {
    on: 'click',
    action: () => {
      deleteAll();
    }
  },
  '.page-a .paper-content': {
    on: 'paste',
    action: formatText
  },
  '#paper-stencil-preset': {
    on: 'change',
    action: (e) => applyStencilPreset(e.target.value)
  },
  '#paper-file': {
    on: 'change',
    action: (e) => addPaperFromFile(e.target.files[0])
  },
  '#clear-paper-file': {
    on: 'click',
    action: () => clearPaperBackground()
  }
};

for (const eventSelector in EVENT_MAP) {
  const el = document.querySelector(eventSelector);
  if (el) {
    el.addEventListener(
      EVENT_MAP[eventSelector].on,
      EVENT_MAP[eventSelector].action
    );
  }
}

/**
 * This makes toggles, accessible.
 */
document.querySelectorAll('.switch-toggle input').forEach((toggleInput) => {
  toggleInput.addEventListener('change', () => {
    const labelStatus = document.querySelector(
      `label[for="${toggleInput.id}"] .status`
    );
    if (toggleInput.checked) {
      if (labelStatus) labelStatus.textContent = 'on';
      toggleInput.setAttribute('aria-checked', true);
    } else {
      toggleInput.setAttribute('aria-checked', false);
      if (labelStatus) labelStatus.textContent = 'off';
    }
  });
});


/**
 * Rich Text Editor Toolbar Listeners (Bold, Italic, Underline, Align, Bullets, Points, Symbols)
 */
const noteEditor = document.querySelector('#note');

if (noteEditor) {
  noteEditor.addEventListener('copy', copyFormattedAsMarkdown);
}

document.querySelectorAll('.editor-toolbar .tool-btn').forEach((btn) => {
  // Prevent button click from stealing selection focus out of #note
  btn.addEventListener('mousedown', (e) => {
    e.preventDefault();
  });

  btn.addEventListener('click', () => {
    if (noteEditor) noteEditor.focus();

    const cmd = btn.getAttribute('data-cmd');
    const insertText = btn.getAttribute('data-insert');
    const customAction = btn.getAttribute('data-action');

    if (cmd) {
      document.execCommand(cmd, false, null);
    } else if (insertText) {
      document.execCommand('insertText', false, insertText);
    } else if (customAction === 'heading') {
      document.execCommand('bold', false, null);
      document.execCommand('underline', false, null);
      document.execCommand('justifyCenter', false, null);
    }
  });
});


// Initialize the default selected stencil preset on startup
const initialPresetSelect = document.querySelector('#paper-stencil-preset');
if (initialPresetSelect) {
  applyStencilPreset(initialPresetSelect.value);
}
