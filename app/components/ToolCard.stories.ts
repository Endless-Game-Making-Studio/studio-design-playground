import type { Meta, StoryObj } from '@nuxtjs/storybook'
import ToolCard from './ToolCard.vue'
import { webTools, tailorApps } from '../composables/useMakeMockData'

function tool(id: string) {
  return [...webTools, ...tailorApps].find(entry => entry.id === id)!
}

const meta = {
  title: 'Components/ToolCard',
  component: ToolCard,
  tags: ['autodocs'],
  // The Make page runs these in a 3-up grid; a full-width card stretches the
  // thumbnail into a band and the blurb onto one line.
  decorators: [() => ({ template: '<div class="w-[340px]"><story /></div>' })]
} satisfies Meta<typeof ToolCard>

export default meta
type Story = StoryObj<typeof meta>

// A tool rebuilt natively on this stack: it opens its own tab on one of our
// routes, which is what the tab-arrow icon marks.
export const NativeRoute: Story = {
  args: {
    tool: tool('pixel-stitch')
  }
}

// Framed rather than rebuilt: the tab lands on `/make/tool/<id>`, which keeps
// the platform's bar above the frame — so it gets the same tab-arrow icon.
export const Embeddable: Story = {
  args: {
    tool: tool('whispering-well')
  }
}

// No embed, so the tab goes straight to the tool's own site — the external-link
// icon is what marks that the learner is leaving the platform.
export const ExternalLink: Story = {
  args: {
    tool: tool('godot-web')
  }
}

export const Download: Story = {
  args: {
    tool: tool('endstar')
  }
}

// Neither a route, an embed, nor a URL — the footer disables rather than
// pretending to go somewhere.
export const NoDestination: Story = {
  args: {
    tool: tool('baby-godot')
  }
}
