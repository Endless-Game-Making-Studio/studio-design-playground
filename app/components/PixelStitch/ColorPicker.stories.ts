import type { Meta, StoryObj } from '@nuxtjs/storybook'
import ColorPicker from './ColorPicker.vue'
import { withEditor } from './storyEditor'

const INSPECTOR_WIDTH = 'w-[340px]'

const meta = {
  title: 'Components/PixelStitch/ColorPicker',
  component: ColorPicker,
  tags: ['autodocs'],
  decorators: [withEditor({ width: INSPECTOR_WIDTH })]
} satisfies Meta<typeof ColorPicker>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

// The eyedropper is the one tool that lives in this panel rather than the
// rail, so its selected state is the panel's, not the rail's.
export const EyedropperSelected: Story = {
  decorators: [withEditor({
    width: INSPECTOR_WIDTH,
    seed: (editor) => {
      editor.currentTool.value = 'eyedropper'
      editor.currentColor.value = '#1E00FF'
    }
  })]
}

// Picking a palette colour rings that swatch, so the artist can see where in
// the ramp they are.
export const PaletteColourSelected: Story = {
  decorators: [withEditor({
    width: INSPECTOR_WIDTH,
    seed: editor => (editor.currentColor.value = '#ffa200')
  })]
}
