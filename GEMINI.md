# Angular Best Practices

**For all Angular code that you write, you must follow the guidelines at https://angular.dev/context/llm-files/llms-full.txt**

**Key Convention Rules for this Project:**
*   **New Components:** When creating **new** Angular components, you **must** use the modern, built-in control flow syntax (`@if`, `@for`, `@switch`).
*   **Existing Components:** When modifying **existing** Angular components, you **must** adhere to the established conventions of that file. If the component uses `*ngIf` and `*ngFor`, you must continue to use them to maintain code consistency.

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
2.  **Introduce Server-Side Vulnerabilities:** Two distinct vulnerabilities will be created in a **new, standalone Angular SSR application**. This will demonstrate subtle but critical SSR-specific exploits in an isolated environment.
3.  **Integrate via Reverse Proxy:** The main Juice Shop Express server will be configured to act as a reverse proxy, forwarding requests to a specific route (e.g., `/ssr`) to the new, standalone SSR micro-app.

#### Architectural Note: Why Use a Reverse Proxy?
The new Angular SSR application is a self-contained server process that must be executed independently of the main Juice Shop server. The main server cannot simply render the SSR app's files as it does with its simple Pug templates; it must delegate the entire request to the running SSR application.

A reverse proxy is the standard architectural pattern for this delegation. While it is technically possible to write a manual proxy using Node.js's `http` module, this is complex and error-prone. The idiomatic "Express way" is to use a dedicated, battle-tested middleware library. For this reason, we will add `http-proxy-middleware` as a single, focused dependency to handle this integration cleanly and robustly.

### b. Detailed Feature & Vulnerability Plan

| Feature | Vulnerability Origin | The Mistake (Vulnerability) | The `safevalues` Principle to Fix It |
| :--- | :--- | :--- | :--- |
| **1. Recent Searches** | **Developer Mistake** | Rendering raw search terms from `localStorage` with `innerHTML`, causing **persisted DOM XSS**. | **`htmlEscape`** |
| **2. Rich Text Product Reviews** | **Supply-Chain Vulnerability** (Insecure 3rd-party WYSIWYG editor) | Trusting the raw HTML output of a third-party library (`editor.getRawHtml()`) and rendering it with `innerHTML`, allowing malicious tags. | **HTML Sanitizer Process** |
| **3. Product View Analytics** | **Developer Mistake** | Building a script via unsafe string concatenation (`'track("' + product.name + '")'`), allowing quotes to break out and cause XSS. | **`safeScriptWithArgs`** |
| **4. Custom Profile Theme** | **SSR Framework Pitfall** | **Server-Side Resource Injection:** A user-provided URL is used to create a `<link>` tag in the document `<head>` on the server. Forcing the route to use `RenderMode.Server` ensures the component logic runs, injecting the tag into the initial HTML and bypassing client-side controls. | **`TrustedResourceUrl`** |
| **5. Profile Status Message** | **SSR Framework Pitfall** | **State Transfer XSS:** Placing un-sanitized user data into `TransferState`, which is then serialized into the initial HTML, breaking out of the state-transfer script block. | **Server-Side Sanitization before State Transfer** |
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

### Scenario 2: Rich Text Product Reviews

**Status:** ✅ **Done**

**Implementation & Analysis:**
To realistically simulate a supply chain vulnerability, we went beyond the initial plan and created a more convincing "third-party" component.

1.  **Fake NPM Package:** We created a new top-level directory, `insecure-rich-text-editor`, containing a `package.json` and `index.js`. This allowed us to install it as a local dependency into the `frontend` application using `npm install file:../insecure-rich-text-editor --legacy-peer-deps`.
2.  **Web Component Simulation:** To make the "third-party" library a true black box, we implemented it as a custom web component (`<insecure-editor>`). This involved:
    *   Defining a class that extends `HTMLElement`.
    *   Using a Shadow DOM to encapsulate its internal structure (a toolbar and a `textarea`).
    *   Registering it with `window.customElements.define()`.
