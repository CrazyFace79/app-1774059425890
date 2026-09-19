# vDAMM MUSIC

Copia recuperada de la app existente **Vdamm DJ Generator Pro**.

Fuente original: https://github.com/CrazyFace79/v0-eurodance-lyric-generator

---

# Vdamm DJ Generator Pro

A full-featured web app for generating, editing, validating and exporting Eurodance "remember 2000s" lyrics and Suno/Udio prompts.

## Features

- **Generator**: Create draft lyrics from strict templates
- **Editor**: Sectioned text editor with live validation
- **Result**: Side-by-side preview with QA checklist ✅
- **Styles**: Preset library for different Eurodance styles
- **Suno/Udio**: Generate prompts for AI music platforms
- **Export**: Multiple export formats (.txt, .json, .csv) ✅
- **History**: Project history with search and filters
- **Config**: Global settings and preferences
- **Corrector**: Tools for fixing common lyric issues

## Tech Stack

- **Frontend**: Next.js 15, React 19, TypeScript
- **Styling**: Tailwind CSS v4, Radix UI components
- **State**: Zustand with persistence
- **Validation**: Zod schemas
- **Animations**: Framer Motion

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

1. Clone the repository
2. Install dependencies:
   \`\`\`bash
   npm install
   \`\`\`

3. Start the development server:
   \`\`\`bash
   npm run dev
   \`\`\`

4. Open [http://localhost:3000](http://localhost:3000) in your browser

### Build for Production

\`\`\`bash
npm run build
npm start
\`\`\`

## Validation Rules

The app enforces strict Eurodance lyric rules:

- **Exactly 8 lines per section**
- **3-4 words per line**
- **Chorus rule**: Line 1 must be identical to line 5
- **Forbidden words**: "oh-oh", "yeah-yeah" (case-insensitive)

## Export Formats

- **Combined Copy**: STYLE + LYRICS for direct paste
- **TXT Download**: `YYYYMMDD_HHMM_suno_lyrics.txt`
- **JSON Project**: Complete project with metadata
- **CSV History**: Export project history
- **README.md**: Auto-generated documentation

## Reference Artists

Stylistic references include: Cascada, Groove Coverage, Sylver, Lasgo, Ian Van Dahl, Kate Ryan, DJ Sammy, Alice Deejay, and many more classic Eurodance artists.

## Development Status

✅ **Completed**: Result tab, Export tab, core architecture
🚧 **In Progress**: Generator, Editor, other tabs
📋 **Planned**: PWA features, Tauri desktop app

## License

Private project - All rights reserved
