import type { Meta, StoryObj } from '@nuxtjs/storybook'
import Canvas from './Canvas.vue'
import { addFrames, paintSample, withEditor } from './storyEditor'

const meta = {
  title: 'Components/PixelStitch/Canvas',
  component: Canvas,
  tags: ['autodocs'],
  decorators: [withEditor({ seed: editor => paintSample(editor) })]
} satisfies Meta<typeof Canvas>

export default meta
type Story = StoryObj<typeof meta>

// 32×32 with the grid on, which is where a new project starts.
export const Default: Story = {}

export const GridHidden: Story = {
  decorators: [withEditor({
    seed: (editor) => {
      paintSample(editor)
      editor.gridVisible.value = false
    }
  })]
}

// A larger grid drops the per-pixel size, so the same panel holds four times
// the detail at a quarter the block size.
export const LargeCanvas: Story = {
  decorators: [withEditor({
    seed: (editor) => {
      editor.setCanvasSize(128)
      paintSample(editor)
    }
  })]
}

// One neighbour each way, drawn as a flat coloured ghost: cornflower behind,
// teal ahead — the same two colours that border those tiles on the strip.
export const OnionSkinning: Story = {
  decorators: [withEditor({
    seed: (editor) => {
      paintSample(editor)
      addFrames(editor, 2)
      editor.currentFrameIndex.value = 1
      editor.onionSkin.value = true
    }
  })]
}

// The select tool puts a hint above the canvas explaining the copy/paste
// keystrokes, since nothing else on screen advertises them.
export const SelectToolHint: Story = {
  decorators: [withEditor({
    seed: (editor) => {
      paintSample(editor)
      editor.currentTool.value = 'select'
    }
  })]
}