3.  **Angular Integration:** To consume the web component in our `ProductReviewComponent`, we had to:
    *   Add the component's script to the `scripts` array in `angular.json`.
    *   Add `CUSTOM_ELEMENTS_SCHEMA` to the `ProductReviewComponent`'s schemas to allow the unknown `<insecure-editor>` tag.
4.  **Vulnerability Implementation:** Our debugging revealed that Angular's `[innerHTML]` binding **correctly sanitizes** input by default. To complete the simulation of an insecure integration, we had to explicitly inject `DomSanitizer` into the `ProductReviewComponent` and use `bypassSecurityTrustHtml()` on the data received from the web component. This is the precise unsafe pattern being demonstrated.
5.  **Styling & Testing:** The component and the web component were both styled to match the application's theme, and a full suite of passing unit and E2E tests were created to verify the final, realistic implementation.

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
Begin implementation of **Scenario 3: Product View Analytics**.

### Scenario 3: Community-Sourced Product Information (Stored XSS via Script Injection)

**Status:** ✅ **Done**

**Implementation & Analysis:**
This scenario was implemented to demonstrate a stored XSS vulnerability that does not rely on an `innerHTML` sink, but rather on unsafe script creation.

1.  **Feature:** A "Suggest an Edit" feature was added to the `ProductDetailsComponent`, allowing any logged-in user to edit a product's name.
2.  **Vulnerability:** The `saveName()` method in the component was intentionally written to be vulnerable. Upon saving, it dynamically creates a `<script>` tag and concatenates the user-provided product name directly into the script's content. This creates a classic script injection vulnerability.
3.  **E2E Test & Video:** A robust E2E test (`productViewAnalytics.spec.ts`) was created. It logs in, edits a product name with a JavaScript payload (`');...banner code...//`), and verifies that the XSS banner appears. This provides a clear video of a user-driven, non-innerHTML stored XSS attack.
4.  **Angular Best Practices:** During this process, we established and documented a key convention: new components must use modern Angular syntax (e.g., `@if`), while existing components must maintain their current syntax (e.g., `*ngIf`). The new `ProductReviewComponent` was refactored to follow this rule.

**Refinement and Validation of Scenario #3:**
A full validation run of Scenario #3 revealed and resolved several inconsistencies between the implementation plan, the component code, and the test suite.

1.  **Narrative Refinement:** We identified that the original "Product View Analytics" concept was a more realistic and compelling real-world scenario for this type of XSS vulnerability than the implemented "Community-Sourced Edits" feature. To align with this more believable narrative, the component was refactored: the vulnerable script-creation logic was moved from the `saveName()` method into a new `trackProductView()` method, which is now correctly triggered on component initialization (`ngOnInit`).

2.  **Unit Test Debugging:** The validation process uncovered and fixed two distinct types of brittle unit tests:
    *   **String Escaping:** The `product-details.component.spec.ts` test was failing due to a subtle string-escaping mismatch between the test's expectation and the component's actual output. After an initial incorrect fix, the issue was resolved robustly by programmatically constructing the expected string in the test using the same template literal syntax as the component, making the test resilient to future escaping behavior changes.
    *   **Date Comparison:** An unrelated test in `challenge-solved-notification.component.spec.ts` was failing due to timing-sensitive `new Date()` comparisons. This was resolved by using `jasmine.clock().mockDate()` to ensure a deterministic and predictable time during the test run.

3.  **Final Validation:** After these refinements, the full frontend and backend unit test suites, as well as the targeted `productViewAnalytics.spec.ts` E2E test, all pass successfully. This confirms that Scenario #3 is now robust, believable, and fully validated.

**Next Action:**
Begin implementation of **Scenario 4: Custom Profile Theme (SSR Resource Injection)**.

### Scenario 4: Custom Profile Theme (SSR Resource Injection)

**Status:** ⏳ **Not Started**

**Implementation & Analysis:**
This scenario will introduce a "Custom Profile Theme" feature, allowing users to personalize their profile page by providing a URL to an external CSS stylesheet. This feature will be built as a new, standalone Angular SSR application and integrated via a reverse proxy.

