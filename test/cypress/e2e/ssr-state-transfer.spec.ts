describe('SSR State Transfer XSS', () => {
  it('should inject a visible XSS payload from the query parameter', () => {
    // This payload breaks out of the JSON state transfer script and injects a styled div
    const payload = encodeURIComponent(`</script><div id="xss-banner" style="background-color: crimson; color: white; padding: 1em; text-align: center; font-size: 1.2em; font-weight: bold;">XSS via State Transfer</div>`);

    cy.visit(`/ssr/profile-status?status=${payload}`);

    // Assert that the injected banner is visible
    cy.get('#xss-banner').should('be.visible').and('contain.text', 'XSS via State Transfer');

    // Give it a moment to be visually apparent in the video
    cy.wait(1000);
  });
});
