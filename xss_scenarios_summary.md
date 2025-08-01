# XSS Scenario Summaries

This document summarizes five XSS vulnerability scenarios, ordered from simplest to most difficult to remediate.

***

### 1. Live Product Preview (Immediate DOM XSS)

*   **The Goal:** The developer wanted to show users a real-time preview of the HTML they were writing for a custom product.
*   **The Mistake:** To render the user's HTML, they took the raw text from the input field and explicitly disabled Angular's built-in security protections.
*   **The Fix:** Process the untrusted input with the **HTML Sanitizer** before rendering it.
    *   **API:** `safevalues/src/builders/html_sanitizer/html_sanitizer.ts`
    *   **Vulnerable Code (`live-product-preview.component.ts`):**
        ```typescript
        updatePreview(newText: string) {
          this.preview = this.sanitizer.bypassSecurityTrustHtml(newText);
        }
        ```

***

### 2. Rich Text Product Reviews (Supply-Chain Stored XSS)

*   **The Goal:** The developer wanted to let users write visually rich product reviews with bolding, italics, and lists.
*   **The Mistake:** They used a third-party editor and incorrectly trusted its output, explicitly disabling Angular's security before saving the content to the database.
*   **The Fix:** Treat the output of the third-party library as untrusted and clean it with the **HTML Sanitizer**.
    *   **API:** `safevalues/src/builders/html_sanitizer/html_sanitizer.ts`
    *   **Vulnerable Code (`product-review.component.ts`):**
        ```typescript
        submitReview() {
          const unsafeReviewHtml = this.editor.getRawHtml();
          // ...
          this.review.message = this.sanitizer.bypassSecurityTrustHtml(unsafeReviewHtml);
          // ... save to database
        }
        ```

***

### 3. Product View Analytics (Stored XSS via Script Injection)

*   **The Goal:** The developer wanted to send tracking data to an analytics service every time a user viewed a product.
*   **The Mistake:** They built the tracking script by directly concatenating the product's name—which could be edited by users—into a JavaScript string.
*   **The Fix:** Re-write the code to use **`safeScriptWithArgs`**, which safely separates the static code from the dynamic data.
    *   **API:** `safevalues/src/builders/script_builders.ts`
    *   **Vulnerable Code (`product-details.component.ts`):**
        ```typescript
        trackProductView() {
          const script = document.createElement('script');
          script.text = `trackEvent("view", "${this.product.name}");`; // Unsafe concatenation
          document.body.appendChild(script);
        }
        ```

***

### 4. Profile Status Message (SSR State Transfer XSS)

*   **The Goal:** To improve performance, the developer pre-fetched a user's status message on the server and passed it to the client to avoid a second network request.
*   **The Mistake:** They placed the raw, un-sanitized status message directly into Angular's `TransferState`, allowing a malicious script to break out of the state-transfer block in the initial HTML.
*   **The Fix:** Sanitize the data on the **server** with the **HTML Sanitizer** *before* placing it into `TransferState`.
    *   **API:** `safevalues/src/builders/html_sanitizer/html_sanitizer.ts`
    *   **Vulnerable Code (`profile-status.component.ts` on the server):**
        ```typescript
        // Server-side logic
        const status = unsafeUrl.searchParams.get('status');
        this.transferState.set(STATE_KEY_STATUS, status); // Unsafe data put into TransferState
        ```

***

### 5. Custom Profile Theme (SSR Resource Injection)

*   **The Goal:** The developer wanted to let users personalize their profile by linking to an external CSS stylesheet URL.
*   **The Mistake:** They took the user-provided URL and injected it directly into a `<link>` tag in the document `<head>` on the server, without first validating that it was a safe, legitimate CSS file URL.
*   **The Fix:** Use a two-step process: first, validate the URL with **`restrictivelySanitizeUrl`**, and only then convert it to a **`TrustedResourceUrl`** to be used in the `<link>` tag.
    *   **API:** `safevalues/src/builders/url_builders.ts`
    *   **Vulnerable Code (`profile-theme.component.ts` on the server):**
        ```typescript
        // Server-side logic
        const themeUrl = unsafeUrl.searchParams.get('themeUrl');
        const link = this.document.createElement('link');
        link.rel = 'stylesheet';
        link.href = themeUrl; // Unvalidated URL injected directly
        this.document.head.appendChild(link);
        ```
