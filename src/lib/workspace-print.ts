/** Applied only to the isolated PDF document, never to the workspace UI. */
export const WORKSPACE_PRINT_CSS = `
@page { size: A4; margin: 16mm; }
html, body.workspace-print {
  display: block !important;
  width: auto !important;
  height: auto !important;
  min-height: 0 !important;
  overflow: visible !important;
  margin: 0 !important;
  background: white !important;
  color: #202920 !important;
}
.workspace-print > *,
.workspace-print :is(.review-content, .pane-body, .coaching-journey, .direction-dialogue) {
  display: block !important;
  height: auto !important;
  min-height: 0 !important;
  max-height: none !important;
  overflow: visible !important;
  scrollbar-gutter: auto !important;
  zoom: 1 !important;
}
.workspace-print > *, .workspace-print :is(.pane-body, .coaching-journey) {
  width: 100% !important;
  max-width: none !important;
  padding: 0 !important;
  margin: 0 !important;
}
/* A whole session can span pages. Keeping it together leaves large blank areas. */
.workspace-print :is(article, section, fieldset, .quiet-card, .region-cards) {
  break-inside: auto;
}
.workspace-print :is(.cycle-exercises, .region-cards, .journey-summary-row) { display: block; }
.workspace-print .cycle-session { padding: 14px; }
.workspace-print .cycle-exercise { padding: 12px 0; }
.workspace-print :is(h1, h2, h3, h4, .cycle-session > header) { break-after: avoid; }
.workspace-print :is(p, li) { orphans: 3; widows: 3; }
.workspace-print :is(img, svg) { max-width: 100%; }
.workspace-print :is(button, form, dialog, [popover], [hidden], .cycle-session-picker,
  .journey-actions, .direction-draft-action, .direction-reference-footer) { display: none !important; }
.workspace-print h1 { font-size: 26px; }
`;
