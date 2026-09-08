<template>
  <!-- A tool tab stands outside the platform's menu structure: no
       UDashboardGroup, no sidebar, so a page here is a plain document that
       scrolls (or a frame that fills what's left under the bar).

       `h-svh`, not `min-h-svh`: a tool with any naturally-tall scrolling
       region (a long asset list, a layer panel) needs this box to be a hard
       ceiling, not just a floor — otherwise nothing below it ever receives a
       bounded height for its own `min-h-0`/`overflow-y-auto` to clip against,
       and that region's content inflates the whole page instead of scrolling
       in place. A page with ordinary flowing content that's taller than the
       viewport still scrolls normally above this box (nothing here sets
       `overflow-hidden`), so this doesn't trade away the "plain document"
       case. -->
  <div class="flex h-svh flex-col bg-default">
    <ToolTopbar />

    <main class="flex min-h-0 flex-1 flex-col">
      <slot />
    </main>
  </div>
</template>
