import DOMPurify from 'dompurify';

class InsecureEditor extends HTMLElement {
  constructor() {
    super();
    const shadow = this.attachShadow({ mode: 'open' });

    // Add some professional styling
    const style = document.createElement('style');
    style.textContent = `
      .toolbar {
        background: #f0f0f0;
        padding: 5px;
        border: 1px solid #ccc;
        border-bottom: none;
        border-radius: 4px 4px 0 0;
      }
      button {
        font-family: Arial, sans-serif;
        border: 1px solid #ccc;
        background: #fff;
        padding: 5px 10px;
        cursor: pointer;
        border-radius: 3px;
      }
      button:hover {
        background: #eee;
      }
      textarea {
        border-radius: 0 0 4px 4px;
        border: 1px solid #ccc;
        box-sizing: border-box; /* Ensure padding doesn't add to width */
      }
    `;
    shadow.appendChild(style);

    // Create toolbar
    const toolbar = document.createElement('div');
    toolbar.classList.add('toolbar');
    toolbar.innerHTML = `
      <button id="bold"><b>B</b></button>
      <button id="italic"><i>I</i></button>
    `;
    shadow.appendChild(toolbar);

    // Create textarea
    const textarea = document.createElement('textarea');
    textarea.setAttribute('rows', '5');
    textarea.setAttribute('placeholder', 'Write your review here...');
    textarea.style.width = '100%';
    shadow.appendChild(textarea);

    // Add event listeners for formatting
    shadow.getElementById('bold').addEventListener('click', () => this.format('b'));
    shadow.getElementById('italic').addEventListener('click', () => this.format('i'));
  }

  format(tag) {
    const textarea = this.shadowRoot.querySelector('textarea');
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = textarea.value.substring(start, end);
    const newText = `<${tag}>${selectedText}</${tag}>`;
    textarea.value = textarea.value.substring(0, start) + newText + textarea.value.substring(end);
  }

  getRawHtml() {
    return this.shadowRoot.querySelector('textarea').value;
  }

  getSanitizedHtml() {
    const rawHtml = this.shadowRoot.querySelector('textarea').value;
    return DOMPurify.sanitize(rawHtml, {PARSER_MEDIA_TYPE: "application/xhtml+xml"});
  }
}

// Define the custom element
window.customElements.define('insecure-editor', InsecureEditor);
