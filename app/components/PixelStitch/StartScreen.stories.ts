import type { Meta, StoryObj } from '@nuxtjs/storybook'
import StartScreen from './StartScreen.vue'
import { seedProjects, withProjects } from './storyProjects'

const meta = {
  title: 'Components/PixelStitch/StartScreen',
  component: StartScreen,
  tags: ['autodocs'],
  decorators: [withProjects()]
} satisfies Meta<typeof StartScreen>

export default meta
type Story = StoryObj<typeof meta>

// A first visit: nothing saved yet.
export const Empty: Story = {}

// Saved projects, newest first, the open ones badged.
export const WithProjects: Story = {
  decorators: [withProjects({ seed: seedProjects(['hero', 'forest'], null) })]
}

// Phone width: the size cards fall to two columns.
export const Narrow: Story = {
  decorators: [withProjects({ width: 'w-[390px]', seed: seedProjects(['hero'], null) })]
}
