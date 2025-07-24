# Gemini CLI: Juice Shop Application Context

This document summarizes the key user flows, architectural patterns, and security analysis of the OWASP Juice Shop application. It also contains a detailed plan for introducing new features to demonstrate common XSS vulnerabilities and their mitigation using the `safevalues` library.

## 1. Overall Architecture & Routing

The application's structure is defined in `frontend/src/app/app.routing.ts`. Key characteristics include:

*   **Component-based Routing:** Each URL path is mapped to a specific Angular component responsible for that view.
*   **Route Guards:** The application uses `AdminGuard`, `LoginGuard`, and `AccountingGuard` to protect routes and enforce role-based access control.
*   **Lazy Loading:** Modules like `FaucetModule` and `WalletWeb3Module` are loaded asynchronously to improve initial load times.
*   **Nested Routes:** Features are grouped under parent routes for better organization (e.g., `/privacy-security`).
*   **Wildcard Route:** A `**` path redirects any unmatched URLs to the search page.

## 2. Core User Flows

### a. User Authentication

*   **Registration (`register.component.ts`):** Standard flow involving email, password, and a security question.
*   **Login (`login.component.ts`):** Supports email/password and Google OAuth. Manages JWTs and 2FA redirection.

### b. E-commerce & Shopping

*   **Product Search (`search-result.component.ts`):** Displays and filters products.
*   **Shopping Basket (`purchase-basket.component.ts`):** Manages cart contents, quantities, and totals.
*   **Checkout Process:** A multi-step flow starting from the basket, proceeding to address selection.

## 3. Hybrid Architecture: Server-Side Rendering

The application is a hybrid, using both a client-side Angular SPA and server-side rendering.
*   **Templating Engines:** The Express server (`server.ts`) uses **Pug** and **Handlebars** for specific routes.
*   **Server-Rendered Pages:**
    *   `/profile`: Renders `userProfile.pug`.
    *   `/promotion`: Renders `promotionVideo.pug`.
    *   `/ftp`, `/encryptionkeys`, etc.: Use `serve-index` to generate directory listings.

## 4. Safe DOM Value Construction (`safevalues` API)

The `safevalues` library is used for constructing safe DOM values from strings to prevent XSS.
*   **Core Principles:**
    *   **Default to Safe:** Strings are assumed unsafe and must be explicitly escaped or sanitized.
    *   **Composition:** Safe types can be combined, with any raw strings being automatically escaped.
    *   **Static Code, Dynamic Data:** A strong separation is enforced between static, trusted code (often in template literals) and dynamic, untrusted data (which is safely encoded).
*   **Serialization:** The "safe" contract is a runtime-only guarantee. To send a value across a boundary (e.g., `postMessage`), it must be unwrapped to a string, and the receiving end must re-validate it to create a new safe type.

## 5. XSS Exploit and `innerHTML` Analysis

A detailed analysis of the codebase reveals multiple XSS vectors, which are categorized below by their rendering sink.

### a. Exploits Rendered via Angular `innerHTML`

Most exploits, regardless of origin (persisted, reflected, DOM-based), use an `[innerHTML]` binding in an Angular component as their final execution sink.

*   **DOM & Reflected XSS:**
    *   `search-result.component.html`: `[innerHTML]="searchValue"` renders the un-sanitized search query.
    *   `track-result/track-result.component.html`: `[innerHtml]="results.orderNo"` renders the un-sanitized order ID from the URL.
*   **Persisted XSS (from various sources):**
    *   `last-login-ip.component.html`: Renders a manipulated IP address from HTTP headers.
    *   `product-details/product-details.component.html`: Renders a malicious product description injected via the API.
    *   `administration/administration.component.html`: Renders malicious user emails or feedback comments.
*   **Persisted XSS (via Feedback - Newly Discovered Vector):**
    *   `about/about.component.html`: `[innerHTML]="item?.args"` renders un-sanitized user feedback in a slideshow.
    *   `feedback-details/feedback-details.component.html`: `[innerHTML]="feedback"` renders the full, un-sanitized user feedback in a dialog.

### b. Exploit Rendered via Server-Side Templating

One major exploit bypasses Angular entirely, highlighting the risks of the hybrid architecture.

