import { useSyncExternalStore } from 'react'

export const WISH_COUNT = 23
export const nowSec = () => performance.now() / 1000

/** Estado compartido entre el DOM (textos) y la escena 3D. La escena lo lee en cada frame. */
export const world = {
  night: 0, // 0 = tarde pastel, 1 = noche estrellada (suavizado)
  opened: Array<boolean>(WISH_COUNT).fill(false),
  openedAt: Array<number>(WISH_COUNT).fill(-100),
  activeWish: -1,
  allWishes: false,
  allWishesAt: -100,
  star: false,
  starAt: -100,
  bouquetAt: -100,
}

const listeners = new Set<() => void>()
let version = 0
const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}
const emit = () => {
  version++
  listeners.forEach((l) => l())
}

/** Hook para que los componentes del DOM se actualicen cuando cambia el estado del mundo. */
export function useWorld() {
  useSyncExternalStore(subscribe, () => version)
  return world
}

export function openWish(i: number) {
  if (!world.opened[i]) {
    world.opened[i] = true
    world.openedAt[i] = nowSec()
  }
  world.activeWish = i
  if (!world.allWishes && world.opened.every(Boolean)) {
    world.allWishes = true
    world.allWishesAt = nowSec()
  }
  emit()
}

export function closeWish() {
  world.activeWish = -1
  emit()
}

export function activateStar() {
  if (world.star) return
  world.star = true
  world.starAt = nowSec()
  world.bouquetAt = nowSec() + 4.6
  emit()
}

export function resetWorld() {
  world.night = 0
  world.opened.fill(false)
  world.openedAt.fill(-100)
  world.activeWish = -1
  world.allWishes = false
  world.star = false
  world.starAt = -100
  world.bouquetAt = -100
  emit()
}
