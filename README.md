# DealMaster React Native App

A React Native starter project bootstrapped with TypeScript that showcases a simple authentication flow powered by Zustand and Axios. The application includes Login, Home, and Settings screens connected with React Navigation.

## Features

- 🚀 **React Native 0.72** with TypeScript and ESLint configuration
- 🔐 **Authentication state** handled via [Zustand](https://github.com/pmndrs/zustand)
- 🌐 **Axios HTTP client** with an interceptor that injects auth tokens
- 🧭 **React Navigation** native stack navigator (Login → Home → Settings)
- 🎨 Shared design tokens and reusable UI components

## Project Structure

```
.
├── App.tsx
├── index.js
├── src
│   ├── components
│   ├── navigation
│   ├── screens
│   ├── services
│   ├── store
│   └── theme
└── ...
```

## Getting Started

1. Install dependencies:

   ```bash
   npm install
   ```

2. Start the Metro bundler:

   ```bash
   npm run start
   ```

3. Run the application:

   ```bash
   # For Android
   npm run android

   # For iOS (requires macOS)
   npm run ios
   ```

## Environment Variables

Copy `.env.example` to `.env` and update the `API_URL` value to point to your backend service. The value will be used when creating the Axios instance.

For native OCR flag、權限與本機執行說明，請參考 [docs/ocr.md](docs/ocr.md).

## Testing & Linting

- Run `npm run lint` to check for lint issues
- Run `npm run typecheck` to verify TypeScript typings

## License

MIT