*   **CSP Bypass:** This exploit targets the username field on the `/profile` page. Analysis of `routes/userProfile.ts` confirms this page is rendered entirely on the server using **Pug**. The code manually replaces a `_username_` placeholder, allowing a server-side sanitization bypass to succeed.

### c. Investigated `innerHTML` Bindings (Benign)

The following `innerHTML` locations were investigated and deemed safe from direct user-controlled input, as they render data from trusted server-side files (configuration, translation, or challenge definitions) or from secure, machine-generated sources.

*   `welcome-banner/welcome-banner.component.html`
*   `data-export/data-export.component.html` (CAPTCHA)
*   `score-board/` (all components)
*   All usages of the `translate` pipe (e.g., in `payment.component.html`, `token-sale.component.html`).

### d. Supporting Evidence from Code Analysis

This section details the key code locations that support the conclusions of the XSS analysis.

*   **Server-Side Rendering of Profile Page (CSP Bypass Vector):**
    *   **Location:** `routes/userProfile.ts`
    *   **Analysis:** The route handler for `/profile` does not use the Angular framework. It manually reads the `userProfile.pug` template, performs a direct string replacement for the username, and then renders the result using the `pug` engine. This confirms the CSP Bypass exploit is executed entirely on the server side.
    *   **Key Snippet:**
        ```typescript
        // in routes/userProfile.ts
        template = await fs.readFile('views/userProfile.pug', { encoding: 'utf-8' })
        // ...
        template = template.replace(/_username_/g, username)
        // ...
        const fn = pug.compile(template)
        res.send(fn(user));
        ```

*   **Persisted XSS via User Feedback (Newly Discovered Vector):**
    *   **Location:** `frontend/src/app/about/about.component.ts`
    *   **Analysis:** The `populateSlideshowFromFeedbacks` function fetches user feedback. It then wraps the user-controlled `comment` in a `<span>` and explicitly trusts the resulting HTML string using `bypassSecurityTrustHtml`. This trusted value is then passed to the gallery component, which renders it via `innerHTML`, creating a persisted XSS vulnerability.
    *   **Key Snippet:**
        ```typescript
        // in frontend/src/app/about/about.component.ts
        feedbacks[i].comment = `<span ...>${feedbacks[i].comment}<br/>...</span>`
        feedbacks[i].comment = this.sanitizer.bypassSecurityTrustHtml(
          feedbacks[i].comment
        )
        this.galleryRef.addImage({
          src: ...,
          args: feedbacks[i].comment // This is rendered by innerHTML
        });
        ```

*   **Verification of CAPCHA Generation (Benign `innerHTML`):**
    *   **Location:** `routes/imageCaptcha.ts`
    *   **Analysis:** The `/rest/image-captcha` endpoint uses the `svg-captcha` library to generate CAPTCHAs. The `svgCaptcha.create()` function is called with hardcoded parameters. No user-controlled input is used in the SVG generation process, making the resulting SVG safe to render via `innerHTML`.
    *   **Key Snippet:**
        ```typescript
        // in routes/imageCaptcha.ts
        import svgCaptcha from 'svg-captcha'
        // ...
        const captcha = svgCaptcha.create({ size: 5, noise: 2, color: true })
        // ...
        const imageCaptcha = {
          image: captcha.data, // The generated SVG
          answer: captcha.text,
          // ...
        };
        ```

## 6. Implementation Plan: Demonstrating `safevalues` with New XSS Vectors

This section outlines a strategic plan to introduce six new, plausible features, each containing a distinct XSS vulnerability. The goal is to create a "before and after" scenario where each vulnerability can be fixed by applying a specific `safevalues` pattern, thereby demonstrating its utility and covering a range of modern web security challenges.

### a. Overall Strategy
1.  **Introduce Client-Side Vulnerabilities:** Five vulnerabilities will be added to the existing client-side rendered Angular application.
2.  **Introduce a Server-Side Vulnerability:** One vulnerability will be created in a **new, standalone Angular SSR application**. This will demonstrate a subtle but critical SSR-specific exploit (`TransferState` XSS) in an isolated environment.
3.  **Integrate via Reverse Proxy:** The main Juice Shop Express server will be configured to act as a reverse proxy, forwarding requests to a specific route (e.g., `/profile-ssr`) to the new, standalone SSR micro-app.

