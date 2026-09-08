import type { Meta, StoryObj } from '@nuxtjs/storybook'
import HoldToConfirm from './HoldToConfirm.vue'

const meta = {
  title: 'Components/HoldToConfirm',
  component: HoldToConfirm,
  tags: ['autodocs'],
  args: {
    label: 'Delete frame'
  }
} satisfies Meta<typeof HoldToConfirm>

export default meta
type Story = StoryObj<typeof meta>

export const Idle: Story = {}

// Leave the pointer down so the story captures the in-progress outline.
export const MidHold: Story = {
  play: async ({ canvasElement }) => {
    const button = canvasElement.querySelector('button')!
    button.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 }))
    await new Promise(resolve => setTimeout(resolve, 500))
  }
}

// The completed state stays visible until release, which also makes the action
// threshold inspectable without a separate visual-only component API.
export const Completed: Story = {
  play: async ({ canvasElement }) => {
    const button = canvasElement.querySelector('button')!
    button.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 }))
    await new Promise(resolve => setTimeout(resolve, 1100))
  }
}
