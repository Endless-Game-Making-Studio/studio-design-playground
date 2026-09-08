<script setup lang="ts">
import type { TreeItem } from '@nuxt/ui'
import { categoryGroups, sampleAssets } from '~/composables/patchWorkShop/assets'
import type { LibraryAsset, SubcategoryItem } from '~/composables/patchWorkShop/types'
import { usePatchWorkShopContext } from '~/composables/usePatchWorkShopContext'

const editor = usePatchWorkShopContext()
const { t } = useI18n()

// ─── Category / subcategory tree ───────────────────────────────────────────

// Extends `TreeItem` with the bit of routing the source catalogue doesn't
// carry on its own: a leaf either filters by category or by subcategory, while
// a purely organisational node (e.g. "Wood" grouping the three Patchwork Wood
// subcategories) only expands — it matches no asset on its own.
interface FilterTreeItem extends TreeItem {
  id: string
  kind: 'category' | 'subcategory' | 'group'
  filterValue?: string
  children?: FilterTreeItem[]
}

function buildSubcategoryItem(item: string | SubcategoryItem, path: string): FilterTreeItem {
  if (typeof item === 'string') {
    return { id: `${path}/${item}`, label: item, kind: 'subcategory', filterValue: item }
  }
  return {
    id: `${path}/${item.name}`,
    label: item.name,
    kind: 'group',
    children: item.children?.map(child => buildSubcategoryItem(child, `${path}/${item.name}`))
  }
}

const treeItems = computed<FilterTreeItem[]>(() => categoryGroups.map(group => ({
  id: group.name,
  label: group.name,
  kind: 'category' as const,
  filterValue: group.name,
  children: group.subcategories.map(item => buildSubcategoryItem(item, group.name))
})))

function treeItemKey(item: FilterTreeItem) {
  return item.id
}

const selectedNode = ref<FilterTreeItem>()
const selectedCategory = ref<string | null>(null)
const selectedSubcategory = ref<string | null>(null)

// A "group" node (no `filterValue`) is pure navigation — selecting it expands
// the branch without changing what the grid shows below.
watch(selectedNode, (node) => {
  if (!node || node.kind === 'group') return
  if (node.kind === 'category') {
    selectedCategory.value = node.filterValue ?? null
    selectedSubcategory.value = null
  } else {
    selectedSubcategory.value = node.filterValue ?? null
    selectedCategory.value = null
  }
})

function clearFilter() {
  selectedNode.value = undefined
  selectedCategory.value = null
  selectedSubcategory.value = null
}

// ─── Search + filtering ─────────────────────────────────────────────────────

const query = ref('')

const filteredAssets = computed(() => {
  let list = sampleAssets
  if (selectedSubcategory.value) list = list.filter(asset => asset.subcategory === selectedSubcategory.value)
  else if (selectedCategory.value) list = list.filter(asset => asset.category === selectedCategory.value)

  const needle = query.value.trim().toLowerCase()
  if (needle) list = list.filter(asset => asset.name.toLowerCase().includes(needle))

  return list
})

// ─── Placing an asset ───────────────────────────────────────────────────────

function onDragStart(event: DragEvent, asset: LibraryAsset) {
  event.dataTransfer?.setData('application/json', JSON.stringify(asset))
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'copy'
}
</script>

<template>
  <div class="flex h-full flex-col gap-3 overflow-hidden p-3.5">
    <UInput
      v-model="query"
      icon="lucide:search"
      :placeholder="t('patchworkshop.library.searchPlaceholder')"
      :aria-label="t('patchworkshop.library.searchPlaceholder')"
    />

    <UButton
      :label="t('patchworkshop.library.allAssets')"
      icon="lucide:layout-grid"
      color="neutral"
      :variant="selectedNode ? 'ghost' : 'soft'"
      block
      class="justify-start"
      @click="clearFilter"
    />

    <USeparator />

    <div class="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
      <UTree
        v-model="selectedNode"
        :items="treeItems"
        :get-key="treeItemKey"
      />

      <USeparator />

      <p v-if="filteredAssets.length === 0" class="px-1 text-sm text-muted">
        {{ t('patchworkshop.library.noResults') }}
      </p>
      <div v-else class="grid grid-cols-3 gap-2">
        <button
          v-for="asset in filteredAssets"
          :key="asset.id"
          type="button"
          draggable="true"
          class="flex aspect-square cursor-pointer items-center justify-center rounded-md border border-default bg-default p-1.5 transition-colors hover:border-primary hover:bg-elevated"
          :aria-label="t('patchworkshop.library.addAriaLabel', { name: asset.name })"
          @click="editor.addLayer(asset)"
          @dragstart="onDragStart($event, asset)"
        >
          <img
            :src="asset.imageUrl"
            :alt="asset.name"
            draggable="false"
            class="max-h-full max-w-full object-contain"
            style="image-rendering: pixelated"
          >
        </button>
      </div>
    </div>
  </div>
</template>
