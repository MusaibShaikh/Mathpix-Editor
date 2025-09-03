# 📘 Mathpix Markdown Editor

![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-green)
![npm](https://img.shields.io/badge/npm-%3E%3D8.0.0-blue)
![yarn](https://img.shields.io/badge/yarn-%3E%3D1.22.0-orange)
![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)

A powerful, **AI-enhanced document editor** with **real-time LaTeX rendering**, **Markdown support**, and **intelligent text editing capabilities** powered by [Mathpix](https://mathpix.com) and [OpenRouter](https://openrouter.ai/).

Built with **TypeScript, React, and Next.js**.

---

## ✨ Features

### 🛠 Core Functionality
- 📄 **Real-time Markdown Rendering** – Live preview with Mathpix Markdown support  
- 🔢 **LaTeX Math Support** – Beautiful equations and scientific notation  
- 🤖 **AI-Powered Editing** – Intelligent text improvements via OpenRouter  
- 📂 **Document Management** – Load, edit, and save `.mmd` files  
- ⏪ **Undo/Redo System** – 50-state history tracking  

### 💡 User Experience
- 📱 **Responsive Design** – Works on desktop, tablet, and mobile  
- 🖥 **Three-Panel Layout** – Document preview, diff viewer, and AI chat  
- ✍️ **Smart Text Selection** – Edit specific sections with precision  
- 🔍 **Visual Diff Viewer** – Before/after comparison with Mathpix rendering  
- 💾 **Auto-Persistence** – State saving across browser sessions  

### 🚀 Advanced Features
- 💬 **Live AI Chat** – Real-time AI conversation for editing suggestions  
- ⚙️ **Modular Architecture** – Clean, maintainable component structure  
- 🎨 **Beautiful UI** – Smooth animations and professional design  
- 🛡 **Type Safety** – Full TypeScript implementation  
- ⚡ **Performance Optimized** – Debounced rendering and efficient state management  

---

## 📦 Tech Stack
- **Frontend**: React + Next.js + TypeScript  
- **AI Integration**: OpenRouter (Llama 4 Scout, Free tier)  
- **Markdown/Math**: Mathpix Markdown  
- **State Management**: Local persistence + history tracking  

---

## 🚀 Quick Start

### 🔧 Prerequisites
- [Node.js](https://nodejs.org/) >= **18.0.0**  
- [npm](https://www.npmjs.com/) >= **8.0.0** or [yarn](https://yarnpkg.com/) >= **1.22.0**  
- [OpenRouter API Key](https://openrouter.ai/) (for AI features)  

### 📥 Installation

```bash
# Clone the repository
git clone https://github.com/MusaibShaikh/mathpix-editor.git
cd mathpix-editor

# Install dependencies
npm install
# or
yarn install
```

### ⚙️ Environment Setup
Copy `.env.example` (if available) or create a `.env` file:

```bash
cp .env
```

Edit `.env`:
```env
OPENROUTER_API_KEY=your_openrouter_api_key_here
```

### 📘 Example Document
An example Mathpix Markdown file is included at:

```
public/manual.mmd
```

You can open, edit, and use this file as a starting point to explore the editor’s features.  
For additional `.mmd` files, place them inside the `public/` directory with the name `manual.mmd` and they will be available for loading in the editor.

### ▶️ Run Development Server
```bash
npm run dev
# or
yarn dev
```

Then open your browser at 👉 [http://localhost:3000](http://localhost:3000)

---

## 🤖 AI Integration

This editor uses **OpenRouter (Llama 4 Scout Free tier)** for AI-powered text editing:

### ✅ AI Capabilities
- Grammar correction  
- Style improvements  
- Content restructuring  
- Mathematical notation fixes  
- Format conversion  

### 💬 Example Prompts
- "Make this paragraph more concise"  
- "Convert this to bullet points"  
- "Fix mathematical notation"  
- "Improve academic writing style"  
- "Add section headings"  

---

## 🛠 Scripts

```bash
npm run dev       # Start dev server
npm run build     # Build for production
npm run start     # Start production server
npm run lint      # Run linter
```

---

## 📌 Roadmap
- [ ] Export to PDF/Word/LaTeX  
- [ ] Cloud sync for documents  
- [ ] Multi-user collaboration  
- [ ] Plugin system for custom AI prompts  

---

## 🤝 Contributing
Contributions are welcome!  
1. Fork the project  
2. Create your feature branch (`git checkout -b feature/YourFeature`)  
3. Commit changes (`git commit -m "Add YourFeature"`)  
4. Push to the branch (`git push origin feature/YourFeature`)  
5. Open a Pull Request  

---

## 📄 License
This project is licensed under the **MIT License**.  
See [LICENSE](./LICENSE) for details.

---

## 🙌 Acknowledgements
- [Mathpix](https://mathpix.com) – for Markdown + LaTeX rendering  
- [OpenRouter](https://openrouter.ai/) – for AI editing features  
- [Next.js](https://nextjs.org/) & [React](https://react.dev/) – core framework  