### b. Detailed Feature & Vulnerability Plan

| Feature | Vulnerability Origin | The Mistake (Vulnerability) | The `safevalues` Principle to Fix It |
| :--- | :--- | :--- | :--- |
| **1. Recent Searches** | **Developer Mistake** | Rendering raw search terms from `localStorage` with `innerHTML`, causing **persisted DOM XSS**. | **`htmlEscape`** |
| **2. Rich Text Product Reviews** | **Supply-Chain Vulnerability** (Insecure 3rd-party WYSIWYG editor) | Trusting the raw HTML output of a third-party library (`editor.getRawHtml()`) and rendering it with `innerHTML`, allowing malicious tags. | **HTML Sanitizer Process** |
| **3. Product View Analytics** | **Developer Mistake** | Building a script via unsafe string concatenation (`'track("' + product.name + '")'`), allowing quotes to break out and cause XSS. | **`safeScriptWithArgs`** |
| **4. Profile Status Message** | **SSR Framework Pitfall** | **State Transfer XSS:** Placing un-sanitized user data into `TransferState`, which is then serialized into the initial HTML, breaking out of the state-transfer script block. | **Server-Side Sanitization before State Transfer** |
| **5. Custom Profile Theme** | **Developer Mistake** | Injecting a user-provided string directly into an inline `style` attribute, allowing for **CSS Injection** and data exfiltration. | **CSS Sanitization** (via `HtmlSanitizer`) & Input Validation |
| **6. Live Product Preview** | **Developer Mistake** | On every input event, rendering raw text from a `textarea` directly into a `div` using `innerHTML`, causing **immediate, self-contained DOM XSS**. | **HTML Sanitizer Process** |

### c. Real-World Parallels

To ensure the planned features are believable, they are grounded in common patterns from well-known websites.

*   **Recent Searches:** A ubiquitous feature on e-commerce sites like **Amazon** and **eBay** to improve user convenience.
*   **Rich Text Product Reviews:** Common on review-centric platforms like **Amazon** and **Yelp**. The vulnerability simulates a developer incorrectly trusting the raw HTML output from a third-party WYSIWYG editor library.
*   **Product View Analytics:** An invisible but universal practice on all e-commerce sites (**Shopify stores**, etc.) to send tracking events to services like Google Analytics.
*   **Profile Status Message (SSR):** The feature itself is common to all social media (**LinkedIn**, **Twitter**, **Facebook**). The pattern of pre-fetching this content on the server is a standard performance optimization for any high-traffic site.
*   **Custom Profile Theme:** A popular feature on platforms like **Discord** and **Twitter**. It's a modern, limited version of the extensive theming once offered by sites like **Myspace**.
*   **Live Product Preview:** A cornerstone feature for the massive online market of customizable goods, used by sites like **Vistaprint** and **Shutterfly** to show customers a real-time preview of their personalized products.

## 6a. Detailed Implementation Scenarios

This section provides a detailed, step-by-step guide for implementing each of the vulnerable features outlined in the plan, including a comprehensive testing strategy.

### Scenario 1: Recent Searches - Detailed Plan (with Testing)

The goal is to create a "Recent Searches" feature that is vulnerable to persisted DOM-XSS. The testing plan will verify both the feature's functionality and the existence of the vulnerability.

---

#### **Part A: Implementation Plan**

**Step 1: Generate the `RecentSearches` Component**
*   **Action:** Run `ng generate component recent-searches` from the `frontend` directory.
*   **Status:** ✅ **Done**

**Step 2: Implement Vulnerable Component Logic and Template**
*   **File:** `frontend/src/app/recent-searches/recent-searches.component.ts`
*   **Logic:** In `ngOnInit`, read a JSON array of strings from `localStorage.getItem('recentSearches')` and assign it to a public `recentSearches` property.
*   **Status:** ✅ **Done**
*   **File:** `frontend/src/app/recent-searches/recent-searches.component.html`
*   **Template (Vulnerability Sink):** Use `*ngFor` to loop through the `recentSearches` array and render each term inside an `<li>` element using the `[innerHTML]` binding.
*   **Status:** ✅ **Done**

