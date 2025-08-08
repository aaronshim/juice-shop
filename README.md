# Patched Development Server

To run the development server with live-reloading for both frontend and backend changes, please use the following command:

```bash
npm run serve:dev
```

This will ensure that all code modifications are applied immediately without needing to manually restart the server. The application will be available at <http://localhost:4202>.

---

To run the Angular SSR routes, do

```bash
npm run serve:ssr:angular-ssr
```

This should proxy properly to port 3000 and 4202. You might need to stop and re-run with code changes because it will not auto hot reload.