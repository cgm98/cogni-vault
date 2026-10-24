<template>
  <div class="h-dvh w-full flex flex-col bg-slate-950 text-slate-100 overflow-hidden font-sans">
    <!-- Top Navigation Bar -->
    <header class="min-h-11 border-b border-slate-800 bg-slate-900/80 backdrop-blur px-4 py-2 flex items-center justify-between gap-4 flex-shrink-0 z-40 select-none">
      <div class="flex min-w-0 flex-1 flex-col sm:flex-row sm:items-center gap-2 sm:gap-6">
        <div class="flex shrink-0 items-center gap-2.5">
          <div class="w-6 h-6 rounded-md bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-md shadow-blue-500/20">
            <BrainCircuit class="w-3.5 h-3.5 text-white" />
          </div>
          <span class="font-bold text-xs tracking-wider uppercase text-slate-200">Cogni-Vault</span>
        </div>

        <nav aria-label="Navegación principal" class="flex min-w-0 items-center gap-1 overflow-x-auto whitespace-nowrap">
          <router-link
            to="/notes"
            class="px-2.5 py-1 rounded-md text-xs font-medium transition-colors"
            :class="$route.path.startsWith('/notes') ? 'bg-blue-600/20 text-blue-400 font-semibold' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'"
          >
            Notas
          </router-link>
          <router-link
            to="/knowledge"
            class="px-2.5 py-1 rounded-md text-xs font-medium transition-colors"
            :class="$route.path.startsWith('/knowledge') ? 'bg-blue-600/20 text-blue-400 font-semibold' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'"
          >
            Dashboard
          </router-link>
          <router-link
            to="/challenge"
            class="px-2.5 py-1 rounded-md text-xs font-medium transition-colors"
            :class="$route.path.startsWith('/challenge') ? 'bg-blue-600/20 text-blue-400 font-semibold' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'"
          >
            Flashcards
          </router-link>
        </nav>
      </div>

      <div class="hidden xl:flex shrink-0 items-center gap-3">
        <span class="text-[11px] text-slate-500 font-mono">SQLite WAL · FTS5 · sqlite-vec</span>
      </div>
    </header>

    <!-- Main View Outlet -->
    <main class="flex-1 min-h-0 min-w-0 overflow-auto relative">
      <router-view />
    </main>
  </div>
</template>

<script setup lang="ts">
import { BrainCircuit } from 'lucide-vue-next';
</script>

<style>
/* Reset and core styles */
html, body, #app {
  margin: 0;
  padding: 0;
  height: 100%;
  width: 100%;
  overflow: hidden;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  background-color: #020617;
  color: #f8fafc;
}

::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background: #334155;
  border-radius: 3px;
}
::-webkit-scrollbar-thumb:hover {
  background: #475569;
}
</style>
