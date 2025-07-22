# Gemini CLI: Juice Shop Application Context

This document summarizes the key user flows and architectural patterns of the OWASP Juice Shop's Angular frontend, based on a codebase analysis.

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
        res.send(fn(user))
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
        })
        ```

*   **Verification of CAPTCHA Generation (Benign `innerHTML`):**
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
        }
        ```

## 6. Implementation Plan: Demonstrating `safevalues` with New XSS Vectors

This section outlines a strategic plan to introduce five new, plausible features, each containing a distinct XSS vulnerability. The goal is to create a "before and after" scenario where each vulnerability can be fixed by applying a specific `safevalues` pattern, thereby demonstrating its utility and covering a range of modern web security challenges.

### a. Overall Strategy
1.  **Introduce Client-Side Vulnerabilities:** Four vulnerabilities will be added to the existing client-side rendered Angular application.
2.  **Introduce a Server-Side Vulnerability:** One vulnerability will be created in a **new, standalone Angular SSR application**. This will demonstrate a subtle but critical SSR-specific exploit (`TransferState` XSS) in an isolated environment.
3.  **Integrate via Reverse Proxy:** The main Juice Shop Express server will be configured to act as a reverse proxy, forwarding requests to a specific route (e.g., `/profile-ssr`) to the new, standalone SSR micro-app.

### b. Detailed Feature & Vulnerability Plan

| Feature | Location & Technology | Good-Faith Goal | The Mistake (Vulnerability) | The `safevalues` Principle to Fix It |
| :--- | :--- | :--- | :--- | :--- |
| **1. Recent Searches** | **Angular SPA** (Search Page) | Show a user their last 5 search terms. | Rendering raw search terms from `localStorage` with `innerHTML`, causing **persisted DOM XSS**. | **`htmlEscape`** |
| **2. Rich Text Product Reviews** | **Angular SPA** (Product Details) | Allow users to submit reviews with rich formatting from a WYSIWYG editor. | Rendering the editor's HTML output directly with `innerHTML`, allowing malicious tags (`<script>`, `onerror`). | **HTML Sanitizer Process** |
| **3. Product View Analytics** | **Angular SPA** (Product Details) | Track product views by passing the product name to a JS analytics function. | Building a script via unsafe string concatenation (`'track("' + product.name + '")'`), allowing quotes to break out and cause XSS. | **`safeScriptWithArgs`** |
| **4. Profile Status Message** | **New Standalone Angular SSR App** | To improve performance, pre-fetch a user's "status message" on the server and pass it to the client using `TransferState`. | **State Transfer XSS:** A user's status message containing `</script>` is placed into `TransferState` without sanitization, breaking out of the state-transfer script block in the initial HTML. | **Server-Side Sanitization before State Transfer** |
| **5. Custom Profile Theme** | **Angular SPA** (User Profile) | Allow users to set a custom background color for their profile header. | Injecting a user-provided string directly into an inline `style` attribute, allowing for **CSS Injection**. This can be used to exfiltrate data via `background-image: url(...)` requests. | **CSS Sanitization** (via `HtmlSanitizer` on the style attribute) & Input Validation |

This plan provides a comprehensive roadmap for the implementation phase. The next step is to begin by scaffolding the new Angular SSR application.
