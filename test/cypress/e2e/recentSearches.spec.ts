/*
 * Copyright (c) 2014-2025 Bjoern Kimminich & the OWASP Juice Shop contributors.
 * SPDX-License-Identifier: MIT
 */

describe('Recent Searches', () => {
  beforeEach(() => {
    cy.visit('/#/search')
  })

  it('should store and display recent search terms', () => {
    cy.get('#searchQuery').click()
    cy.get('app-mat-search-bar input').type('apple{enter}')
    cy.wait(500) // Wait for processing
    cy.reload() // Re-visit to check for persistence
    cy.get('app-recent-searches li').should('contain', 'apple')
  })

  it('should demonstrate a persisted XSS vulnerability', () => {
    // This payload creates a flashy, animated banner at the bottom of the page.
    const xssPayload = `<img src=x onerror="var s=document.createElement('style');s.innerHTML='@keyframes f{0%{background:crimson}50%{background:#ff4757}100%{background:crimson}}';document.head.appendChild(s);var b=document.createElement('div');b.id='xss-banner';b.innerHTML='This page is vulnerable to XSS';b.style='position:fixed;bottom:0;left:0;width:100%;padding:1em;color:white;text-align:center;font-size:1.5em;font-weight:bold;z-index:9999;animation:f 2s infinite';document.body.appendChild(b);">`

    // 1. INJECT: Go to the search page and inject the payload into localStorage.
    cy.visit('/#/search')
    cy.get('app-mat-search-bar input').type(xssPayload, { parseSpecialCharSequences: false, force: true }).type('{enter}', { force: true })
    cy.wait(500) // Wait for search to complete

    // 2. VERIFY INITIAL TRIGGER: The banner should appear, triggered by the unsafe RecentSearchesComponent.
    cy.get('#xss-banner').should('exist')
    cy.wait(1000)

    // 3. NAVIGATE & HARD REFRESH: Go to a new page and perform a hard reload.
    cy.visit('/#/about')
    cy.reload(true) // The 'true' forces a hard refresh, clearing the DOM.

    // 4. VERIFY DISAPPEARANCE: The banner should be gone now.
    cy.get('#xss-banner').should('not.exist')
    cy.wait(1000)

    // 5. RETURN & VERIFY REAPPEARANCE: Go back to the search page. The component will re-read
    // from localStorage and the banner will be recreated.
    cy.visit('/#/search')
    cy.get('#xss-banner').should('exist')
    cy.wait(3000)
  })
})
