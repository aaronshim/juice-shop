describe('Live Product Preview DOM XSS', () => {
  it('should render a visible XSS payload in the preview pane', () => {
    // Directly visit the new live preview route
    cy.visit('/#/live-preview');

    // Use Cypress's built-in retry-ability to wait for the component to appear
    cy.get('app-live-product-preview', { timeout: 10000 }).should('be.visible');

    // Find the textarea and type the payload
    const payload = '<div id="xss-banner" style="background-color: crimson; color: white; padding: 1em; text-align: center; font-size: 1.2em; font-weight: bold;">XSS in Live Preview</div>';
    cy.get('app-live-product-preview textarea').type(payload, { parseSpecialCharSequences: false });

    // Assert that the injected banner is visible within the preview pane
    cy.get('app-live-product-preview .preview-pane').find('#xss-banner').should('be.visible').and('contain.text', 'XSS in Live Preview');

    // Give it a moment to be visually apparent in the video
    cy.wait(1000);
  });
});