**Step 3: Modify `SearchResultComponent` to Store Search Terms**
*   **File:** `frontend/src/app/search-result/search-result.component.ts`
*   **Logic:** In the method that handles new searches, add logic to:
    1.  Read the existing `recentSearches` from `localStorage`.
    2.  Prepend the new search term to the array.
    3.  Limit the array to the 5 most recent terms using `slice(0, 5)`.
    4.  Write the updated array back to `localStorage` with `setItem`.
*   **Status:** ✅ **Done**

**Step 4: Integrate the New Component into the UI**
*   **File:** `frontend/src/app/search-result/search-result.component.html`
*   **Action:** Add the component's selector, `<app-recent-searches></app-recent-searches>`, to the search results page.
*   **Status:** ✅ **Done**

---

#### **Part B: Testing Plan**

After the implementation is complete, I will execute the following tests.

**Step 5: Unit Tests**

I will add unit tests to verify the logic of the two modified components in isolation.

*   **For `RecentSearchesComponent` (`recent-searches.component.spec.ts`):**
    *   **Test 1: Displaying Searches:** Mock `localStorage.getItem` to return a sample array of search terms. Verify that the component correctly reads this data and that the rendered HTML contains the expected `<li>` elements.
    *   **Test 2: Handling No Searches:** Mock `localStorage.getItem` to return `null`. Verify that the component's view does not render the "Recent Searches" list.

*   **For `SearchResultComponent` (`search-result.component.spec.ts`):**
    *   **Test 1: Storing a New Search:** Mock `localStorage.getItem` and `localStorage.setItem`. Simulate a search and verify that `setItem` is called with a correctly formatted JSON string containing the new search term.
    *   **Test 2: Appending and Limiting Searches:** Mock `localStorage.getItem` to return an array of 5 existing terms. Simulate a new search and verify that `setItem` is called with the new term at the beginning of the array and that the array's length is still 5.

**Step 6: End-to-End (E2E) Test**

I will create a new Cypress test file to simulate a user journey and confirm the vulnerability.

*   **File:** `test/cypress/e2e/recentSearches.spec.ts`
*   **Test 1: Functional Verification:**
    1.  Visit the search page.
    2.  Perform a search for a safe term (e.g., "apple").
    3.  Reload the page.
    4.  Assert that "apple" is visible in the "Recent Searches" list.
*   **Test 2: Vulnerability Confirmation (XSS):**
    1.  Visit the search page.
    2.  Set up a Cypress spy to listen for a `window:alert` event.
    3.  Perform a search using an XSS payload (e.g., `<img src=x onerror=alert('XSS')>`).
    4.  Assert that the `window:alert` was triggered with the message 'XSS'. This will definitively prove that the `innerHTML` binding is executing the injected script.
*   **Video Recording:** The `cypress run` command will automatically generate a video of this E2E test run, which will be saved in `cypress/videos/`. This video will serve as a clear visual record of the exploit.

---

#### **Part C: Post-Implementation Analysis & E2E Test Evolution**

The development of a robust E2E test for this scenario was a complex process that revealed critical details about the application's architecture and the nature of the vulnerability.

**Initial Findings & Flawed Assumptions:**
1.  Our initial E2E tests failed because blocking payloads (`alert()`) hung the headless browser.
2.  Subsequent tests revealed that the `RecentSearchesComponent` correctly sanitizes input by default, stripping `onerror` attributes.
3.  This led to the discovery of the **true, original vulnerability**: a Reflected XSS in the `SearchResultComponent`, which explicitly used `DomSanitizer.bypassSecurityTrustHtml()` on the `q` search parameter from the URL.

**Intentional Vulnerability & Final Test:**
To better demonstrate the intended "unsafe coding pattern" for this scenario, we chose to modify the `RecentSearchesComponent` to make it **intentionally vulnerable**.

*   **Code Change:** We injected `DomSanitizer` into `RecentSearchesComponent` and used `bypassSecurityTrustHtml()` on the terms retrieved from `localStorage`. This made it the primary sink for a Persisted DOM-based XSS.
*   **Bug Fix:** We also corrected a bug in `SearchResultComponent` that caused duplicate search terms to be saved.

