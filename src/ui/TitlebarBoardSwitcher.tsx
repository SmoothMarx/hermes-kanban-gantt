import { Button, cn, Codicon, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, useQuery, useQueryClient, useValue } from '@hermes/plugin-sdk'

import { $boardSlug, apiBase, apiFetch, getStorage } from '../state'
import { useGanttI18n } from '../i18n'

/**
 * Board switcher projected into the desktop titlebar band (titleBar.center)
 * while the gantt page is mounted — mirrors the official kanban plugin's
 * placement so both switchers live in the same spot. Content differs: this
 * one offers the plugin's own "all boards" aggregate mode.
 */
export function TitlebarBoardSwitcher() {
  const board = useValue($boardSlug)
  const i18n = useGanttI18n()
  const queryClient = useQueryClient()
  const { data } = useQuery({
    queryKey: ['kanban-gantt', 'boards', apiBase()],
    queryFn: () => apiFetch('/boards'),
    refetchInterval: 5 * 60_000
  })
  const boards = data?.boards || []
  const isAllBoards = board === 'all' || board === '*'
  const current = isAllBoards
    ? { slug: 'all', label: i18n.allBoards }
    : boards.find(b => b.slug === (board || data?.current))
  const setBoard = (slug: string) => {
    $boardSlug.set(slug)
    if (getStorage()) getStorage().set('board', slug)
    void queryClient.invalidateQueries({ queryKey: ['kanban-gantt', 'gantt'] })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          className="h-7 max-w-56 gap-1.5 px-2 [-webkit-app-region:no-drag]"
          size="sm"
          variant="ghost"
        >
          {/* Single-element child: Radix `asChild` (Slot) rejects arrays. */}
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="min-w-0 flex-1 truncate text-[0.75rem] font-medium leading-none">
              {current?.label || '—'}
            </span>
            {current && typeof current.total === 'number' && (
              <span className="text-[0.6875rem] tabular-nums text-(--ui-text-quaternary)">
                {current.total}
              </span>
            )}
            <span className="text-[9px] opacity-60">▾</span>
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center" className="min-w-[12rem] p-1">
        <DropdownMenuItem
          onClick={() => setBoard('all')}
          className="flex items-center justify-between text-xs py-1.5 cursor-pointer font-medium border-b border-(--ui-stroke-tertiary) mb-1"
        >
          <span className={cn('flex-1 truncate', isAllBoards && 'font-semibold text-(--ui-accent)')}>
            {i18n.allBoards}
          </span>
          {isAllBoards && <Codicon name="check" size="0.8rem" className="ml-2" />}
        </DropdownMenuItem>
        {boards.map(b => {
          const isCurrent = !isAllBoards && b.slug === (board || data?.current)
          return (
            <DropdownMenuItem
              key={b.slug}
              onClick={() => setBoard(b.slug)}
              className="flex items-center justify-between text-xs py-1.5 cursor-pointer"
            >
              <span className={cn('flex-1 truncate', isCurrent && 'font-semibold text-(--ui-accent)')}>
                {b.label || b.slug}
              </span>
              {isCurrent && <Codicon name="check" size="0.8rem" className="ml-2" />}
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
