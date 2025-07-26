describe('Basic Connectivity Test', () => {
  it('should visit the home page', () => {
    cy.visit('/');
    cy.contains('All Products');
  });
});