**The Definitive E2E Test:**
After extensive debugging of SPA timing issues, we arrived at the following robust test flow, which proves the full lifecycle of the persisted vulnerability:

1.  **Inject:** The test first visits the search page and injects a malicious payload into `localStorage` by performing a search.
2.  **Verify Initial Trigger:** It confirms the XSS banner appears immediately, triggered by the now-vulnerable `RecentSearchesComponent`.
3.  **Navigate & Hard Refresh:** The test navigates to a different page (`/about`) and performs a **hard refresh** (`cy.reload(true)`). This is a critical step that clears the current DOM, destroying the first banner.
4.  **Verify Disappearance:** It asserts that the banner is now gone, proving the banner is not a simple DOM artifact of the SPA navigation.
5.  **Verify Persistence:** Finally, the test navigates back to the search page. The `RecentSearchesComponent` re-initializes, reads the payload from `localStorage`, and re-executes the script, causing the banner to reappear. This definitively proves the vulnerability is **persisted** in storage.

This final test provides a clear, compelling, and accurate video demonstration of a realistic Persisted DOM-based XSS attack.

## 7. Enumeration of `safevalues` API Builders

This section provides a definitive list of the primary builder and sanitization patterns found in the `safevalues` library, which are the target solutions for the vulnerabilities introduced in the implementation plan.

### a. HTML Builders

*   **`htmlEscape`**
    *   **Purpose:** Safely renders untrusted plain text by escaping HTML-sensitive characters.
    *   **Location:** `safevalues/src/builders/html_builders.ts`
*   **`scriptToHtml`**
    *   **Purpose:** Safely embeds a `SafeScript` object into a full `<script>` tag.
    *   **Location:** `safevalues/src/builders/html_builders.ts`
*   **`scriptUrlToHtml`**
    *   **Purpose:** Safely embeds a `TrustedResourceUrl` into a `<script src="...">` tag.
    *   **Location:** `safevalues/src/builders/html_builders.ts`
*   **HTML Sanitizer**
    *   **Purpose:** Parses and cleans an untrusted HTML string, removing unsafe elements and attributes (including dangerous CSS), and returns sanitized `SafeHtml`.
    *   **Location:** `safevalues/src/builders/html_sanitizer/html_sanitizer.ts`

### b. Script Builders

*   **`safeScript` (Template Literal)**
    *   **Purpose:** Creates `SafeScript` from a static string literal known to be safe at compile time.
    *   **Location:** `safevalues/src/builders/script_builders.ts`
*   **`valueAsScript`**
    *   **Purpose:** Safely serializes a JavaScript object into a JSON string for embedding in a script, escaping characters like `<`.
    *   **Location:** `safevalues/src/builders/script_builders.ts`
*   **`safeScriptWithArgs` (Template Literal)**
    *   **Purpose:** Separates trusted static code from untrusted dynamic data by creating a script that accepts the data as safely JSON-encoded arguments.
    *   **Location:** `safevalues/src/builders/script_builders.ts`

### c. URL Sanitizers

*   **`sanitizeJavaScriptUrl` & `restrictivelySanitizeUrl`**
    *   **Purpose:** Validate URL strings to prevent `javascript:` URLs and other dangerous schemes. This is the required validation step before a string can be treated as a `TrustedResourceUrl`.
    *   **Location:** `safevalues/src/builders/url_builders.ts`

## 8. Testing Infrastructure

The project has a robust testing setup which provides a safety net for changes and a pattern for new tests. The test suites can be run with the following commands:

*   **All Tests (Frontend Unit & Server-side):**
    ```bash
    npm test
    ```
*   **Frontend Unit Tests only:**
    ```bash
    cd frontend && npm test
    ```
*   **Server-side Tests only:**
    ```bash
    npm run test:server
    ```
*   **End-to-End Tests:**
    1.  Start the server: `npm run serve:dev`
    2.  In a separate terminal, run Cypress: `npm run cypress:run`

A common issue when running server-side tests is a native module compilation error with `libxmljs2`. This is typically due to a Node.js version mismatch and can be resolved by running:
```bash
npm rebuild
```

### a. Frontend Unit Tests

