import type { Meta, StoryObj } from '@nuxtjs/storybook'
import OnionSkinControls from './OnionSkinControls.vue'
import { withEditor } from './storyEditor'

const CONTROLS_WIDTH = 'w-[224px]'

const meta = {
  title: 'Components/PixelStitch/OnionSkinControls',
  component: OnionSkinControls,
  tags: ['autodocs'],
  decorators: [withEditor({ width: CONTROLS_WIDTH })]
} satisfies Meta<typeof OnionSkinControls>

export default meta
type Story = StoryObj<typeof meta>

// Off, it is a switch and nothing else — how many frames and how strong are no
// longer things to decide.
export const Off: Story = {}

// On, the key appears. It is the only thing saying which colour is the frame
// behind and which is the frame ahead, on the canvas and on the strip alike.
export const Enabled: Story = {
  decorators: [withEditor({
    width: CONTROLS_WIDTH,
    seed: editor => (editor.onionSkin.value = true)
  })]
}
