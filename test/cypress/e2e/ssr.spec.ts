/*
 * Copyright (c) 2014-2025 Bjoern Kimminich & the OWASP Juice Shop contributors.
 * SPDX-License-Identifier: MIT
 */

describe('SSR Server-Side Resource Injection', () => {
  it('should inject a malicious stylesheet that displays a visible banner', () => {
    // This URL points to the malicious.css file served by the main Juice Shop app
    const maliciousUrl = '/assets/public/malicious.css'
    const urlToVisit = `/ssr/profile?themeUrl=${encodeURIComponent(maliciousUrl)}`

    // Step 1: Verify the <link> tag is in the raw server response
    cy.request(urlToVisit).its('body').should('include', `<link rel="stylesheet" href="${maliciousUrl}">`)

    // Step 2: Visit the page to trigger the browser to load the CSS
    cy.visit(urlToVisit)

    // Step 3: Pause for the video and to allow rendering
    cy.wait(2000)

    // Step 4: Verify the banner is visible
    cy.get('body').then(($body) => {
      const beforeStyles = window.getComputedStyle($body[0], '::before');
      expect(beforeStyles.content).to.equal('"SUCCESS: CSS was injected server-side!"');
      expect(beforeStyles.backgroundColor).to.equal('rgb(220, 20, 60)'); // crimson
    });
  })
})