*   **Location:** Co-located with component files (`frontend/src/app/**/*.spec.ts`).
*   **Frameworks:** Karma (test runner) and Jasmine (assertion framework).
*   **Key Patterns & Observations:**
    *   **Isolation:** Components are tested in isolation from their dependencies. Services are mocked using `jasmine.createSpyObj` to provide predictable data and behavior.
    *   **Asynchronous Testing:** `fakeAsync` and `tick()` are used to test asynchronous code, such as `Observable` subscriptions from services, in a synchronous and controllable manner.
    *   **Component State:** Tests frequently assert the state of component properties and form controls (`.valid`, `.pristine`, etc.).
    *   **Routing:** `RouterTestingModule` is used to test navigation logic, asserting that methods trigger the expected path changes.
    *   **Storage:** Tests directly interact with `localStorage` and `sessionStorage` to verify that data (like tokens) is managed correctly.
    *   **Code Snippet (`login.component.spec.ts`):
        ```typescript
        // Mocking the UserService
        userService = jasmine.createSpyObj('UserService', ['login']);
        userService.login.and.returnValue(of({})); // Mocking a successful login

        // Testing navigation after an async operation
        it('forwards to main page after successful login', fakeAsync(() => {
          userService.login.and.returnValue(of({}));
          component.login();
          tick(); // Simulate passage of time for the Observable to resolve
          expect(location.path()).toBe('/search');
        }));
        ```

### b. Server-side Tests

*   **Location:** `test/server/**/*.ts`.
*   **Framework:** Mocha.
*   **Key Patterns & Observations:**
    *   The tests cover the application's backend routes and utilities.
    *   They perform checks for security vulnerabilities, configuration validation, and business logic.
    *   The tests frequently use `chai` for assertions and may involve direct interaction with the server or its components.

### c. End-to-End (E2E) Tests

*   **Location:** `test/cypress/e2e/**/*.spec.ts`.
*   **Framework:** Cypress.
*   **Key Patterns & Observations:**
    *   **User Journey Simulation:** Tests are structured around user stories and, uniquely, the application's security challenges. Each test simulates a user's actions from a black-box perspective.
    *   **Security Exploit Testing:** A primary purpose of the E2E suite is to automate the process of solving the security challenges. Tests explicitly perform actions like SQL Injection to verify the vulnerabilities.
    *   **DOM Interaction:** Cypress interacts with the application via CSS selectors (`cy.get('#email')`), user actions (`.type()`, `.click()`), and assertions (`.should()`).
    *   **Custom Commands:** The suite uses custom commands like `cy.expectChallengeSolved()` to abstract away the logic of verifying that a challenge has been successfully completed.
    *   **Code Snippet (`login.spec.ts`):
        ```typescript
        // Simulating a SQL Injection attack
        it('should log in Admin with SQLI attack on email field using "\' or 1=1--"', () => {
          cy.get('#email').type("' or 1=1--");
          cy.get('#password').type('a');
          cy.get('#loginButton').click();
          // ... assertions to verify successful login
        });
        ```

This plan provides a comprehensive roadmap for the implementation phase. The next step is to begin by scaffolding the new Angular SSR application.

## 9. Session State & Next Steps

**Status:**
*   **Scenario 1: Recent Searches** has been fully implemented, tested, and committed.
    *   **Feature Complete:** The `RecentSearchesComponent` is created, styled to match the application theme, and integrated into the `SearchResultComponent`.
    *   **Functionality:** Recent searches are saved to `localStorage`, deduplicated, and displayed as clickable links.
    *   **Intentional Vulnerability:** The component was modified to be **intentionally vulnerable** by using `DomSanitizer.bypassSecurityTrustHtml()`, providing a clear example of an unsafe coding pattern.
    *   **Unit Tested:** A focused component test was created to prove, in isolation, that the component unsafely renders HTML from `localStorage`.
    *   **E2E Tested:** A robust E2E test (`recentSearches.spec.ts`) was developed. The final version provides a compelling video that demonstrates the full lifecycle of a persisted DOM-based XSS attack, including surviving a hard page refresh.

**Next Action:**
Begin implementation of **Scenario 2: Rich Text Product Reviews**.
