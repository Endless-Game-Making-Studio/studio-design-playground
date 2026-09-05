import type { Meta, StoryObj } from '@nuxtjs/storybook'
import LayerPanel from './LayerPanel.vue'
import { withEditor } from './storyEditor'
import type { PixelStitchEditor } from '../../composables/usePixelStitchContext'

const INSPECTOR_WIDTH = 'w-[340px]'

function buildStack(editor: PixelStitchEditor) {
  editor.addLayer()
  editor.addLayer()
  const layers = editor.currentFrame.value!.layers
  layers[0]!.name = 'Background'
  layers[1]!.name = 'Character'
  layers[2]!.name = 'Highlights'
}

const meta = {
  title: 'Components/PixelStitch/LayerPanel',
  component: LayerPanel,
  tags: ['autodocs'],
  decorators: [withEditor({ width: INSPECTOR_WIDTH })]
} satisfies Meta<typeof LayerPanel>

export default meta
type Story = StoryObj<typeof meta>

// One layer: delete is disabled, because a frame can't have none.
export const SingleLayer: Story = {}

// Listed bottom-up, matching the compositing order — the first row is the layer
// everything else paints over.
export const Stack: Story = {
  decorators: [withEditor({ width: INSPECTOR_WIDTH, seed: buildStack })]
}

export const HiddenAndFaded: Story = {
  decorators: [withEditor({
    width: INSPECTOR_WIDTH,
    seed: (editor) => {
      buildStack(editor)
      editor.toggleLayerVisibility(1)
      editor.setLayerOpacity(2, 0.4)
      editor.currentLayerIndex.value = 0
    }
  })]
}

// Mid-drag: the held row is left as an empty dashed slot, the lifted chip
// follows the pointer and a mark shows where it will land.
export const MidDrag: Story = {
  decorators: [withEditor({ width: INSPECTOR_WIDTH, seed: buildStack })],
  play: async ({ canvasElement }) => {
    const grip = canvasElement.querySelectorAll('button[aria-label^="Reorder"]')[2] as HTMLElement
    grip.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: 40, clientY: 200 }))
    grip.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: 40, clientY: 60 }))
  }
}