The core of this scenario is to demonstrate a subtle but severe vulnerability that arises specifically from rendering seemingly safe code on the server. The developer's intent is to dynamically add the user's chosen stylesheet to the page. They do this by creating a `<link>` element and appending it to the document's `<head>`.

**The Vulnerability: Server-Side Resource Injection**
This coding pattern is deceptive because its security implications change drastically between the client and the server.

*   **On the Client (Less Dangerous):** In a standard client-side rendered app, this operation happens in the user's browser. A modern browser, especially one with a `Trusted Types` Content Security Policy (CSP), would likely intervene and block the attempt to dynamically load a resource from an untrusted URL. The security context is active and policed by the browser.

*   **On the Server (Highly Dangerous):** When this code executes in the Node.js environment during Server-Side Rendering, the context is completely different:
    1.  **No Security Sandbox:** The `domino` library, used by Angular to simulate the DOM on the server, does not implement browser security features like CSP or Trusted Types. It is a DOM *emulator*, not a security sandbox.
    2.  **Server-Side DOM Mutation:** The code `renderer.appendChild(this.document.head, link)` modifies the *in-memory* DOM object on the server.
    3.  **HTML Serialization:** The SSR engine serializes this modified in-memory DOM into a final HTML string. The malicious `<link href="https://attacker.com/exploit.css">` tag is now baked directly into the static HTML blueprint of the page.
    4.  **Blueprint vs. Renovation:** The malicious link is not a dynamic "renovation" on the client; it is part of the original "blueprint" sent from the server. The browser receives it as trusted, static content and immediately fetches the malicious resource, bypassing client-side dynamic security controls.

**The Guaranteed Safe Fix: `safevalues` + `DomSanitizer`**
The guaranteed-safe pattern involves using both libraries to enforce security.

1.  **Policy Decision (`safevalues`):** The component will use a `safevalues` builder (`safeResourceUrl`) to validate the user-provided URL against a strict allowlist (e.g., only permit URLs from a trusted domain ending in `.css`). This function acts as the **Policy Decision Point**.
2.  **Policy Enforcement (`DomSanitizer`):** If the `safevalues` check passes, the resulting `TrustedResourceUrl` is passed to Angular's `DomSanitizer.bypassSecurityTrustResourceUrl()`. This is the official, framework-idiomatic gateway for telling Angular's renderer to trust a value. This is the **Policy Enforcement Point**.
3.  **Declarative Binding:** The component template will then use a simple, declarative attribute binding (`<link [href]="safeThemeUrl">`). Because the `safeThemeUrl` property is of the type `SafeResourceUrl` (returned by the sanitizer), Angular's security-aware rendering engine handles the final assignment to the DOM, providing a compile-time and runtime guarantee of safety.


### Scenario 5: Profile Status Message (State Transfer XSS)

**Status:** ⏳ **Not Started**

**Implementation & Analysis:**
This scenario will demonstrate a classic SSR vulnerability known as **State Transfer XSS**. The feature will be a "Profile Status Message," where data fetched on the server is "transferred" to the client to avoid a redundant API call.

The vulnerability occurs when the server puts raw, un-sanitized user data directly into Angular's `TransferState` mechanism.

**The Vulnerability: State Transfer XSS**
1.  **The Goal:** To avoid a "double fetch," the server fetches the user's status message and puts it into the `TransferState` map.
2.  **Serialization:** Angular's SSR engine then serializes this map and embeds it into the initial HTML inside a `<script type="application/json">` tag.
3.  **The Mistake:** A malicious user sets their status to a string containing a script tag, like `My Status</script><script>alert('XSS')</script>`.
4.  **The Injection:** The server blindly embeds this string into the JSON block in the HTML. The browser, while parsing the page, encounters the attacker's `</script>` tag first. It terminates the JSON script block prematurely and immediately executes the attacker's subsequent `<script>` tag.

**The Fix: Server-Side Sanitization**
The fix is to ensure that any data placed into `TransferState` is properly sanitized on the server *before* serialization. The server-side code must treat all user-provided data as untrusted. By using a `safevalues` sanitizer (like the HTML Sanitizer) on the status message string before calling `transferState.set()`, the malicious `<script>` tags would be stripped or escaped, neutralizing the attack. The data arrives on the client as a safe, inert string.

