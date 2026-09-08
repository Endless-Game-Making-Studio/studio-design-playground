import type { Meta, StoryObj } from '@nuxtjs/storybook'
import Toolbar from './Toolbar.vue'
import { withEditor } from './storyEditor'

// The rail is a single column of icon buttons and sizes itself; this just keeps
// the story from stretching it across the canvas.
const RAIL_WIDTH = 'w-[64px]'

const meta = {
  title: 'Components/PixelStitch/Toolbar',
  component: Toolbar,
  tags: ['autodocs'],
  decorators: [withEditor({ width: RAIL_WIDTH })]
} satisfies Meta<typeof Toolbar>

export default meta
type Story = StoryObj<typeof meta>

// Pencil is the default tool, so the brush-size stepper is showing.
export const Default: Story = {}

// The stepper belongs to the pencil and the eraser — every other tool acts on a
// single click, so it disappears and the rail gets shorter.
export const FillToolSelected: Story = {
  decorators: [withEditor({ width: RAIL_WIDTH, seed: editor => (editor.currentTool.value = 'fill') })]
}

// The eraser carries its own size, so switching to it shows a different number
// than the pencil left behind.
export const EraserAtMaxSize: Story = {
  decorators: [withEditor({ seed: (editor) => {
    editor.currentTool.value = 'eraser'
    editor.eraserSize.value = 8
  } })]
}
