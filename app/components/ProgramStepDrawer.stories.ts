import type { Meta, StoryObj } from '@nuxtjs/storybook'
import { computed } from 'vue'
import ProgramStepDrawer from './ProgramStepDrawer.vue'
import { programTemplates } from '../composables/useProgramMockData'
import { flattenCurriculum, withAwardableXp } from '../composables/useProgramCurriculum'
import type { CurriculumModuleSummary } from '../composables/useProgramCurriculum'
import type { DeliverableSubmission, useProgramProgress } from '../composables/useProgramProgress'

const template = programTemplates.find(p => p.id === 'core-threadbare')!
const steps = flattenCurriculum(template)

// Built the way ProgramTabClassroom builds them, with nothing locked or done,
// so the sidebar nav shows the whole curriculum.
const modules: CurriculumModuleSummary[] = withAwardableXp(template.curriculum).map(mod => ({
  id: mod.id,
  title: mod.title,
  items: mod.items,
  isLocked: false,
  completedCount: 0
}))
const topic = steps.find(step => step.type === 'topic')!
const deliverable = steps.find(step => step.type === 'deliverable')!

type Progress = ReturnType<typeof useProgramProgress>

/**
 * A stand-in for `useProgramProgress`, rather than the real composable: that one
 * reads localStorage on mount, so whichever steps the last person to open the
 * app happened to finish would leak into these stories and change what renders.
 */
function stubProgress(options: { completed?: boolean, submission?: DeliverableSubmission } = {}): Progress {
  return {
    isCompleted: () => Boolean(options.completed),
    markComplete: () => {},
    getSubmission: () => options.submission,
    submitDeliverable: () => {},
    isModuleLocked: () => false,
    progressPercent: computed(() => (options.completed ? 100 : 0)),
    totalXpEarned: computed(() => (options.completed ? 25 : 0)),
    totalXpAvailable: computed(() => 1200)
  }
}

const meta = {
  title: 'Components/ProgramStepDrawer',
  component: ProgramStepDrawer,
  tags: ['autodocs'],
  parameters: {
    // The drawer portals itself to <body> and covers the lower 85% of the
    // viewport, so a padded canvas would clip it.
    layout: 'fullscreen'
  },
  args: {
    modules,
    programTitle: template.title
  },
  render: args => ({
    components: { ProgramStepDrawer },
    setup: () => ({ args }),
    // `:open="true"` rather than v-model: a story is a fixed state, and letting
    // the drawer close would leave an empty canvas with no way back.
    template: '<div class="h-dvh bg-elevated"><ProgramStepDrawer v-bind="args" :open="true" /></div>'
  })
} satisfies Meta<typeof ProgramStepDrawer>

export default meta
type Story = StoryObj<typeof meta>

// A regular step: authored body content, and a single "Mark as complete" in the
// footer.
export const Topic: Story = {
  args: {
    item: topic,
    progress: stubProgress(),
    open: true
  }
}

export const TopicCompleted: Story = {
  args: {
    item: topic,
    progress: stubProgress({ completed: true }),
    open: true
  }
}

// Milestones read their own page content first, then the hand-in form — the
// footer offers "Start this task" until the learner opts in.
export const Deliverable: Story = {
  args: {
    item: deliverable,
    progress: stubProgress(),
    open: true
  }
}

// Once submitted, the form is replaced by a receipt of what was handed in.
export const DeliverableSubmitted: Story = {
  args: {
    item: deliverable,
    progress: stubProgress({
      completed: true,
      submission: {
        description: 'Concept one-pager plus the first pass at the project board. The repo runs locally.',
        links: ['https://example.com/threadbare-onepager', 'https://github.com/example/threadbare']
      }
    }),
    open: true
  }
}
