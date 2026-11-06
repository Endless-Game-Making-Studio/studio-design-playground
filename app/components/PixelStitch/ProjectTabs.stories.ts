import type { Meta, StoryObj } from '@nuxtjs/storybook'
import ProjectTabs from './ProjectTabs.vue'
import { SAMPLE_PROJECTS, seedProjects, withProjects } from './storyProjects'

const meta = {
  title: 'Components/PixelStitch/ProjectTabs',
  component: ProjectTabs,
  tags: ['autodocs'],
  decorators: [withProjects({ seed: seedProjects(['hero', 'heart'], 'hero') })]
} satisfies Meta<typeof ProjectTabs>

export default meta
type Story = StoryObj<typeof meta>

export const TwoOpen: Story = {}

// The long name is cut off in its tab; hovering shows it in full.
export const LongName: Story = {
  decorators: [withProjects({ seed: seedProjects(['hero', 'forest', 'coin'], 'forest') })]
}

// "+" was pressed: the start screen is the tab in front, and can be closed
// back to the tab it came from.
export const StartScreenInFront: Story = {
  decorators: [withProjects({ seed: seedProjects(['hero', 'heart'], null) })]
}

// More tabs than fit: the strip scrolls sideways instead of squashing them.
export const Overflowing: Story = {
  decorators: [withProjects({
    width: 'w-[720px]',
    seed: seedProjects(SAMPLE_PROJECTS.map(project => project.id), 'boss')
  })]
}