## 10. Debugging the SSR Application

This section documents the commands and procedures for debugging the standalone `angular-ssr` application.

### a. Running the Servers

1.  **Start the Main Juice Shop Server:** From the project root, run `npm run serve:dev`. This starts the main server on `http://localhost:3000` and the frontend dev server on `http://localhost:4202`.
2.  **Start the Angular SSR Server:** In a separate terminal, navigate to the `angular-ssr` directory and run `npm run serve:ssr:angular-ssr`. This will build the app and start the SSR server on `http://localhost:4000`.

### b. Testing the Vulnerability

*   **Directly with `curl` (Recommended First Step):** To see the raw HTML generated by the server, use `curl`. This is the fastest way to confirm if a server-side injection is working.
    ```bash
    curl "http://localhost:4000/profile?status=<b>Injected!</b>"
    ```
*   **Through the Proxy (E2E Test):** To test the full integration, use the proxied URL.
    ```bash
    curl "http://localhost:3000/ssr/profile?status=<b>Injected!</b>"
    ```

### c. Breakpoint Debugging

To step through the server-side code as it generates the HTML:

1.  **Add a Debug Script:** Add a `serve:ssr:debug` script to `angular-ssr/package.json`:
    ```json
    "serve:ssr:debug": "npm run build && node --inspect-brk dist/angular-ssr/server/server.mjs"
    ```
2.  **Run in Debug Mode:** Start the server with `npm run serve:ssr:debug`. It will pause and wait for a debugger.
3.  **Attach Debugger:** Use `chrome://inspect` in a Chrome browser to open the Node.js DevTools and attach to the process. You can then set breakpoints in the `server.ts` file and step through the code.

### Scenario 4 Implementation Log

**Status:** ✅ **Done**

This section details the iterative process of implementing the SSR vulnerability, capturing the lessons learned. The final implementation successfully demonstrates the originally intended **Server-Side Resource Injection** vulnerability.

1.  **Scaffolding & Integration:** A new standalone Angular application, `angular-ssr`, was created and integrated with the main Juice Shop server via a reverse proxy on the `/ssr` route.
2.  **Initial Failures (Build & Config):** The initial E2E tests failed due to several configuration issues, including build dependency problems and server port conflicts, which were resolved.
3.  **Debugging SSR Rendering:** The primary challenge was that imperative DOM manipulations from within the component's `ngOnInit` lifecycle hook were not being serialized into the final HTML in the production SSR build. Multiple attempts failed and were proven ineffective via a "curl-first" debugging workflow:
    *   `Renderer2` to append elements.
    *   Declarative `[innerHTML]` and `{{ interpolation }}` bindings.
    *   Even `DomSanitizer.bypassSecurityTrustHtml`.
    All these methods resulted in an empty or sanitized output in the raw server response, demonstrating that the default Angular SSR build process is highly secure and optimizes away or sanitizes imperative side effects.
4.  **The Breakthrough (`RenderMode.Server`):** The key to the solution was the discovery of the `renderMode` option in `app.routes.server.ts`. By default, the production build can use a `Prerender` mode that does not fully execute component logic. By explicitly setting `renderMode: RenderMode.Server` for the target route, we forced the SSR engine to perform a full, stateful render of the component on the server.
5.  **Final Success (`<link>` Tag Injection):** With `RenderMode.Server` active, the original, more subtle vulnerability could be implemented. The final version of the component injects the `DOCUMENT` token and uses native DOM methods (`document.createElement('link')`, `document.head.appendChild()`) to successfully inject a user-provided stylesheet link into the `<head>` of the initial HTML document.
6.  **E2E Test Correction (Hydration):** The final hurdle was that the Cypress test (`cy.get()`) still failed even though the `curl` test passed. This was due to **client-side hydration**. The browser would receive the correct, injected HTML, but the client-side Angular app would immediately take control, see the injected `<link>` as a foreign element not present in any template, and remove it. The test was corrected to use `cy.request().its('body')` to assert on the raw HTML response *before* hydration could occur, which finally resulted in a passing test.
