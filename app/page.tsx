"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/toaster"
import { GeneratorTab } from "@/components/tabs/generator-tab"
import { EditorTab } from "@/components/tabs/editor-tab"
import { ResultTab } from "@/components/tabs/result-tab"
import { StylesTab } from "@/components/tabs/styles-tab"
import { SunoUdioTab } from "@/components/tabs/suno-udio-tab"
import { ExportTab } from "@/components/tabs/export-tab"
import { HistoryTab } from "@/components/tabs/history-tab"
import { ConfigTab } from "@/components/tabs/config-tab"
import { CorrectorTab } from "@/components/tabs/corrector-tab"
import { useUIStore } from "@/store/ui-store"

export default function Home() {
  const { activeTab, setActiveTab } = useUIStore()

  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
      <div className="min-h-screen bg-background">
        <div className="container mx-auto p-4">
          <header className="mb-6">
            <h1 className="text-3xl font-bold text-foreground mb-2">Vdamm DJ Generator Pro</h1>
            <p className="text-muted-foreground">
              Generate, edit, validate and export Eurodance "remember 2000s" lyrics and Suno/Udio prompts
            </p>
          </header>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-9 mb-6">
              <TabsTrigger value="generator">Generator</TabsTrigger>
              <TabsTrigger value="editor">Editor</TabsTrigger>
              <TabsTrigger value="result">Result</TabsTrigger>
              <TabsTrigger value="styles">Styles</TabsTrigger>
              <TabsTrigger value="suno-udio">Suno/Udio</TabsTrigger>
              <TabsTrigger value="export">Export</TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
              <TabsTrigger value="config">Config</TabsTrigger>
              <TabsTrigger value="corrector">Corrector</TabsTrigger>
            </TabsList>

            <TabsContent value="generator">
              <GeneratorTab />
            </TabsContent>

            <TabsContent value="editor">
              <EditorTab />
            </TabsContent>

            <TabsContent value="result">
              <ResultTab />
            </TabsContent>

            <TabsContent value="styles">
              <StylesTab />
            </TabsContent>

            <TabsContent value="suno-udio">
              <SunoUdioTab />
            </TabsContent>

            <TabsContent value="export">
              <ExportTab />
            </TabsContent>

            <TabsContent value="history">
              <HistoryTab />
            </TabsContent>

            <TabsContent value="config">
              <ConfigTab />
            </TabsContent>

            <TabsContent value="corrector">
              <CorrectorTab />
            </TabsContent>
          </Tabs>
        </div>
        <Toaster />
      </div>
    </ThemeProvider>
  )
}
