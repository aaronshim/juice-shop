describe('Product Review', () => {
  beforeEach(() => {
    // For this test, we'll assume we are on a product page that includes the review component.
    // We can achieve this by visiting a product's details page.
    // Let's find a product and navigate to its page.
    cy.visit('/#/search')
    cy.get('.product').first().click()
  })

  it('should be vulnerable to XSS from the insecure rich text editor', () => {
    const xssPayload = `<img src=x onerror="var s=document.createElement('style');s.innerHTML='@keyframes f{0%{background:crimson}50%{background:#ff4757}100%{background:crimson}}';document.head.appendChild(s);var b=document.createElement('div');b.id='xss-banner';b.innerHTML='This page is vulnerable to XSS';b.style='position:fixed;bottom:0;left:0;width:100%;padding:1em;color:white;text-align:center;font-size:1.5em;font-weight:bold;z-index:9999;animation:f 2s infinite';document.body.appendChild(b);">`

    // Interact with the web component to set its value directly
    cy.get('insecure-editor').shadow().find('textarea').invoke('val', xssPayload).trigger('input')

    // Submit the review
    cy.get('app-product-review button').contains('Submit Review').click()
    cy.wait(1000) // Allow time for the component to re-render

    // Assert that the banner now exists
    cy.get('#xss-banner').should('exist')
    cy.wait(3000) // Wait for video
  })
})
