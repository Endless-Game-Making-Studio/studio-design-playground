import type { Meta, StoryObj } from '@nuxtjs/storybook'
import PixelIcon from './PixelIcon.vue'

const meta = {
  title: 'Components/PixelStitch/PixelIcon',
  component: PixelIcon,
  tags: ['autodocs'],
  args: { name: 'scissors' }
} satisfies Meta<typeof PixelIcon>

export default meta
type Story = StoryObj<typeof meta>

// Hover the icon to play its frames.
export const Default: Story = {}

// The longest sheet: four frames, one bristle colour each.
export const FourFrames: Story = {
  args: { name: 'replace' }
}
