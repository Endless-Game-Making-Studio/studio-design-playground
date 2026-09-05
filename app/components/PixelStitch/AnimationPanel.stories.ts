import type { Meta, StoryObj } from '@nuxtjs/storybook'
import AnimationPanel from './AnimationPanel.vue'
import { addFrames, paintSample, withEditor } from './storyEditor'
import type { PixelStitchEditor } from '../../composables/usePixelStitchContext'

const PANEL_WIDTH = 'w-[1100px]'

function animation(editor: PixelStitchEditor) {
  paintSample(editor)
  addFrames(editor, 5)
}

const meta = {
  title: 'Components/PixelStitch/AnimationPanel',
  component: AnimationPanel,
  tags: ['autodocs'],
  decorators: [withEditor({ width: PANEL_WIDTH, seed: animation })]
} satisfies Meta<typeof AnimationPanel>

export default meta
type Story = StoryObj<typeof meta>

// The default. Only what is useful without opening it: play, the panel's name
// and how many frames there are.
export const Closed: Story = {}

export const Open: Story = {
  decorators: [withEditor({
    width: PANEL_WIDTH,
    seed: (editor) => {
      animation(editor)
      editor.animationPanelOpen.value = true
    }
  })]
}

// Play stays available in both states, so the closed bar shows the pause icon
// while the animation is running.
export const ClosedWhilePlaying: Story = {
  decorators: [withEditor({
    width: PANEL_WIDTH,
    seed: (editor) => {
      animation(editor)
      editor.isPlaying.value = true
    }
  })]
}
